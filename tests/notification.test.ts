import type { IExecuteFunctions, IHttpRequestOptions, INodeExecutionData } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';

import { Novu } from '../nodes/Novu/Novu.node';
import { notificationProperties } from '../nodes/Novu/resources/notification.description';
import { runDeclarative } from './declarative-harness';

type Parameters = Record<string, unknown>;

const makeContext = (
	parameters: Parameters[],
	request: (type: string, options: IHttpRequestOptions) => Promise<unknown>,
	continueOnFail = false,
) =>
	({
		getInputData: vi.fn().mockReturnValue(parameters.map((_, index) => ({ json: { index } }))),
		getNodeParameter: vi.fn((name: string, itemIndex: number, fallback?: unknown) =>
			Object.prototype.hasOwnProperty.call(parameters[itemIndex], name)
				? parameters[itemIndex][name]
				: fallback,
		),
		getCredentials: vi.fn().mockResolvedValue({ apiKey: 'secret', region: 'us' }),
		getNode: vi.fn().mockReturnValue({ name: 'Novu', type: 'novu', typeVersion: 1 }),
		continueOnFail: vi.fn().mockReturnValue(continueOnFail),
		helpers: { httpRequestWithAuthentication: vi.fn(request) },
	}) as unknown as IExecuteFunctions;

const run = async (context: IExecuteFunctions): Promise<INodeExecutionData[]> => {
	if (context.getNodeParameter('operation', 0) === 'triggerWorkflow') {
		return (
			(await new Novu().customOperations!.notification.triggerWorkflow.call(
				context,
			)) as INodeExecutionData[][]
		)[0];
	}
	return runDeclarative(context);
};

const trigger = (overrides: Parameters = {}): Parameters => ({
	resource: 'notification',
	operation: 'triggerWorkflow',
	workflowIdentifier: 'order-created',
	subscriberId: 'customer-1',
	payload: '{}',
	triggerOptions: {},
	...overrides,
});

const acknowledgment = (status = 'processed') => ({
	acknowledged: true,
	status,
	transactionId: 'tx-1',
	activityFeedLink: 'https://web.novu.co/activity-feed/tx-1',
	jobData: {},
});
const raw = (data: unknown) => ({ data });

