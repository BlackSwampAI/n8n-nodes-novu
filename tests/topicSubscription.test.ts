import type { IExecuteFunctions, IHttpRequestOptions, INodeExecutionData } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';
import { Novu } from '../nodes/Novu/Novu.node';
import { topicSubscriptionProperties } from '../nodes/Novu/resources/topicSubscription.description';

type Params = Record<string, unknown>;
const ctx = (
	parameters: Params[],
	request: (type: string, options: IHttpRequestOptions) => Promise<unknown>,
	continuation = false,
) =>
	({
		getInputData: vi.fn().mockReturnValue(parameters.map(() => ({ json: {} }))),
		getNodeParameter: vi.fn((name: string, index: number, fallback?: unknown) =>
			Object.prototype.hasOwnProperty.call(parameters[index], name)
				? parameters[index][name]
				: fallback,
		),
		getCredentials: vi.fn().mockResolvedValue({ apiKey: 'secret', region: 'us' }),
		getNode: vi.fn().mockReturnValue({ name: 'Novu', type: 'novu', typeVersion: 1 }),
		continueOnFail: vi.fn().mockReturnValue(continuation),
		helpers: { httpRequestWithAuthentication: vi.fn(request) },
	}) as unknown as IExecuteFunctions;
const run = async (context: IExecuteFunctions): Promise<INodeExecutionData[]> =>
	(await new Novu().execute.call(context))[0];
const params = (operation: string, extra: Params = {}) => ({
	resource: 'topicSubscription',
	operation,
	topicKey: 'topic/a',
	...extra,
});
const result = (failed = 0) => ({
	data: failed ? [] : [{ subscriberId: 'sub' }],
	meta: { totalCount: 1, successful: failed ? 0 : 1, failed },
	...(failed ? { errors: [{ message: 'partial' }] } : {}),
});
const page = (data: object[], next: string | null = null) => ({
	data,
	next,
	previous: null,
	totalCount: data.length,
	totalCountCapped: false,
});

describe('Topic Subscription metadata and mutations', () => {
	it('exposes exactly Create/Get Many/Delete and warns about subscriber-only deletion', () => {
		const operation = topicSubscriptionProperties.find((property) => property.name === 'operation');
		expect(
			operation?.options?.map((option) => ('value' in option ? option.value : undefined)),
		).toEqual(['create', 'delete', 'getMany']);
		const subscriptions = topicSubscriptionProperties.find(
			(property) => property.name === 'subscriptions',
		);
		expect(subscriptions?.description).toContain('removes all relationships');
	});

	it('creates modern simple/identified subscriptions per item and preserves partial results', async () => {
		const request = vi.fn().mockResolvedValueOnce(result()).mockResolvedValueOnce(result(1));
		const output = await run(
			ctx(
				[
					params('create', {
						subscriptions: { subscription: [{ subscriberId: 'one', identifier: '' }] },
					}),
					params('create', {
						topicKey: 'other',
						subscriptions: { subscription: [{ subscriberId: 'two', identifier: 'primary' }] },
					}),
				],
				request,
			),
		);
		expect(request.mock.calls[0][1]).toEqual(
			expect.objectContaining({
				method: 'POST',
				url: 'https://api.novu.co/v2/topics/topic%2Fa/subscriptions',
				body: { subscriptions: [{ subscriberId: 'one' }] },
			}),
		);
		expect(request.mock.calls[0][1]).not.toHaveProperty('headers');
		expect(JSON.stringify(request.mock.calls[0][1].body)).not.toContain('subscriberIds');
		expect(request.mock.calls[1][1].body).toEqual({
			subscriptions: [{ subscriberId: 'two', identifier: 'primary' }],
		});
		expect(output).toEqual([
			{ json: result(), pairedItem: 0 },
			{ json: result(1), pairedItem: 1 },
		]);
	});

	it('accepts 1/100 and rejects malformed create entries and envelopes', async () => {
		for (const count of [1, 100])
			await expect(
				run(
					ctx(
						[
							params('create', {
								subscriptions: {
									subscription: Array.from({ length: count }, (_, i) => ({
										subscriberId: `s${i}`,
									})),
								},
							}),
						],
						vi.fn().mockResolvedValue(result()),
					),
				),
			).resolves.toHaveLength(1);
		for (const subscriptions of [
			{ subscription: [] },
			{ subscription: Array.from({ length: 101 }, () => ({ subscriberId: 's' })) },
			{ subscription: [{ subscriberId: '' }] },
			{ subscription: [{ subscriberId: 's', identifier: 'x'.repeat(513) }] },
			{ subscription: [{ subscriberId: 's', unknown: true }] },
		])
			await expect(run(ctx([params('create', { subscriptions })], vi.fn()))).rejects.toThrow();
		await expect(
			run(
				ctx(
					[params('create', { subscriptions: { subscription: [{ subscriberId: 's' }] } })],
					vi.fn().mockResolvedValue({ data: [], meta: {} }),
				),
			),
		).rejects.toThrow('malformed');
	});

	it('counts relationship identifier limits by Unicode code points', async () => {
		const request = vi.fn().mockResolvedValue(result());
		await expect(
			run(
				ctx(
					[
						params('create', {
							subscriptions: {
								subscription: [{ subscriberId: 'sub', identifier: '🚀'.repeat(512) }],
							},
						}),
					],
					request,
				),
			),
		).resolves.toHaveLength(1);
		const rejectedRequest = vi.fn();
		await expect(
			run(
				ctx(
					[
						params('create', {
							subscriptions: {
								subscription: [{ subscriberId: 'sub', identifier: '🚀'.repeat(513) }],
							},
						}),
					],
					rejectedRequest,
				),
			),
		).rejects.toThrow('512');
		expect(rejectedRequest).not.toHaveBeenCalled();
	});

	it('deletes subscriber-only, identifier-only, and combined selectors without hiding partial failure', async () => {
		const request = vi.fn().mockResolvedValue(result(1));
		const selectors = [
			{ subscriberId: 'sub', identifier: '' },
			{ subscriberId: '', identifier: 'relationship' },
			{ subscriberId: 'sub', identifier: 'relationship' },
		];
		await expect(
			run(ctx([params('delete', { subscriptions: { subscription: selectors } })], request)),
		).resolves.toEqual([{ json: result(1), pairedItem: 0 }]);
		expect(request).toHaveBeenCalledWith(
			'novuApi',
			expect.objectContaining({
				method: 'DELETE',
				body: {
					subscriptions: [
						{ subscriberId: 'sub' },
						{ identifier: 'relationship' },
						{ subscriberId: 'sub', identifier: 'relationship' },
					],
				},
			}),
		);
	});

	it.each([
		{ subscription: [] },
		{ subscription: Array.from({ length: 101 }, () => ({ subscriberId: 'sub' })) },
		{ subscription: [{ subscriberId: '', identifier: '' }] },
		{ subscription: [{ identifier: 'x'.repeat(513) }] },
	])('rejects invalid Delete selector boundaries before requesting', async (subscription) => {
		const request = vi.fn();
		await expect(
			run(ctx([params('delete', { subscriptions: subscription })], request)),
		).rejects.toThrow();
		expect(request).not.toHaveBeenCalled();
	});
});

