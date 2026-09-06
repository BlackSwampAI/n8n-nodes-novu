import type { IExecuteFunctions, IHttpRequestOptions, ILoadOptionsFunctions } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';
import { Novu } from '../nodes/Novu/Novu.node';
import { workflowProperties } from '../nodes/Novu/resources/workflow.description';

type Params = Record<string, unknown>;
const workflow = (id: string, name = `Workflow ${id}`) => ({
	_id: `internal-${id}`,
	workflowId: id,
	name,
	steps: [],
	data: { nested: { enabled: false } },
});
const raw = (data: unknown) => ({ data });
const list = (workflows: Params[], totalCount = workflows.length) => raw({ workflows, totalCount });
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
const loader = (request: (type: string, options: IHttpRequestOptions) => Promise<unknown>) =>
	({
		getCredentials: vi.fn().mockResolvedValue({ apiKey: 'secret', region: 'us' }),
		getNode: vi.fn().mockReturnValue({ name: 'Novu', type: 'novu', typeVersion: 1 }),
		helpers: { httpRequestWithAuthentication: vi.fn(request) },
	}) as unknown as ILoadOptionsFunctions;
const run = async (value: IExecuteFunctions) => (await new Novu().execute.call(value))[0];

describe('Workflow metadata and Get', () => {
	it('exposes only Get/Get Many and a searchable manual locator', () => {
		const operation = workflowProperties.find(({ name }) => name === 'operation');
		expect(
			operation?.options?.map((option) => ('value' in option ? option.value : undefined)),
		).toEqual(['get', 'getMany']);
		const locator = workflowProperties.find(({ name }) => name === 'workflowIdentifier');
		expect(locator).toMatchObject({ type: 'resourceLocator', required: true });
		expect(locator?.modes?.map(({ name }) => name)).toEqual(['list', 'id']);
		expect(locator?.modes?.[0].typeOptions?.searchListMethod).toBe('searchWorkflows');
		const status = workflowProperties
			.find(({ name }) => name === 'workflowFilters')
			?.options?.find((option) => 'name' in option && option.name === 'status');
		expect(status).toMatchObject({ type: 'multiOptions', default: [] });
		expect(
			status && 'options' in status
				? status.options?.map((option) => ('value' in option ? option.value : undefined))
				: undefined,
		).toEqual(['ACTIVE', 'ERROR', 'INACTIVE']);
	});

	it.each([
		['saved', 'saved'],
		[{ mode: 'list', value: 'listed' }, 'listed'],
		[{ mode: 'id', value: 'manual/id' }, 'manual/id'],
	])('gets and preserves a full workflow from %#', async (locator, id) => {
		const response = workflow(id as string);
		const request = vi.fn().mockResolvedValue(raw(response));
		await expect(
			run(
				context([{ resource: 'workflow', operation: 'get', workflowIdentifier: locator }], request),
			),
		).resolves.toEqual([{ json: response, pairedItem: 0 }]);
		expect(request).toHaveBeenCalledWith(
			'novuApi',
			expect.objectContaining({
				method: 'GET',
				url: `https://api.novu.co/v2/workflows/${encodeURIComponent(id as string)}`,
			}),
		);
	});

	it('rejects blank/malformed locators and malformed responses before output', async () => {
		for (const workflowIdentifier of [
			'',
			{},
			{ mode: 'other', value: 'x' },
			{ mode: 'id', value: '' },
		]) {
			const request = vi.fn();
			await expect(
				run(context([{ resource: 'workflow', operation: 'get', workflowIdentifier }], request)),
			).rejects.toThrow(/Workflow/);
			expect(request).not.toHaveBeenCalled();
		}
		await expect(
			run(
				context(
					[{ resource: 'workflow', operation: 'get', workflowIdentifier: 'x' }],
					vi.fn().mockResolvedValue({}),
				),
			),
		).rejects.toThrow('malformed workflow');
	});
});

