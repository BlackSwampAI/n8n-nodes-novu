import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { novuApiRequest } from '../shared/transport';

interface CursorEnvelope {
	data: IDataObject[];
	next: string | null;
	previous: string | null;
	totalCount: number;
	totalCountCapped: boolean;
}
const isObject = (value: unknown): value is IDataObject =>
	typeof value === 'object' && value !== null && !Array.isArray(value);
const localError = (context: IExecuteFunctions, message: string, itemIndex: number) =>
	new NodeOperationError(context.getNode(), message, { itemIndex });

const getTopicKey = (context: IExecuteFunctions, itemIndex: number): string => {
	const value = context.getNodeParameter('topicKey', itemIndex);
	if (typeof value !== 'string' || value.length === 0 || value.length > 100)
		throw localError(
			context,
			'Topic Key must be a non-empty string of at most 100 characters',
			itemIndex,
		);
	return value;
};
const validName = (context: IExecuteFunctions, value: unknown, itemIndex: number): string => {
	if (typeof value !== 'string' || [...value].length > 100)
		throw localError(context, 'Display Name must be a string of at most 100 characters', itemIndex);
	return value;
};
const parseData = (
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): IDataObject | null => {
	let parsed = value;
	if (typeof value === 'string') {
		try {
			parsed = JSON.parse(value) as unknown;
		} catch {
			throw localError(context, 'Custom Data must contain valid JSON', itemIndex);
		}
	}
	if (parsed === null) return null;
	if (!isObject(parsed))
		throw localError(context, 'Custom Data must be a flat JSON object or null', itemIndex);
	for (const entry of Object.values(parsed)) {
		if (
			typeof entry === 'string' ||
			(typeof entry === 'number' && Number.isFinite(entry)) ||
			typeof entry === 'boolean'
		)
			continue;
		if (Array.isArray(entry) && entry.every((item) => typeof item === 'string')) continue;
		throw localError(
			context,
			'Custom Data values must be strings, numbers, booleans, or string arrays',
			itemIndex,
		);
	}
	if (new TextEncoder().encode(JSON.stringify(parsed)).length > 64 * 1024)
		throw localError(context, 'Custom Data must not exceed 64 KB', itemIndex);
	return parsed;
};
const assertTopic = (
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): IDataObject => {
	if (!isObject(value) || typeof value._id !== 'string' || typeof value.key !== 'string')
		throw localError(context, 'Novu returned a malformed topic', itemIndex);
	return value;
};
const assertEnvelope = (
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): CursorEnvelope => {
	if (!isObject(value))
		throw localError(context, 'Novu returned a malformed topic list', itemIndex);
	const { data, next, previous, totalCount, totalCountCapped } = value;
	if (
		!Array.isArray(data) ||
		!data.every(
			(topic) => isObject(topic) && typeof topic._id === 'string' && typeof topic.key === 'string',
		) ||
		!(next === null || typeof next === 'string') ||
		!(previous === null || typeof previous === 'string') ||
		next === '' ||
		previous === '' ||
		typeof totalCount !== 'number' ||
		typeof totalCountCapped !== 'boolean'
	)
		throw localError(context, 'Novu returned a malformed topic cursor envelope', itemIndex);
	return { data: data as IDataObject[], next, previous, totalCount, totalCountCapped };
};

