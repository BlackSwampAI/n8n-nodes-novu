import type { IExecuteFunctions, IHttpRequestOptions, INodeExecutionData } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';
import { Novu } from '../nodes/Novu/Novu.node';
import { topicProperties } from '../nodes/Novu/resources/topic.description';

type Params = Record<string, unknown>;
const context = (
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
const run = async (ctx: IExecuteFunctions): Promise<INodeExecutionData[]> =>
	(await new Novu().execute.call(ctx))[0];
const topic = (key: string) => ({ _id: `internal-${key}`, key, name: key, data: { count: 0 } });
const envelope = (data: Record<string, unknown>[], next: string | null = null) => ({
	data,
	next,
	previous: null,
	totalCount: data.length,
	totalCountCapped: false,
});
const params = (operation: string, extra: Params = {}) => ({
	resource: 'topic',
	operation,
	topicKey: 'key',
	...extra,
});

describe('Topic metadata and item operations', () => {
	it('exposes exactly five topic operations with conditional fields', () => {
		const operation = topicProperties.find((property) => property.name === 'operation');
		expect(
			operation?.options?.map((option) => ('value' in option ? option.value : undefined)),
		).toEqual(['createOrUpdate', 'delete', 'get', 'getMany', 'update']);
		expect(
			topicProperties.find((property) => property.name === 'topicName')?.displayOptions?.show
				?.operation,
		).toEqual(['update']);
	});

	it('creates two distinct topics and omits or sends strict query', async () => {
		const request = vi.fn(async (_type, options: IHttpRequestOptions) => ({
			_id: 'id',
			...(options.body as object),
		}));
		const output = await run(
			context(
				[
					params('createOrUpdate', { topicKey: 'one', topicFields: {}, failIfExists: false }),
					params('createOrUpdate', {
						topicKey: 'two',
						topicFields: { name: '', data: '{"active":false,"count":0,"tags":["a"]}' },
						failIfExists: true,
					}),
				],
				request,
			),
		);
		expect(request.mock.calls[0][1]).not.toHaveProperty('qs');
		expect(request.mock.calls[1][1]).toEqual(
			expect.objectContaining({
				method: 'POST',
				url: 'https://api.novu.co/v2/topics',
				qs: { failIfExists: true },
				body: { key: 'two', name: '', data: { active: false, count: 0, tags: ['a'] } },
			}),
		);
		expect(output.map((item) => item.pairedItem)).toEqual([0, 1]);
	});

	it('supports null data and rejects invalid, nested, non-string arrays, and oversize data', async () => {
		const request = vi.fn(async (_type, options: IHttpRequestOptions) => ({
			_id: 'id',
			...(options.body as object),
		}));
		await expect(
			run(context([params('createOrUpdate', { topicFields: { data: 'null' } })], request)),
		).resolves.toEqual([
			expect.objectContaining({ json: expect.objectContaining({ data: null }) }),
		]);
		for (const data of [
			'bad',
			'[]',
			'{"nested":{"x":1}}',
			'{"items":[1]}',
			JSON.stringify({ huge: 'x'.repeat(65536) }),
		]) {
			await expect(
				run(context([params('createOrUpdate', { topicFields: { data } })], vi.fn())),
			).rejects.toThrow(/Custom Data|64 KB/);
		}
		await expect(
			run(
				context(
					[params('createOrUpdate', { topicFields: { data: { invalid: Number.NaN } } })],
					vi.fn(),
				),
			),
		).rejects.toThrow('Custom Data values');
	});

	it('counts display-name limits by Unicode code points', async () => {
		const name = '🚀'.repeat(100);
		const request = vi.fn().mockResolvedValue(topic('key'));
		await expect(
			run(context([params('update', { topicName: name })], request)),
		).resolves.toHaveLength(1);
		expect(request).toHaveBeenCalledWith('novuApi', expect.objectContaining({ body: { name } }));
	});

	it('gets an encoded key preserving data and updates name only', async () => {
		const request = vi.fn().mockResolvedValueOnce(topic('a/b')).mockResolvedValueOnce(topic('a/b'));
		await run(
			context(
				[
					params('get', { topicKey: 'a/b' }),
					params('update', { topicKey: 'a/b', topicName: 'New' }),
				],
				request,
			),
		);
		expect(request.mock.calls[0][1].url).toBe('https://api.novu.co/v2/topics/a%2Fb');
		expect(request.mock.calls[1][1]).toEqual(
			expect.objectContaining({ method: 'PATCH', body: { name: 'New' } }),
		);
	});

	it('validates keys, names, and malformed topic responses locally', async () => {
		for (const input of [
			params('get', { topicKey: '' }),
			params('update', { topicName: '' }),
			params('update', { topicName: 'x'.repeat(101) }),
		])
			await expect(run(context([input], vi.fn()))).rejects.toThrow();
		await expect(
			run(context([params('get')], vi.fn().mockResolvedValue({ key: 'key' }))),
		).rejects.toThrow('malformed topic');
	});

	it.each([[true], [false]])('maps delete acknowledgment %s honestly', async (acknowledged) => {
		await expect(
			run(context([params('delete')], vi.fn().mockResolvedValue({ acknowledged }))),
		).resolves.toEqual([{ json: { topicKey: 'key', acknowledged }, pairedItem: 0 }]);
	});

	it('rejects malformed delete and continues after missing topic', async () => {
		await expect(run(context([params('delete')], vi.fn().mockResolvedValue({})))).rejects.toThrow(
			'malformed',
		);
		const request = vi
			.fn()
			.mockRejectedValueOnce({ statusCode: 404 })
			.mockResolvedValueOnce(topic('ok'));
		await expect(
			run(
				context(
					[params('get', { topicKey: 'missing' }), params('get', { topicKey: 'ok' })],
					request,
					true,
				),
			),
		).resolves.toEqual([
			{ json: { error: expect.stringContaining('resource or route') }, pairedItem: 0 },
			{ json: topic('ok'), pairedItem: 1 },
		]);
	});
});

describe('Topic Get Many', () => {
	it('omits empty optional values and rejects unsupported or malformed query input', async () => {
		const request = vi.fn().mockResolvedValue(envelope([]));
		await run(
			context(
				[
					{
						resource: 'topic',
						operation: 'getMany',
						returnAll: false,
						limit: 1,
						topicFilters: { key: '', name: '' },
						topicListOptions: { orderBy: '' },
					},
				],
				request,
			),
		);
		expect(request.mock.calls[0][1].qs).toEqual({ limit: 1 });
		for (const invalid of [
			{ topicFilters: { key: 1 }, topicListOptions: {} },
			{ topicFilters: {}, topicListOptions: { orderBy: 1 } },
			{ topicFilters: {}, topicListOptions: { orderDirection: 'UP' } },
			{ topicFilters: { unknown: 'value' }, topicListOptions: {} },
		]) {
			await expect(
				run(
					context(
						[
							{
								resource: 'topic',
								operation: 'getMany',
								returnAll: false,
								limit: 1,
								...invalid,
							},
						],
						vi.fn(),
					),
				),
			).rejects.toThrow();
		}
	});
	it('forwards filters/order, paginates with exact limit, and pairs output', async () => {
		const request = vi
			.fn()
			.mockResolvedValueOnce(envelope([topic('a'), topic('b')], 'next'))
			.mockResolvedValueOnce(envelope([topic('c'), topic('d')]));
		const output = await run(
			context(
				[
					{
						resource: 'topic',
						operation: 'getMany',
						returnAll: false,
						limit: 3,
						topicFilters: { key: 'a', name: 'A' },
						topicListOptions: { orderBy: 'createdAt', orderDirection: 'ASC' },
					},
				],
				request,
			),
		);
		expect(request.mock.calls[0][1].qs).toEqual({
			key: 'a',
			name: 'A',
			orderBy: 'createdAt',
			orderDirection: 'ASC',
			limit: 3,
		});
		expect(request.mock.calls[1][1].qs).toEqual(
			expect.objectContaining({ after: 'next', limit: 1 }),
		);
		expect(output.map((item) => [item.json.key, item.pairedItem])).toEqual([
			['a', 0],
			['b', 0],
			['c', 0],
		]);
	});

	it('uses max 100 for Return All, supports empty/multiple inputs', async () => {
		const request = vi
			.fn()
			.mockResolvedValueOnce(envelope([]))
			.mockResolvedValueOnce(envelope([topic('b')]));
		const output = await run(
			context(
				[0, 1].map(() => ({
					resource: 'topic',
					operation: 'getMany',
					returnAll: true,
					topicFilters: {},
					topicListOptions: {},
				})),
				request,
			),
		);
		expect(
			request.mock.calls.every((call) => Object.prototype.hasOwnProperty.call(call[1].qs, 'limit')),
		).toBe(true);
		expect(request.mock.calls[0][1].qs?.limit).toBe(100);
		expect(output).toEqual([{ json: topic('b'), pairedItem: 1 }]);
	});

	it('rejects malformed/repeated cursors and invalid list inputs', async () => {
		const base = {
			resource: 'topic',
			operation: 'getMany',
			returnAll: true,
			topicFilters: {},
			topicListOptions: {},
		};
		await expect(run(context([base], vi.fn().mockResolvedValue({ data: [] })))).rejects.toThrow(
			'malformed',
		);
		const repeated = vi
			.fn()
			.mockResolvedValueOnce(envelope([topic('a')], 'same'))
			.mockResolvedValueOnce(envelope([topic('b')], 'same'));
		await expect(run(context([base], repeated))).rejects.toThrow('repeated');
		for (const invalid of [
			{ ...base, returnAll: 'yes' },
			{ ...base, returnAll: false, limit: 0 },
			{ ...base, topicFilters: [] },
		])
			await expect(run(context([invalid], vi.fn()))).rejects.toThrow();
	});
});