describe('Notification Trigger Workflow', () => {
	it('advertises trigger and cancellation with required conditional controls', () => {
		const operation = notificationProperties.find(({ name }) => name === 'operation');
		expect(
			operation?.options?.map((option) => ('value' in option ? option.value : undefined)),
		).toEqual(['cancelExecution', 'triggerWorkflow']);
		expect(notificationProperties.find(({ name }) => name === 'workflowIdentifier')).toMatchObject({
			type: 'resourceLocator',
			required: true,
		});
		expect(notificationProperties.find(({ name }) => name === 'cancelTransactionId')).toMatchObject(
			{
				type: 'string',
				required: true,
				displayOptions: { show: { operation: ['cancelExecution'] } },
			},
		);
	});
	it.each([
		[{ mode: 'list', value: 'chosen-workflow' }, 'chosen-workflow'],
		[{ mode: 'id', value: 'manual-workflow' }, 'manual-workflow'],
	])('normalizes workflow locator %# into the REST name', async (workflowIdentifier, name) => {
		const request = vi.fn().mockResolvedValue(raw(acknowledgment()));
		await run(makeContext([trigger({ workflowIdentifier })], request));
		expect(request.mock.calls[0][1].body).toEqual(expect.objectContaining({ name }));
	});
	it('keeps saved workflows on subscriber recipients and supports an exact topic recipient', async () => {
		const request = vi.fn().mockResolvedValue(raw(acknowledgment()));
		await run(
			makeContext(
				[
					trigger(),
					trigger({ recipientType: 'subscriber', subscriberId: 'explicit' }),
					trigger({ recipientType: 'topic', subscriberId: '', recipientTopicKey: 'orders/a' }),
				],
				request,
			),
		);
		expect(request.mock.calls.map((call) => (call[1].body as Record<string, unknown>).to)).toEqual([
			'customer-1',
			'explicit',
			{ type: 'Topic', topicKey: 'orders/a' },
		]);
	});

	it.each([
		[{ recipientType: 'topic', recipientTopicKey: '' }, 'Topic Key'],
		[{ recipientType: 'broadcast' }, 'Recipient Type'],
	])('rejects invalid topic recipient input', async (override, message) => {
		const request = vi.fn();
		await expect(run(makeContext([trigger(override)], request))).rejects.toThrow(message);
		expect(request).not.toHaveBeenCalled();
	});

	it('retries an identical topic body with the identical idempotency key', async () => {
		vi.useFakeTimers();
		try {
			const request = vi
				.fn()
				.mockRejectedValueOnce({ statusCode: 408 })
				.mockResolvedValue(raw(acknowledgment()));
			const promise = run(
				makeContext(
					[
						trigger({
							recipientType: 'topic',
							recipientTopicKey: 'orders',
							triggerOptions: { idempotencyKey: 'stable', retryWithIdempotencyKey: true },
						}),
					],
					request,
				),
			);
			await vi.runAllTimersAsync();
			await expect(promise).resolves.toHaveLength(1);
			expect(request).toHaveBeenCalledTimes(2);
			expect(request.mock.calls[1][1]).toEqual(request.mock.calls[0][1]);
			expect(request.mock.calls[0][1]).toEqual(
				expect.objectContaining({
					headers: { 'Idempotency-Key': 'stable' },
					body: expect.objectContaining({ to: { type: 'Topic', topicKey: 'orders' } }),
				}),
			);
		} finally {
			vi.useRealTimers();
		}
	});

	it('sends exact v1 REST fields, omits optional values, and preserves the acknowledgment', async () => {
		const response = acknowledgment();
		const request = vi.fn().mockResolvedValue(raw(response));
		const output = await run(
			makeContext(
				[
					trigger({
						payload: '{"active":false,"count":0,"items":[null,1],"nested":{"ok":true}}',
					}),
				],
				request,
			),
		);
		expect(request).toHaveBeenCalledWith('novuApi', {
			method: 'POST',
			url: 'https://api.novu.co/v1/events/trigger',
			json: true,
			body: {
				name: 'order-created',
				to: 'customer-1',
				payload: { active: false, count: 0, items: [null, 1], nested: { ok: true } },
			},
		});
		expect(output).toEqual([{ json: response, pairedItem: 0 }]);
		expect(output[0].json).not.toHaveProperty('delivered');
	});

	it('resolves distinct optional values for each item and preserves pairing', async () => {
		const request = vi.fn().mockImplementation(async (_type, options: IHttpRequestOptions) =>
			raw({
				acknowledged: true,
				status: 'processed',
				transactionId: (options.body as Record<string, unknown>).transactionId,
			}),
		);
		const output = await run(
			makeContext(
				[
					trigger({
						workflowIdentifier: 'one',
						subscriberId: 'sub-one',
						payload: { item: 1 },
						triggerOptions: { transactionId: 'tx-one', idempotencyKey: 'key-one' },
					}),
					trigger({
						workflowIdentifier: 'two',
						subscriberId: 'sub-two',
						payload: { item: 2 },
						triggerOptions: { transactionId: 'tx-two', idempotencyKey: 'key-two' },
					}),
				],
				request,
			),
		);
		expect(request.mock.calls.map((call) => call[1])).toEqual([
			expect.objectContaining({
				body: { name: 'one', to: 'sub-one', payload: { item: 1 }, transactionId: 'tx-one' },
				headers: { 'Idempotency-Key': 'key-one' },
			}),
			expect.objectContaining({
				body: { name: 'two', to: 'sub-two', payload: { item: 2 }, transactionId: 'tx-two' },
				headers: { 'Idempotency-Key': 'key-two' },
			}),
		]);
		expect(output.map(({ pairedItem }) => pairedItem)).toEqual([0, 1]);
	});

	it.each(['bad-json', 'null', '[]', '1'])(
		'rejects invalid payload %s locally',
		async (payload) => {
			const request = vi.fn();
			await expect(run(makeContext([trigger({ payload })], request))).rejects.toMatchObject({
				context: { itemIndex: 0 },
			});
			expect(request).not.toHaveBeenCalled();
		},
	);

	it.each([
		['workflowIdentifier', ''],
		['subscriberId', ''],
	])('rejects empty %s locally', async (parameter, value) => {
		const request = vi.fn();
		await expect(
			run(makeContext([trigger({ [parameter]: value })], request)),
		).rejects.toMatchObject({
			context: { itemIndex: 0 },
		});
		expect(request).not.toHaveBeenCalled();
	});

	it('rejects the resource locator default blank object before transport', async () => {
		const request = vi.fn();
		await expect(
			run(makeContext([trigger({ workflowIdentifier: { mode: 'list', value: '' } })], request)),
		).rejects.toThrow('Workflow Identifier');
		expect(request).not.toHaveBeenCalled();
	});

	it('rejects oversized keys and retry without a key locally', async () => {
		const request = vi.fn();
		await expect(
			run(makeContext([trigger({ triggerOptions: { idempotencyKey: 'x'.repeat(256) } })], request)),
		).rejects.toThrow('255');
		await expect(
			run(makeContext([trigger({ triggerOptions: { retryWithIdempotencyKey: true } })], request)),
		).rejects.toThrow('requires a non-empty');
		expect(request).not.toHaveBeenCalled();
	});

	it.each([
		'error',
		'trigger_not_active',
		'no_workflow_active_steps_defined',
		'no_workflow_steps_defined',
		'processed',
		'no_tenant_found',
		'invalid_recipients',
	])('preserves the recognized %s acknowledgment status', async (status) => {
		const response = {
			...acknowledgment(status),
			...(status === 'error' ? { error: ['failed'] } : {}),
		};
		await expect(
			run(makeContext([trigger()], vi.fn().mockResolvedValue(raw(response)))),
		).resolves.toEqual([{ json: response, pairedItem: 0 }]);
	});

	it('rejects malformed and unknown acknowledgment responses', async () => {
		await expect(
			run(makeContext([trigger()], vi.fn().mockResolvedValue({}))),
		).rejects.toMatchObject({ context: { itemIndex: 0 } });
		for (const malformed of [
			{},
			{ acknowledged: true, status: 'unknown' },
			{ acknowledged: true, status: 'processed', error: 'bad' },
		]) {
			await expect(
				run(makeContext([trigger()], vi.fn().mockResolvedValue(raw(malformed)))),
			).rejects.toThrow(/malformed|unrecognized/);
		}
	});

	it.each([null, [], 'bad'])('rejects malformed trigger options %#', async (triggerOptions) => {
		const request = vi.fn();
		await expect(run(makeContext([trigger({ triggerOptions })], request))).rejects.toThrow(
			'Options must be an object',
		);
		expect(request).not.toHaveBeenCalled();
	});

	it('rejects a non-boolean retry option', async () => {
		const request = vi.fn();
		await expect(
			run(
				makeContext(
					[
						trigger({
							triggerOptions: {
								idempotencyKey: 'stable',
								retryWithIdempotencyKey: 'true',
							},
						}),
					],
					request,
				),
			),
		).rejects.toThrow('must be a boolean');
		expect(request).not.toHaveBeenCalled();
	});

	it('treats unknown workflow as an error and supports continuation without retry by default', async () => {
		const request = vi.fn().mockRejectedValue({ statusCode: 404, body: { message: 'raw' } });
		await expect(run(makeContext([trigger()], request))).rejects.toThrow('resource or route');
		expect(request).toHaveBeenCalledTimes(1);
		await expect(run(makeContext([trigger()], request, true))).resolves.toEqual([
			{ json: { error: expect.stringContaining('resource or route') }, pairedItem: 0 },
		]);
	});

	it('does not retry terminal 422 even when opted in', async () => {
		const request = vi.fn().mockRejectedValue({ statusCode: 422 });
		await expect(
			run(
				makeContext(
					[
						trigger({
							triggerOptions: {
								idempotencyKey: 'stable-key',
								retryWithIdempotencyKey: true,
							},
						}),
					],
					request,
				),
			),
		).rejects.toThrow('HTTP status 422');
		expect(request).toHaveBeenCalledTimes(1);
	});
});

