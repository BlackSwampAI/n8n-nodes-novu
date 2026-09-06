import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { novuApiRequest } from '../shared/transport';

const isObject = (value: unknown): value is IDataObject =>
	typeof value === 'object' && value !== null && !Array.isArray(value);
const error = (context: IExecuteFunctions, message: string, itemIndex: number) =>
	new NodeOperationError(context.getNode(), message, { itemIndex });
const topicKey = (context: IExecuteFunctions, itemIndex: number): string => {
	const value = context.getNodeParameter('topicKey', itemIndex);
	if (typeof value !== 'string' || value.length === 0)
		throw error(context, 'Topic Key must be a non-empty string', itemIndex);
	return value;
};
const entries = (
	context: IExecuteFunctions,
	operation: 'create' | 'delete',
	itemIndex: number,
): IDataObject[] => {
	const raw = context.getNodeParameter('subscriptions', itemIndex);
	const collection = raw as IDataObject;
	if (
		!isObject(raw) ||
		!Array.isArray(collection.subscription) ||
		collection.subscription.length < 1 ||
		collection.subscription.length > 100
	)
		throw error(context, 'Subscriptions must contain between 1 and 100 entries', itemIndex);
	return (collection.subscription as IDataObject[]).map((entry, index) => {
		if (
			!isObject(entry) ||
			Object.keys(entry).some((key) => !['subscriberId', 'identifier'].includes(key))
		)
			throw error(context, `Subscription entry ${index + 1} is malformed`, itemIndex);
		const subscriberId = entry.subscriberId;
		const identifier = entry.identifier;
		if (subscriberId !== undefined && typeof subscriberId !== 'string')
			throw error(
				context,
				`Subscription entry ${index + 1} Subscriber ID must be a string`,
				itemIndex,
			);
		if (identifier !== undefined && typeof identifier !== 'string')
			throw error(
				context,
				`Subscription entry ${index + 1} Identifier must be a string`,
				itemIndex,
			);
		if (typeof identifier === 'string' && [...identifier].length > 512)
			throw error(
				context,
				`Subscription entry ${index + 1} Identifier must not exceed 512 characters`,
				itemIndex,
			);
		if (operation === 'create' && !subscriberId)
			throw error(context, `Subscription entry ${index + 1} requires a Subscriber ID`, itemIndex);
		if (operation === 'delete' && !subscriberId && !identifier)
			throw error(
				context,
				`Subscription entry ${index + 1} requires a Subscriber ID or Identifier`,
				itemIndex,
			);
		return { ...(subscriberId ? { subscriberId } : {}), ...(identifier ? { identifier } : {}) };
	});
};
const mutationEnvelope = (
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): IDataObject => {
	if (
		!isObject(value) ||
		!Array.isArray(value.data) ||
		!value.data.every(isObject) ||
		!isObject(value.meta) ||
		!['totalCount', 'successful', 'failed'].every(
			(key) =>
				typeof (value.meta as IDataObject)[key] === 'number' &&
				Number.isInteger((value.meta as IDataObject)[key]) &&
				((value.meta as IDataObject)[key] as number) >= 0,
		) ||
		(value.errors !== undefined && (!Array.isArray(value.errors) || !value.errors.every(isObject)))
	)
		throw error(
			context,
			'Novu returned a malformed topic subscription mutation envelope',
			itemIndex,
		);
	return value;
};
const cursorEnvelope = (context: IExecuteFunctions, value: unknown, itemIndex: number) => {
	if (
		!isObject(value) ||
		!Array.isArray(value.data) ||
		!value.data.every(isObject) ||
		!(value.next === null || typeof value.next === 'string') ||
		!(value.previous === null || typeof value.previous === 'string') ||
		value.next === '' ||
		value.previous === '' ||
		typeof value.totalCount !== 'number' ||
		typeof value.totalCountCapped !== 'boolean'
	)
		throw error(context, 'Novu returned a malformed topic subscription cursor envelope', itemIndex);
	return value as IDataObject & { data: IDataObject[]; next: string | null };
};