describe('Workflow Get Many', () => {
	it('sends filters/order and enforces an exact limit', async () => {
		const request = vi.fn().mockResolvedValue(list([workflow('a'), workflow('b')], 5));
		const output = await run(
			context(
				[
					{
						resource: 'workflow',
						operation: 'getMany',
						returnAll: false,
						limit: 2,
						workflowFilters: { query: 'order', status: ['ACTIVE'], tags: ['sales'] },
						workflowListOptions: { orderBy: 'updatedAt', orderDirection: 'ASC' },
					},
				],
				request,
			),
		);
		expect(request).toHaveBeenCalledWith(
			'novuApi',
			expect.objectContaining({
				qs: {
					query: 'order',
					status: ['ACTIVE'],
					tags: ['sales'],
					orderBy: 'updatedAt',
					orderDirection: 'ASC',
					offset: 0,
					limit: 2,
				},
			}),
		);
		expect(output).toHaveLength(2);
	});

	it('paginates by offset, pairs each input, and emits zero for empty lists', async () => {
		const request = vi
			.fn()
			.mockResolvedValueOnce(list([workflow('a'), workflow('b')], 3))
			.mockResolvedValueOnce(list([workflow('c')], 3))
			.mockResolvedValueOnce(list([], 0));
		const output = await run(
			context(
				[
					{
						resource: 'workflow',
						operation: 'getMany',
						returnAll: true,
						workflowFilters: {},
						workflowListOptions: {},
					},
					{
						resource: 'workflow',
						operation: 'getMany',
						returnAll: true,
						workflowFilters: {},
						workflowListOptions: {},
					},
				],
				request,
			),
		);
		expect(request.mock.calls.map((call) => call[1].qs)).toEqual([
			{ offset: 0, limit: 100 },
			{ offset: 2, limit: 100 },
			{ offset: 0, limit: 100 },
		]);
		expect(output.map(({ pairedItem }) => pairedItem)).toEqual([0, 0, 0]);
	});

	it('rejects invalid input, malformed envelopes, and no-progress pages', async () => {
		for (const extra of [
			{ returnAll: 'yes' },
			{ returnAll: false, limit: 0 },
			{ returnAll: true, workflowFilters: { query: 1 } },
			{ returnAll: true, workflowFilters: { unknown: 'x' } },
			{ returnAll: true, workflowListOptions: { orderBy: 'bad' } },
			{ returnAll: true, workflowListOptions: { orderDirection: 'UP' } },
			{ returnAll: true, workflowFilters: { status: 'ACTIVE' } },
			{ returnAll: true, workflowFilters: { status: ['PAUSED'] } },
		])
			await expect(
				run(
					context(
						[
							{
								resource: 'workflow',
								operation: 'getMany',
								workflowFilters: {},
								workflowListOptions: {},
								...extra,
							},
						],
						vi.fn(),
					),
				),
			).rejects.toThrow();
		for (const response of [{}, list([{}]), list([], 1)])
			await expect(
				run(
					context(
						[
							{
								resource: 'workflow',
								operation: 'getMany',
								returnAll: true,
								workflowFilters: {},
								workflowListOptions: {},
							},
						],
						vi.fn().mockResolvedValue(response),
					),
				),
			).rejects.toThrow(/malformed|progress/);
		await expect(
			run(
				context(
					[
						{
							resource: 'workflow',
							operation: 'getMany',
							returnAll: false,
							limit: 1,
							workflowFilters: {},
							workflowListOptions: {},
						},
					],
					vi.fn().mockResolvedValue(list([workflow('one'), workflow('extra')], 2)),
				),
			),
		).rejects.toThrow('malformed workflow list');
	});

	it('resolves per item and continues after a denied list', async () => {
		const request = vi
			.fn()
			.mockRejectedValueOnce({ statusCode: 403 })
			.mockResolvedValueOnce(list([workflow('ok')], 1));
		await expect(
			run(
				context(
					[
						{
							resource: 'workflow',
							operation: 'getMany',
							returnAll: false,
							limit: 1,
							workflowFilters: {},
							workflowListOptions: {},
						},
						{
							resource: 'workflow',
							operation: 'getMany',
							returnAll: false,
							limit: 1,
							workflowFilters: {},
							workflowListOptions: {},
						},
					],
					request,
					true,
				),
			),
		).resolves.toEqual([
			{ json: { error: expect.stringContaining('permission') }, pairedItem: 0 },
			{ json: workflow('ok'), pairedItem: 1 },
		]);
	});
});

describe('Workflow list search', () => {
	const search = new Novu().methods?.listSearch?.searchWorkflows;
	if (!search) throw new Error('Workflow list search method is not registered');

	it('uses workflowId values, useful names, filter, and pagination token', async () => {
		const request = vi.fn().mockResolvedValue(list([workflow('first', 'Welcome')], 4));
		const result = await search!.call(loader(request), 'wel', '2');
		expect(request).toHaveBeenCalledWith(
			'novuApi',
			expect.objectContaining({ qs: { limit: 100, offset: 2, query: 'wel' } }),
		);
		expect(result).toEqual({
			results: [{ name: 'Welcome (first)', value: 'first' }],
			paginationToken: '3',
		});
	});

	it('returns an empty result for a wrapped empty workflow page', async () => {
		await expect(search!.call(loader(vi.fn().mockResolvedValue(list([]))))).resolves.toEqual({
			results: [],
		});
	});

	it('validates tokens, malformed/no-progress responses, and propagates errors', async () => {
		for (const token of ['', '-1', '1.5', '01'])
			await expect(search!.call(loader(vi.fn()), undefined, token)).rejects.toThrow('token');
		await expect(search!.call(loader(vi.fn().mockResolvedValue(list([], 1))))).rejects.toThrow(
			'progress',
		);
		await expect(
			search!.call(loader(vi.fn().mockResolvedValue({ workflows: [{}], totalCount: 1 }))),
		).rejects.toThrow('malformed workflow');
		await expect(
			search!.call(
				loader(
					vi
						.fn()
						.mockResolvedValue(list(Array.from({ length: 101 }, (_, i) => workflow(String(i))))),
				),
			),
		).rejects.toThrow('malformed workflow list');
		await expect(search!.call(loader(vi.fn()), 1 as unknown as string)).rejects.toThrow('filter');
		await expect(
			search!.call(loader(vi.fn().mockRejectedValue({ statusCode: 403 }))),
		).rejects.toThrow('permission');
	});
});
