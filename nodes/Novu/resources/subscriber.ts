import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { unwrapNovuDataEnvelope } from '../shared/response';
import { novuApiRequest } from '../shared/transport';

const PROFILE_FIELDS = [
	'firstName',
	'lastName',
	'email',
	'phone',
	'avatar',
	'locale',
	'timezone',
	'data',
] as const;

type ProfileField = (typeof PROFILE_FIELDS)[number];

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

const getSubscriberId = (context: IExecuteFunctions, itemIndex: number): string => {
	const subscriberId = context.getNodeParameter('subscriberId', itemIndex);
	if (typeof subscriberId !== 'string' || subscriberId.length === 0) {
		throw localError(context, 'External Subscriber ID must be a non-empty string', itemIndex);
	}
	return subscriberId;
};

export const parseCustomData = (
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
	if (!isObject(parsed)) {
		throw localError(context, 'Custom Data must be a JSON object or null', itemIndex);
	}
	return parsed;
};

export const buildSubscriberBody = (
	context: IExecuteFunctions,
	itemIndex: number,
	includeSubscriberId: boolean,
): IDataObject => {
	const body: IDataObject = {};
	if (includeSubscriberId) {
		body.subscriberId = getSubscriberId(context, itemIndex);
	}
	const fields = context.getNodeParameter('fields', itemIndex, {}) as IDataObject;
	const rawClearFields = context.getNodeParameter('clearFields', itemIndex, []);
	if (
		!Array.isArray(rawClearFields) ||
		!rawClearFields.every(
			(field): field is ProfileField =>
				typeof field === 'string' && PROFILE_FIELDS.includes(field as ProfileField),
		)
	) {
		throw localError(
			context,
			'Clear Fields contains an invalid subscriber field selection',
			itemIndex,
		);
	}
	const clearFields = rawClearFields;

	for (const field of PROFILE_FIELDS) {
		if (Object.prototype.hasOwnProperty.call(fields, field)) {
			if (clearFields.includes(field)) {
				throw localError(
					context,
					`${field} cannot be both supplied and selected for null clearing`,
					itemIndex,
				);
			}
			body[field] =
				field === 'data' ? parseCustomData(context, fields[field], itemIndex) : fields[field];
		}
	}
	for (const field of clearFields) body[field] = null;
	return body;
};

const assertSubscriber = (
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): IDataObject => {
	if (!isObject(value) || typeof value.subscriberId !== 'string')
		throw localError(context, 'Novu returned a malformed subscriber', itemIndex);
	return value;
};

const assertCursorEnvelope = (
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): CursorEnvelope => {
	if (!isObject(value))
		throw localError(context, 'Novu returned a malformed subscriber list', itemIndex);
	const { data, next, previous, totalCount, totalCountCapped } = value;
	if (
		!Array.isArray(data) ||
		!data.every(isObject) ||
		!(next === null || typeof next === 'string') ||
		!(previous === null || typeof previous === 'string') ||
		next === '' ||
		previous === '' ||
		typeof totalCount !== 'number' ||
		typeof totalCountCapped !== 'boolean'
	) {
		throw localError(context, 'Novu returned a malformed subscriber cursor envelope', itemIndex);
	}
	return { data: data as IDataObject[], next, previous, totalCount, totalCountCapped };
};

const executeGetMany = async (
	context: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> => {
	const returnAll = context.getNodeParameter('returnAll', itemIndex) as boolean;
	const requestedLimit = returnAll
		? Number.POSITIVE_INFINITY
		: (context.getNodeParameter('limit', itemIndex) as number);
	const filters = context.getNodeParameter('filters', itemIndex, {}) as IDataObject;
	const listOptions = context.getNodeParameter('listOptions', itemIndex, {}) as IDataObject;
	const output: INodeExecutionData[] = [];
	const seenCursors = new Set<string>();
	let after: string | undefined;

	while (output.length < requestedLimit) {
		const remaining = requestedLimit - output.length;
		const qs: IDataObject = {
			...filters,
			...listOptions,
			limit: Number.isFinite(remaining) ? Math.min(remaining, 100) : 100,
			...(after ? { after } : {}),
		};
		const response = assertCursorEnvelope(
			context,
			await novuApiRequest(context, {
				method: 'GET',
				version: 'v2',
				pathSegments: ['subscribers'],
				qs,
				itemIndex,
			}),
			itemIndex,
		);
		for (const subscriber of response.data.slice(0, remaining)) {
			output.push({ json: subscriber, pairedItem: itemIndex });
		}
		if (!response.next || output.length >= requestedLimit) break;
		if (seenCursors.has(response.next)) {
			throw localError(context, 'Novu returned a repeated subscriber pagination cursor', itemIndex);
		}
		seenCursors.add(response.next);
		after = response.next;
	}
	return output;
};

const mapDeleteResponse = (
	context: IExecuteFunctions,
	subscriberId: string,
	response: unknown,
	itemIndex: number,
): IDataObject => {
	if (
		!isObject(response) ||
		typeof response.acknowledged !== 'boolean' ||
		typeof response.status !== 'string'
	)
		throw localError(
			context,
			'Novu returned a malformed subscriber delete acknowledgment',
			itemIndex,
		);
	return { subscriberId, acknowledged: response.acknowledged, status: response.status };
};

export const executeSubscriberOperation = async (
	context: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> => {
	if (operation === 'getMany') return await executeGetMany(context, itemIndex);
	const subscriberId = getSubscriberId(context, itemIndex);

	if (operation === 'createOrUpdate') {
		const body = buildSubscriberBody(context, itemIndex, true);
		const failIfExists = context.getNodeParameter('failIfExists', itemIndex, false) as boolean;
		const response = unwrapNovuDataEnvelope(
			await novuApiRequest(context, {
				method: 'POST',
				version: 'v2',
				pathSegments: ['subscribers'],
				body,
				...(failIfExists ? { qs: { failIfExists: true } } : {}),
				itemIndex,
			}),
		);
		return [{ json: assertSubscriber(context, response, itemIndex), pairedItem: itemIndex }];
	}

	if (operation === 'get') {
		const response = unwrapNovuDataEnvelope(
			await novuApiRequest(context, {
				method: 'GET',
				version: 'v2',
				pathSegments: ['subscribers', subscriberId],
				itemIndex,
			}),
		);
		return [{ json: assertSubscriber(context, response, itemIndex), pairedItem: itemIndex }];
	}

	if (operation === 'update') {
		const body = buildSubscriberBody(context, itemIndex, false);
		if (!Object.keys(body).length) {
			throw localError(
				context,
				'Select at least one subscriber field to update or clear',
				itemIndex,
			);
		}
		const response = unwrapNovuDataEnvelope(
			await novuApiRequest(context, {
				method: 'PATCH',
				version: 'v2',
				pathSegments: ['subscribers', subscriberId],
				body,
				itemIndex,
			}),
		);
		return [{ json: assertSubscriber(context, response, itemIndex), pairedItem: itemIndex }];
	}

	if (operation === 'delete') {
		const response = unwrapNovuDataEnvelope(
			await novuApiRequest(context, {
				method: 'DELETE',
				version: 'v2',
				pathSegments: ['subscribers', subscriberId],
				itemIndex,
			}),
		);
		return [
			{
				json: mapDeleteResponse(context, subscriberId, response, itemIndex),
				pairedItem: itemIndex,
			},
		];
	}

	throw localError(context, `Unsupported Subscriber operation: ${operation}`, itemIndex);
};