describe('Notification Cancel Execution', () => {
	const cancel = (transactionId: unknown) => ({
		resource: 'notification',
		operation: 'cancelExecution',
		cancelTransactionId: transactionId,
	});

	it.each([true, false])('maps actual cancellation response %s', async (cancelled) => {
		const request = vi.fn().mockResolvedValue(raw(cancelled));
		await expect(run(makeContext([cancel('tx/a')], request))).resolves.toEqual([
			{ json: { transactionId: 'tx/a', cancelled }, pairedItem: 0 },
		]);
		expect(request).toHaveBeenCalledWith('novuApi', {
			method: 'DELETE',
			url: 'https://api.novu.co/v1/events/trigger/tx%2Fa',
			json: true,
		});
	});

	it('validates blank and malformed responses', async () => {
		const request = vi.fn();
		await expect(run(makeContext([cancel('')], request))).rejects.toThrow('Transaction ID');
		expect(request).not.toHaveBeenCalled();
		await expect(
			run(makeContext([cancel('tx')], vi.fn().mockResolvedValue(raw({ cancelled: true })))),
		).rejects.toThrow('malformed cancellation');
	});

	it('resolves distinct items and supports continuation', async () => {
		const request = vi
			.fn()
			.mockRejectedValueOnce({ statusCode: 404 })
			.mockResolvedValueOnce(raw(true));
		await expect(
			run(makeContext([cancel('missing'), cancel('pending')], request, true)),
		).resolves.toEqual([
			{ json: { error: expect.stringContaining('resource or route') }, pairedItem: 0 },
			{ json: { transactionId: 'pending', cancelled: true }, pairedItem: 1 },
		]);
	});
});
