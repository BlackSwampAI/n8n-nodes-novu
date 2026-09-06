import type { IExecuteFunctions, IHttpRequestOptions, INodeExecutionData } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';

import { Novu } from '../nodes/Novu/Novu.node';

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

const run = async (context: IExecuteFunctions): Promise<INodeExecutionData[]> =>
	(await new Novu().execute.call(context))[0];

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

describe('Notification Trigger Workflow', () => {
	it('sends exact v1 REST fields, omits optional values, and preserves the acknowledgment', async () => {
		const response = acknowledgment();
		const request = vi.fn().mockResolvedValue(response);
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
		const request = vi.fn().mockImplementation(async (_type, options: IHttpRequestOptions) => ({
			acknowledged: true,
			status: 'processed',
			transactionId: (options.body as Record<string, unknown>).transactionId,
		}));
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
			run(makeContext([trigger()], vi.fn().mockResolvedValue(response))),
		).resolves.toEqual([{ json: response, pairedItem: 0 }]);
	});

	it('rejects malformed and unknown acknowledgment responses', async () => {
		for (const malformed of [
			{},
			{ acknowledged: true, status: 'unknown' },
			{ acknowledged: true, status: 'processed', error: 'bad' },
		]) {
			await expect(
				run(makeContext([trigger()], vi.fn().mockResolvedValue(malformed))),
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
