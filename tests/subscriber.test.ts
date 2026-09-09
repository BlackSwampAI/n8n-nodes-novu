import type { IExecuteFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';

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

const run = runDeclarative;

const subscriber = (subscriberId: string) => ({ subscriberId, data: { active: false, score: 0 } });
const raw = (data: unknown) => ({ data });

const envelope = (data: Record<string, unknown>[], next: string | null = null) => ({
	data,
	next,
	previous: null,
	totalCount: data.length,
	totalCountCapped: false,
});

describe('Subscriber create or update', () => {
	it('resolves distinct items, preserves JSON values, and links output', async () => {
		const request = vi.fn(async (_type: string, options: IHttpRequestOptions) => raw(options.body));
		const context = makeContext(
			[
				{
					resource: 'subscriber',
					operation: 'createOrUpdate',
					subscriberId: 'first',
					fields: { firstName: 'One', data: '{"active":false,"score":0,"nested":{"x":1}}' },
					clearFields: [],
					failIfExists: false,
				},
				{
					resource: 'subscriber',
					operation: 'createOrUpdate',
					subscriberId: 'second',
					fields: { firstName: '', email: '' },
					clearFields: ['phone'],
					failIfExists: true,
				},
			],
			request,
		);

		await expect(run(context)).resolves.toEqual([
			{
				json: {
					subscriberId: 'first',
					firstName: 'One',
					data: { active: false, score: 0, nested: { x: 1 } },
				},
				pairedItem: 0,
			},
			{
				json: { subscriberId: 'second', firstName: '', email: '', phone: null },
				pairedItem: 1,
			},
		]);
		expect(request).toHaveBeenNthCalledWith(
			1,
			'novuApi',
			expect.objectContaining({
				method: 'POST',
				url: 'https://api.novu.co/v2/subscribers',
				body: expect.not.objectContaining({ email: expect.anything() }),
			}),
		);
		expect(request.mock.calls[0][1]).not.toHaveProperty('qs');
		expect(request).toHaveBeenNthCalledWith(
			2,
			'novuApi',
			expect.objectContaining({ qs: { failIfExists: true } }),
		);
	});

	it('rejects an empty external subscriber ID before requesting', async () => {
		const request = vi.fn();
		await expect(
			run(
				makeContext(
					[
						{
							resource: 'subscriber',
							operation: 'createOrUpdate',
							subscriberId: '',
							fields: {},
							clearFields: [],
						},
					],
					request,
				),
			),
		).rejects.toMatchObject({ context: { itemIndex: 0 } });
		expect(request).not.toHaveBeenCalled();
	});

	it.each(['not-json', '[]', '42'])('rejects invalid custom data %s at its item', async (data) => {
		const context = makeContext(
			[
				{
					resource: 'subscriber',
					operation: 'createOrUpdate',
					subscriberId: 'id',
					fields: { data },
					clearFields: [],
				},
			],
			vi.fn(),
		);
		await expect(run(context)).rejects.toMatchObject({ context: { itemIndex: 0 } });
	});

	it('accepts explicit null custom data', async () => {
		const request = vi.fn(async (_type: string, options: IHttpRequestOptions) => raw(options.body));
		const output = await run(
			makeContext(
				[
					{
						resource: 'subscriber',
						operation: 'createOrUpdate',
						subscriberId: 'id',
						fields: { data: 'null' },
						clearFields: [],
					},
				],
				request,
			),
		);
		expect(output[0].json.data).toBeNull();
	});
});

describe('Subscriber get and update', () => {
	it('gets an encoded external ID without unwrapping subscriber custom data', async () => {
		const response = { subscriberId: 'customer/a', data: { data: 'custom' } };
		const request = vi.fn().mockResolvedValue(raw(response));
		const output = await run(
			makeContext(
				[{ resource: 'subscriber', operation: 'get', subscriberId: 'customer/a' }],
				request,
			),
		);
		expect(request).toHaveBeenCalledWith(
			'novuApi',
			expect.objectContaining({ url: 'https://api.novu.co/v2/subscribers/customer%2Fa' }),
		);
		expect(output).toEqual([{ json: response, pairedItem: 0 }]);
	});

	it('rejects empty path IDs and malformed subscriber responses', async () => {
		const request = vi.fn();
		await expect(
			run(makeContext([{ resource: 'subscriber', operation: 'get', subscriberId: '' }], request)),
		).rejects.toMatchObject({ context: { itemIndex: 0 } });
		expect(request).not.toHaveBeenCalled();

		await expect(
			run(
				makeContext(
					[{ resource: 'subscriber', operation: 'get', subscriberId: 'id' }],
					vi.fn().mockResolvedValue({}),
				),
			),
		).rejects.toThrow('malformed subscriber');
	});

	it('patches only selected and explicitly null-cleared fields', async () => {
		const request = vi.fn(async (_type: string, options: IHttpRequestOptions) =>
			raw({
				subscriberId: 'id',
				...(options.body as object),
			}),
		);
		await run(
			makeContext(
				[
					{
						resource: 'subscriber',
						operation: 'update',
						subscriberId: 'id',
						fields: { firstName: '' },
						clearFields: ['data'],
					},
				],
				request,
			),
		);
		expect(request).toHaveBeenCalledWith(
			'novuApi',
			expect.objectContaining({ method: 'PATCH', body: { firstName: '', data: null } }),
		);
	});

	it('rejects no-op and conflicting patches locally', async () => {
		await expect(
			run(
				makeContext(
					[
						{
							resource: 'subscriber',
							operation: 'update',
							subscriberId: 'id',
							fields: {},
							clearFields: [],
						},
					],
					vi.fn(),
				),
			),
		).rejects.toThrow('Select at least one');
		await expect(
			run(
				makeContext(
					[
						{
							resource: 'subscriber',
							operation: 'update',
							subscriberId: 'id',
							fields: { email: '' },
							clearFields: ['email'],
						},
					],
					vi.fn(),
				),
			),
		).rejects.toThrow('both supplied and selected');
	});

	it.each(['email', ['unknown']])(
		'rejects invalid clear field selections %#',
		async (clearFields) => {
			await expect(
				run(
					makeContext(
						[
							{
								resource: 'subscriber',
								operation: 'update',
								subscriberId: 'id',
								fields: {},
								clearFields,
							},
						],
						vi.fn(),
					),
				),
			).rejects.toThrow('invalid subscriber field selection');
		},
	);

	it('continues after a not-found item while stop mode throws', async () => {
		const parameters = [
			{ resource: 'subscriber', operation: 'get', subscriberId: 'missing' },
			{ resource: 'subscriber', operation: 'get', subscriberId: 'present' },
		];
		const request = vi.fn(async (_type: string, options: IHttpRequestOptions) => {
			if (options.url.endsWith('/missing')) throw { statusCode: 404 };
			return raw(subscriber('present'));
		});
		await expect(run(makeContext(parameters, request))).rejects.toThrow('resource or route');
		await expect(run(makeContext(parameters, request, true))).resolves.toEqual([
			{ json: { error: expect.stringContaining('resource or route') }, pairedItem: 0 },
			{ json: subscriber('present'), pairedItem: 1 },
		]);
	});
});

describe('Subscriber get many', () => {
	it('forwards filters/options, paginates, and enforces the exact limit', async () => {
		const request = vi
			.fn()
			.mockResolvedValueOnce(envelope([subscriber('a'), subscriber('b')], 'cursor-2'))
			.mockResolvedValueOnce(envelope([subscriber('c'), subscriber('d')], null));
		const output = await run(
			makeContext(
				[
					{
						resource: 'subscriber',
						operation: 'getMany',
						returnAll: false,
						limit: 3,
						filters: { email: 'person@example.com', subscriberId: 'customer' },
						listOptions: { orderDirection: 'ASC' },
					},
				],
				request,
			),
		);
		expect(output.map(({ json, pairedItem }) => [json.subscriberId, pairedItem])).toEqual([
			['a', 0],
			['b', 0],
			['c', 0],
		]);
		expect(request).toHaveBeenNthCalledWith(
			1,
			'novuApi',
			expect.objectContaining({
				qs: expect.objectContaining({
					email: 'person@example.com',
					subscriberId: 'customer',
					orderDirection: 'ASC',
					limit: 3,
				}),
			}),
		);
		expect(request).toHaveBeenNthCalledWith(
			2,
			'novuApi',
			expect.objectContaining({ qs: expect.objectContaining({ after: 'cursor-2', limit: 1 }) }),
		);
	});

	it('returns all pages and zero items for an empty list', async () => {
		const multi = vi
			.fn()
			.mockResolvedValueOnce(envelope([subscriber('a')], 'next'))
			.mockResolvedValueOnce(envelope([subscriber('b')]));
		const parameters = [
			{
				resource: 'subscriber',
				operation: 'getMany',
				returnAll: true,
				filters: {},
				listOptions: {},
			},
		];
		expect(
			(await run(makeContext(parameters, multi))).map(({ json }) => json.subscriberId),
		).toEqual(['a', 'b']);
		expect(await run(makeContext(parameters, vi.fn().mockResolvedValue(envelope([]))))).toEqual([]);
	});

	it('rejects malformed envelopes and repeated cursors', async () => {
		const parameters = [
			{
				resource: 'subscriber',
				operation: 'getMany',
				returnAll: true,
				filters: {},
				listOptions: {},
			},
		];
		await expect(
			run(makeContext(parameters, vi.fn().mockResolvedValue({ data: [] }))),
		).rejects.toThrow('malformed');
		await expect(
			run(makeContext(parameters, vi.fn().mockResolvedValue(envelope([], '')))),
		).rejects.toThrow('malformed');
		const repeated = vi
			.fn()
			.mockResolvedValueOnce(envelope([subscriber('a')], 'same'))
			.mockResolvedValueOnce(envelope([subscriber('b')], 'same'));
		await expect(run(makeContext(parameters, repeated))).rejects.toThrow('repeated');
	});

	it('links list outputs to each originating input item', async () => {
		const request = vi
			.fn()
			.mockResolvedValueOnce(envelope([subscriber('a')]))
			.mockResolvedValueOnce(envelope([subscriber('b')]));
		const params = [0, 1].map(() => ({
			resource: 'subscriber',
			operation: 'getMany',
			returnAll: true,
			filters: {},
			listOptions: {},
		}));
		expect(await run(makeContext(params, request))).toEqual([
			{ json: subscriber('a'), pairedItem: 0 },
			{ json: subscriber('b'), pairedItem: 1 },
		]);
	});
});

describe('Subscriber delete', () => {
	it('maps the wrapped mutation acknowledgment without leaking its transport envelope', async () => {
		const response = raw({ acknowledged: true, status: 'success' });
		const request = vi.fn().mockResolvedValue(response);
		expect(
			await run(
				makeContext([{ resource: 'subscriber', operation: 'delete', subscriberId: 'id' }], request),
			),
		).toEqual([
			{ json: { subscriberId: 'id', acknowledged: true, status: 'success' }, pairedItem: 0 },
		]);
		expect(request).toHaveBeenCalledWith('novuApi', expect.objectContaining({ method: 'DELETE' }));
	});

	it.each([{}, raw({}), raw(true)])('rejects malformed delete envelopes %#', async (response) => {
		await expect(
			run(
				makeContext(
					[{ resource: 'subscriber', operation: 'delete', subscriberId: 'id' }],
					vi.fn().mockResolvedValue(response),
				),
			),
		).rejects.toThrow(/malformed/);
	});
});