describe('Topic Subscription Get Many', () => {
	it('filters, orders, paginates, limits and pairs', async () => {
		const request = vi
			.fn()
			.mockResolvedValueOnce(page([{ id: 1 }, { id: 2 }], 'next'))
			.mockResolvedValueOnce(page([{ id: 3 }]));
		const output = await run(
			ctx(
				[
					params('getMany', {
						returnAll: false,
						limit: 3,
						subscriptionFilters: { subscriberId: 'sub', contextKeys: ['tenant:a'] },
						subscriptionListOptions: { orderBy: 'createdAt', orderDirection: 'ASC' },
					}),
				],
				request,
			),
		);
		expect(request.mock.calls[0][1].qs).toEqual({
			subscriberId: 'sub',
			contextKeys: ['tenant:a'],
			orderBy: 'createdAt',
			orderDirection: 'ASC',
			limit: 3,
		});
		expect(request.mock.calls[1][1].qs).toEqual(
			expect.objectContaining({ after: 'next', limit: 1 }),
		);
		expect(output.map((item) => item.pairedItem)).toEqual([0, 0, 0]);
	});

	it('uses max100, emits empty zero, detects malformed/repeated cursors, and validates allowlists', async () => {
		const base = params('getMany', {
			returnAll: true,
			subscriptionFilters: {},
			subscriptionListOptions: {},
		});
		const emptyRequest = vi.fn().mockResolvedValue(page([]));
		await expect(run(ctx([base], emptyRequest))).resolves.toEqual([]);
		expect(emptyRequest.mock.calls[0][1].qs?.limit).toBe(100);
		await expect(run(ctx([base], vi.fn().mockResolvedValue({ data: [] })))).rejects.toThrow(
			'malformed',
		);
		const repeated = vi
			.fn()
			.mockResolvedValueOnce(page([{}], 'same'))
			.mockResolvedValueOnce(page([{}], 'same'));
		await expect(run(ctx([base], repeated))).rejects.toThrow('repeated');
		for (const invalid of [
			params('getMany', {
				returnAll: false,
				limit: 0,
				subscriptionFilters: {},
				subscriptionListOptions: {},
			}),
			params('getMany', {
				returnAll: true,
				subscriptionFilters: { contextKeys: 'bad' },
				subscriptionListOptions: {},
			}),
			params('getMany', {
				returnAll: true,
				subscriptionFilters: { unknown: 1 },
				subscriptionListOptions: {},
			}),
			params('getMany', {
				returnAll: true,
				subscriptionFilters: {},
				subscriptionListOptions: { orderDirection: 'UP' },
			}),
		])
			await expect(run(ctx([invalid], vi.fn()))).rejects.toThrow();
	});

	it('preserves pairing and continuation across inputs', async () => {
		const request = vi
			.fn()
			.mockRejectedValueOnce({ statusCode: 404 })
			.mockResolvedValueOnce(page([{ id: 'ok' }]));
		const base = { returnAll: true, subscriptionFilters: {}, subscriptionListOptions: {} };
		await expect(
			run(
				ctx(
					[params('getMany', base), params('getMany', { ...base, topicKey: 'ok' })],
					request,
					true,
				),
			),
		).resolves.toEqual([
			{ json: { error: expect.stringContaining('resource or route') }, pairedItem: 0 },
			{ json: { id: 'ok' }, pairedItem: 1 },
		]);
	});
});