const getMany = async (
	context: IExecuteFunctions,
	key: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> => {
	const returnAll = context.getNodeParameter('returnAll', itemIndex);
	if (typeof returnAll !== 'boolean')
		throw error(context, 'Return All must be a boolean', itemIndex);
	const limit = returnAll ? Infinity : context.getNodeParameter('limit', itemIndex);
	if (!returnAll && (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1))
		throw error(context, 'Limit must be a positive integer', itemIndex);
	const rawFilters = context.getNodeParameter('subscriptionFilters', itemIndex, {});
	const rawOptions = context.getNodeParameter('subscriptionListOptions', itemIndex, {});
	if (!isObject(rawFilters) || !isObject(rawOptions))
		throw error(context, 'Subscription filters and options must be objects', itemIndex);
	const filters = rawFilters as IDataObject;
	const options = rawOptions as IDataObject;
	if (
		Object.keys(filters).some((name) => !['subscriberId', 'contextKeys'].includes(name)) ||
		Object.keys(options).some((name) => !['orderBy', 'orderDirection'].includes(name))
	)
		throw error(context, 'Unsupported subscription filter or option', itemIndex);
	const qsBase: IDataObject = {};
	const subscriberId = filters.subscriberId;
	const contextKeys = filters.contextKeys;
	if (subscriberId !== undefined && typeof subscriberId !== 'string')
		throw error(context, 'Subscriber ID filter must be a string', itemIndex);
	if (subscriberId) qsBase.subscriberId = subscriberId;
	if (
		contextKeys !== undefined &&
		(!Array.isArray(contextKeys) || !contextKeys.every((item) => typeof item === 'string'))
	)
		throw error(context, 'Context Keys must be an array of strings', itemIndex);
	if (Array.isArray(contextKeys) && contextKeys.length) qsBase.contextKeys = contextKeys;
	const orderBy = options.orderBy;
	const direction = options.orderDirection;
	if (orderBy !== undefined && typeof orderBy !== 'string')
		throw error(context, 'Order By must be a string', itemIndex);
	if (orderBy) qsBase.orderBy = orderBy;
	if (direction !== undefined && direction !== 'ASC' && direction !== 'DESC')
		throw error(context, 'Order Direction must be ASC or DESC', itemIndex);
	if (direction) qsBase.orderDirection = direction;
	const output: INodeExecutionData[] = [];
	const seen = new Set<string>();
	let after: string | undefined;
	while (output.length < limit) {
		const remaining = (limit as number) - output.length;
		const qs: IDataObject = {
			...qsBase,
			limit: Number.isFinite(remaining) ? Math.min(remaining, 100) : 100,
			...(after ? { after } : {}),
		};
		const response = cursorEnvelope(
			context,
			await novuApiRequest(context, {
				method: 'GET',
				version: 'v2',
				pathSegments: ['topics', key, 'subscriptions'],
				qs,
				itemIndex,
			}),
			itemIndex,
		);
		for (const subscription of response.data.slice(0, remaining))
			output.push({ json: subscription, pairedItem: itemIndex });
		if (!response.next || output.length >= limit) break;
		if (seen.has(response.next))
			throw error(context, 'Novu returned a repeated topic subscription cursor', itemIndex);
		seen.add(response.next);
		after = response.next;
	}
	return output;
};

export const executeTopicSubscriptionOperation = async (
	context: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> => {
	const key = topicKey(context, itemIndex);
	if (operation === 'getMany') return await getMany(context, key, itemIndex);
	if (operation !== 'create' && operation !== 'delete')
		throw error(context, `Unsupported Topic Subscription operation: ${operation}`, itemIndex);
	const subscriptions = entries(context, operation, itemIndex);
	const response = await novuApiRequest<unknown>(context, {
		method: operation === 'create' ? 'POST' : 'DELETE',
		version: 'v2',
		pathSegments: ['topics', key, 'subscriptions'],
		body: { subscriptions },
		itemIndex,
	});
	return [{ json: mutationEnvelope(context, response, itemIndex), pairedItem: itemIndex }];
};
