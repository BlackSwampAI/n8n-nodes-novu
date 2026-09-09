import type {
	DeclarativeRestApiSettings,
	IExecutePaginationFunctions,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	IN8nHttpFullResponse,
	INodeExecutionData,
	INodePropertyOptions,
	INodeProperties,
} from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';

import { Novu } from '../nodes/Novu/Novu.node';
import {
	paginateSubscribers,
	prepareCancel,
	preparePreferences,
	prepareSubscriber,
	receiveSubscriber,
} from '../nodes/Novu/resources/routing';

const context = (parameters: Record<string, unknown>) =>
	({
		getItemIndex: () => 0,
		getNode: () => ({ name: 'Novu', type: 'novu', typeVersion: 1 }),
		getNodeParameter: (name: string, fallback?: unknown) =>
			Object.prototype.hasOwnProperty.call(parameters, name) ? parameters[name] : fallback,
	}) as unknown as IExecuteSingleFunctions;

const operations = (properties: INodeProperties[]) =>
	properties
		.filter(({ name }) => name === 'operation')
		.flatMap(({ options }) => options ?? [])
		.filter((option): option is Exclude<typeof option, string> => typeof option !== 'string');

describe('declarative-first node architecture', () => {
	it('routes all 18 ordinary operations and keeps only trigger as a custom operation', () => {
		const node = new Novu();
		expect('execute' in node).toBe(false);
		expect(node.description.requestDefaults).toMatchObject({
			json: true,
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
		});
		const routed = operations(node.description.properties).filter(
			(option) => 'routing' in option && option.routing,
		);
		expect(routed).toHaveLength(18);
		expect(node.customOperations).toEqual({
			notification: { triggerWorkflow: expect.any(Function) },
		});
	});

	it('wires every ordinary operation to the expected declarative hooks', () => {
		const expected = [
			['notification', 'cancelExecution', 'prepareCancel', 'receiveCancel', undefined],
			['subscriber', 'createOrUpdate', 'prepareSubscriber', 'receiveSubscriber', undefined],
			['subscriber', 'delete', 'prepareSubscriber', 'receiveSubscriberDelete', undefined],
			['subscriber', 'get', 'prepareSubscriber', 'receiveSubscriber', undefined],
			['subscriber', 'getMany', 'prepareSubscriber', '', ''],
			['subscriber', 'update', 'prepareSubscriber', 'receiveSubscriber', undefined],
			['subscriberPreference', 'get', 'preparePreferences', 'receivePreferences', undefined],
			['subscriberPreference', 'update', 'preparePreferences', 'receivePreferences', undefined],
			['topic', 'createOrUpdate', 'prepareTopic', 'receiveTopic', undefined],
			['topic', 'delete', 'prepareTopic', 'receiveTopicDelete', undefined],
			['topic', 'get', 'prepareTopic', 'receiveTopic', undefined],
			['topic', 'getMany', 'prepareTopic', '', ''],
			['topic', 'update', 'prepareTopic', 'receiveTopic', undefined],
			[
				'topicSubscription',
				'create',
				'prepareTopicSubscription',
				'receiveTopicSubscriptionMutation',
				undefined,
			],
			[
				'topicSubscription',
				'delete',
				'prepareTopicSubscription',
				'receiveTopicSubscriptionMutation',
				undefined,
			],
			['topicSubscription', 'getMany', 'prepareTopicSubscription', '', ''],
			['workflow', 'get', 'prepareWorkflow', 'receiveWorkflow', undefined],
			['workflow', 'getMany', 'prepareWorkflow', 'receiveWorkflowList', 'paginateWorkflows'],
		] as const;
		const node = new Novu();
		for (const [resource, operation, preSend, postReceive, pagination] of expected) {
			const property = node.description.properties.find(
				(candidate) =>
					candidate.name === 'operation' &&
					candidate.displayOptions?.show?.resource?.includes(resource),
			);
			const option = ((property?.options ?? []) as INodePropertyOptions[]).find(
				(candidate) => candidate.value === operation,
			);
			if (!option) throw new Error(`Missing ${resource}/${operation}`);
			expect(option.routing?.request?.url?.toString().startsWith('/')).toBe(true);
			expect(option.routing?.send?.preSend?.[0]).toHaveProperty('name', preSend);
			expect(option.routing?.output?.postReceive?.[0]).toHaveProperty('name', postReceive);
			if (pagination !== undefined) {
				expect(typeof option.routing?.operations?.pagination).toBe('function');
				if (pagination)
					expect(option.routing?.operations?.pagination).toHaveProperty('name', pagination);
			}
		}
		expect(node.description.requestDefaults?.baseURL).toBe('https://api.novu.co');
	});

	it('builds encoded declarative routes and preserves omitted preference query values', async () => {
		await expect(
			prepareCancel.call(context({ cancelTransactionId: 'tx/a b' }), {} as IHttpRequestOptions),
		).resolves.toMatchObject({ method: 'DELETE', url: '/v1/events/trigger/tx%2Fa%20b' });
		await expect(
			preparePreferences.call(
				context({ operation: 'get', subscriberId: 'user/a', criticality: '', contextKeys: [] }),
				{} as IHttpRequestOptions,
			),
		).resolves.toEqual({ method: 'GET', url: '/v2/subscribers/user%2Fa/preferences' });
	});

	it('builds subscriber writes and validates one raw response envelope', async () => {
		const requestContext = context({
			operation: 'createOrUpdate',
			subscriberId: 'customer-1',
			fields: { data: '{"active":false,"score":0}' },
			clearFields: [],
			failIfExists: true,
		});
		await expect(
			prepareSubscriber.call(requestContext, {} as IHttpRequestOptions),
		).resolves.toMatchObject({
			method: 'POST',
			url: '/v2/subscribers',
			qs: { failIfExists: true },
			body: { subscriberId: 'customer-1', data: { active: false, score: 0 } },
		});
		const response = {
			statusCode: 200,
			headers: {},
			body: { data: { subscriberId: 'customer-1', data: { nested: true } } },
		} as IN8nHttpFullResponse;
		await expect(receiveSubscriber.call(requestContext, [], response)).resolves.toEqual([
			{ json: { subscriberId: 'customer-1', data: { nested: true } } },
		]);
	});

	it('uses routing pagination with exact limits and rejects repeated cursors', async () => {
		const pages: INodeExecutionData[][] = [
			[{ json: { data: [{ subscriberId: 'a' }], next: 'cursor-1' } }],
			[{ json: { data: [{ subscriberId: 'b' }], next: null } }],
		];
		const paginationContext = {
			...context({ returnAll: false, limit: 2 }),
			makeRoutingRequest: vi.fn(async () => pages.shift() ?? []),
		} as unknown as IExecutePaginationFunctions;
		const request = {
			options: { qs: { limit: 2 } },
		} as unknown as DeclarativeRestApiSettings.ResultOptions;
		await expect(paginateSubscribers.call(paginationContext, request)).resolves.toEqual([
			{ json: { subscriberId: 'a' } },
			{ json: { subscriberId: 'b' } },
		]);

		const repeated = {
			...context({ returnAll: true }),
			makeRoutingRequest: vi.fn(async () => [
				{ json: { data: [{ subscriberId: 'a' }], next: 'same' } },
			]),
		} as unknown as IExecutePaginationFunctions;
		await expect(paginateSubscribers.call(repeated, request)).rejects.toThrow('repeated');

		const noProgress = {
			...context({ returnAll: true }),
			makeRoutingRequest: vi.fn(async () => [{ json: { data: [], next: 'next' } }]),
		} as unknown as IExecutePaginationFunctions;
		await expect(paginateSubscribers.call(noProgress, request)).rejects.toThrow('no progress');
	});
});