const getMany = async (
	context: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> => {
	const returnAll = context.getNodeParameter('returnAll', itemIndex);
	if (typeof returnAll !== 'boolean')
		throw localError(context, 'Return All must be a boolean', itemIndex);
	const limit = returnAll ? Number.POSITIVE_INFINITY : context.getNodeParameter('limit', itemIndex);
	if (!returnAll && (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1))
		throw localError(context, 'Limit must be a positive integer', itemIndex);
	const filters = context.getNodeParameter('topicFilters', itemIndex, {});
	const options = context.getNodeParameter('topicListOptions', itemIndex, {});
	if (!isObject(filters) || !isObject(options))
		throw localError(context, 'Topic list filters and options must be objects', itemIndex);
	const filterValues = filters as IDataObject;
	const optionValues = options as IDataObject;
	if (
		Object.keys(filterValues).some((key) => !['key', 'name'].includes(key)) ||
		Object.keys(optionValues).some((key) => !['orderBy', 'orderDirection'].includes(key))
	)
		throw localError(context, 'Topic list contains an unsupported filter or option', itemIndex);
	const baseQuery: IDataObject = {};
	for (const field of ['key', 'name'] as const) {
		const value = filterValues[field];
		if (value !== undefined && typeof value !== 'string')
			throw localError(context, `${field} topic filter must be a string`, itemIndex);
		if (value) baseQuery[field] = value;
	}
	const orderBy = optionValues.orderBy;
	if (orderBy !== undefined && typeof orderBy !== 'string')
		throw localError(context, 'Order By must be a string', itemIndex);
	if (orderBy) baseQuery.orderBy = orderBy;
	const orderDirection = optionValues.orderDirection;
	if (orderDirection !== undefined && orderDirection !== 'ASC' && orderDirection !== 'DESC')
		throw localError(context, 'Order Direction must be ASC or DESC', itemIndex);
	if (orderDirection) baseQuery.orderDirection = orderDirection;
	const output: INodeExecutionData[] = [];
	const seen = new Set<string>();
	let after: string | undefined;
	while (output.length < limit) {
		const remaining = limit - output.length;
		const qs: IDataObject = {
			...baseQuery,
			limit: Number.isFinite(remaining) ? Math.min(remaining, 100) : 100,
			...(after ? { after } : {}),
		};
		const response = assertEnvelope(
			context,
			await novuApiRequest(context, {
				method: 'GET',
				version: 'v2',
				pathSegments: ['topics'],
				qs,
				itemIndex,
			}),
			itemIndex,
		);
		for (const topic of response.data.slice(0, remaining))
			output.push({ json: topic, pairedItem: itemIndex });
		if (!response.next || output.length >= limit) break;
		if (seen.has(response.next))
			throw localError(context, 'Novu returned a repeated topic pagination cursor', itemIndex);
		seen.add(response.next);
		after = response.next;
	}
	return output;
};

export const executeTopicOperation = async (
	context: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> => {
	if (operation === 'getMany') return await getMany(context, itemIndex);
	const key = getTopicKey(context, itemIndex);
	if (operation === 'createOrUpdate') {
		const fields = context.getNodeParameter('topicFields', itemIndex, {});
		if (!isObject(fields)) throw localError(context, 'Fields must be an object', itemIndex);
		const selectedFields = fields as IDataObject;
		const body: IDataObject = { key };
		if (Object.prototype.hasOwnProperty.call(selectedFields, 'name'))
			body.name = validName(context, selectedFields.name, itemIndex);
		if (Object.prototype.hasOwnProperty.call(selectedFields, 'data'))
			body.data = parseData(context, selectedFields.data, itemIndex);
		const strict = context.getNodeParameter('failIfExists', itemIndex, false);
		if (typeof strict !== 'boolean')
			throw localError(context, 'Fail If Topic Exists must be a boolean', itemIndex);
		const response = await novuApiRequest(context, {
			method: 'POST',
			version: 'v2',
			pathSegments: ['topics'],
			body,
			...(strict ? { qs: { failIfExists: true } } : {}),
			itemIndex,
		});
		return [{ json: assertTopic(context, response, itemIndex), pairedItem: itemIndex }];
	}
	if (operation === 'get') {
		const response = await novuApiRequest(context, {
			method: 'GET',
			version: 'v2',
			pathSegments: ['topics', key],
			itemIndex,
		});
		return [{ json: assertTopic(context, response, itemIndex), pairedItem: itemIndex }];
	}
	if (operation === 'update') {
		const name = validName(context, context.getNodeParameter('topicName', itemIndex), itemIndex);
		if (name.length === 0)
			throw localError(context, 'Display Name must be non-empty when updating a topic', itemIndex);
		const response = await novuApiRequest(context, {
			method: 'PATCH',
			version: 'v2',
			pathSegments: ['topics', key],
			body: { name },
			itemIndex,
		});
		return [{ json: assertTopic(context, response, itemIndex), pairedItem: itemIndex }];
	}
	if (operation === 'delete') {
		const response = await novuApiRequest<unknown>(context, {
			method: 'DELETE',
			version: 'v2',
			pathSegments: ['topics', key],
			itemIndex,
		});
		if (!isObject(response) || typeof response.acknowledged !== 'boolean')
			throw localError(context, 'Novu returned a malformed topic delete acknowledgment', itemIndex);
		return [
			{ json: { topicKey: key, acknowledged: response.acknowledged }, pairedItem: itemIndex },
		];
	}
	throw localError(context, `Unsupported Topic operation: ${operation}`, itemIndex);
};
