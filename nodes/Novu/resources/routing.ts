import type {
	DeclarativeRestApiSettings,
	IDataObject,
	IExecutePaginationFunctions,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	IN8nHttpFullResponse,
	INodeExecutionData,
} from 'n8n-workflow';

import {
	assertHttpSuccess,
	encodedParameter,
	isObject,
	one,
	receiveDirect,
	receiveWrapped,
	requiredString,
	routingError,
	setRequest,
	unwrapRawEnvelope,
} from '../shared/declarative';

const PAGE_SIZE = 100;
const CHANNELS = ['email', 'sms', 'in_app', 'push', 'chat', 'tool'];
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
const WORKFLOW_STATUSES = new Set(['ACTIVE', 'INACTIVE', 'ERROR']);
const WORKFLOW_ORDERS = new Set(['createdAt', 'updatedAt', 'name', 'lastTriggeredAt']);

const objectParameter = (
	context: IExecuteSingleFunctions,
	name: string,
	label: string,
): IDataObject => {
	const value = context.getNodeParameter(name, {});
	if (!isObject(value)) throw routingError(context, `${label} must be an object`);
	return value;
};

const assertSubscriber = (context: IExecuteSingleFunctions, value: unknown): IDataObject => {
	if (!isObject(value) || typeof value.subscriberId !== 'string')
		throw routingError(context, 'Novu returned a malformed subscriber');
	return value;
};

const subscriberBody = (
	context: IExecuteSingleFunctions,
	includeSubscriberId: boolean,
): IDataObject => {
	const body: IDataObject = {};
	if (includeSubscriberId)
		body.subscriberId = requiredString(context, 'subscriberId', 'External Subscriber ID');
	const fields = objectParameter(context, 'fields', 'Fields');
	const rawClearFields = context.getNodeParameter('clearFields', []);
	if (
		!Array.isArray(rawClearFields) ||
		!rawClearFields.every(
			(field) => typeof field === 'string' && PROFILE_FIELDS.includes(field as never),
		)
	)
		throw routingError(context, 'Clear Fields contains an invalid subscriber field selection');
	for (const field of PROFILE_FIELDS) {
		if (!Object.prototype.hasOwnProperty.call(fields, field)) continue;
		if (rawClearFields.includes(field))
			throw routingError(
				context,
				`${field} cannot be both supplied and selected for null clearing`,
			);
		let value = fields[field];
		if (field === 'data' && typeof value === 'string') {
			try {
				value = JSON.parse(value) as unknown as IDataObject;
			} catch {
				throw routingError(context, 'Custom Data must contain valid JSON');
			}
		}
		if (field === 'data' && value !== null && !isObject(value))
			throw routingError(context, 'Custom Data must be a JSON object or null');
		body[field] = value;
	}
	for (const field of rawClearFields) body[field] = null;
	return body;
};

const assertTopic = (context: IExecuteSingleFunctions, value: unknown): IDataObject => {
	if (!isObject(value) || typeof value._id !== 'string' || typeof value.key !== 'string')
		throw routingError(context, 'Novu returned a malformed topic');
	return value;
};

const assertPreferences = (context: IExecuteSingleFunctions, value: unknown): IDataObject => {
	if (!isObject(value) || !isObject(value.global) || !Array.isArray(value.workflows))
		throw routingError(context, 'Novu returned a malformed preference envelope');
	return value;
};

const assertWorkflow = (context: IExecuteSingleFunctions, value: unknown): IDataObject => {
	if (
		!isObject(value) ||
		typeof value.name !== 'string' ||
		!value.name ||
		typeof value._id !== 'string' ||
		!value._id ||
		typeof value.workflowId !== 'string' ||
		!value.workflowId
	)
		throw routingError(context, 'Novu returned a malformed workflow');
	return value;
};

const readLimit = (context: IExecuteSingleFunctions): number => {
	const returnAll = context.getNodeParameter('returnAll');
	if (typeof returnAll !== 'boolean') throw routingError(context, 'Return All must be a boolean');
	if (returnAll) return Number.POSITIVE_INFINITY;
	const limit = context.getNodeParameter('limit');
	if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1)
		throw routingError(context, 'Limit must be a positive integer');
	return limit;
};

const stringOption = (
	context: IExecuteSingleFunctions,
	value: unknown,
	label: string,
	allowed?: Set<string>,
): string | undefined => {
	if (value === undefined || value === '') return undefined;
	if (typeof value !== 'string') throw routingError(context, `${label} must be a string`);
	if (allowed && !allowed.has(value))
		throw routingError(context, `${label} contains an unsupported value`);
	return value;
};

const stringArray = (
	context: IExecuteSingleFunctions,
	value: unknown,
	label: string,
	allowed?: Set<string>,
): string[] | undefined => {
	if (value === undefined) return undefined;
	if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string' && entry.length))
		throw routingError(context, `${label} must be an array of non-empty strings`);
	if (allowed && value.some((entry) => !allowed.has(entry)))
		throw routingError(context, `${label} contains an unsupported value`);
	return value.length ? value : undefined;
};

const assertCursorEnvelope = (
	context: IExecuteSingleFunctions,
	value: unknown,
	entityValidator?: (entry: unknown) => boolean,
): IDataObject & { data: IDataObject[]; next: string | null } => {
	if (
		!isObject(value) ||
		!Array.isArray(value.data) ||
		!value.data.every((entry) => isObject(entry) && (!entityValidator || entityValidator(entry))) ||
		!(value.next === null || (typeof value.next === 'string' && value.next.length)) ||
		!(value.previous === null || (typeof value.previous === 'string' && value.previous.length)) ||
		typeof value.totalCount !== 'number' ||
		typeof value.totalCountCapped !== 'boolean'
	)
		throw routingError(context, 'Novu returned a malformed cursor envelope');
	return value as IDataObject & { data: IDataObject[]; next: string | null };
};

const receiveCursor = (entityValidator?: (entry: unknown) => boolean) =>
	async function (
		this: IExecuteSingleFunctions,
		_items: INodeExecutionData[],
		response: IN8nHttpFullResponse,
	) {
		assertHttpSuccess(this, response);
		return one(assertCursorEnvelope(this, response.body, entityValidator));
	};

const cursorPagination = (label: string) =>
	async function (
		this: IExecutePaginationFunctions,
		requestOptions: DeclarativeRestApiSettings.ResultOptions,
	): Promise<INodeExecutionData[]> {
		const limit = readLimit(this);
		const output: INodeExecutionData[] = [];
		const seen = new Set<string>();
		let current = requestOptions;
		while (output.length < limit) {
			const page = await this.makeRoutingRequest(current);
			if (page.length !== 1 || !isObject(page[0].json))
				throw routingError(this, `Novu returned a malformed ${label} pagination page`);
			const envelope = page[0].json as IDataObject & { data?: unknown; next?: unknown };
			if (!Array.isArray(envelope.data))
				throw routingError(this, `Novu returned a malformed ${label} pagination page`);
			const remaining = limit - output.length;
			for (const item of envelope.data.slice(0, remaining))
				output.push({ json: item as IDataObject });
			if (!envelope.next || output.length >= limit) return output;
			if (envelope.data.length === 0)
				throw routingError(this, `Novu ${label} pagination made no progress`);
			if (typeof envelope.next !== 'string' || seen.has(envelope.next))
				throw routingError(this, `Novu returned a repeated ${label} pagination cursor`);
			seen.add(envelope.next);
			const nextLimit = Number.isFinite(limit)
				? Math.min(limit - output.length, PAGE_SIZE)
				: PAGE_SIZE;
			current = {
				...current,
				options: {
					...current.options,
					qs: { ...(current.options.qs ?? {}), after: envelope.next, limit: nextLimit },
				},
			};
		}
		return output;
	};

export async function prepareSubscriber(
	this: IExecuteSingleFunctions,
	request: IHttpRequestOptions,
) {
	const operation = this.getNodeParameter('operation');
	if (operation === 'getMany') {
		const limit = readLimit(this);
		const filters = objectParameter(this, 'filters', 'Subscriber filters');
		const options = objectParameter(this, 'listOptions', 'Subscriber list options');
		if (
			Object.keys(filters).some((key) => !['email', 'name', 'phone', 'subscriberId'].includes(key))
		)
			throw routingError(this, 'Subscriber list contains an unsupported filter');
		if (Object.keys(options).some((key) => !['orderBy', 'orderDirection'].includes(key)))
			throw routingError(this, 'Subscriber list contains an unsupported option');
		const qs: IDataObject = {
			limit: Number.isFinite(limit) ? Math.min(limit, PAGE_SIZE) : PAGE_SIZE,
		};
		for (const key of ['email', 'name', 'phone', 'subscriberId']) {
			const value = stringOption(this, filters[key], `${key} subscriber filter`);
			if (value) qs[key] = value;
		}
		const orderBy = stringOption(this, options.orderBy, 'Order By');
		const direction = stringOption(
			this,
			options.orderDirection,
			'Order Direction',
			new Set(['ASC', 'DESC']),
		);
		if (orderBy) qs.orderBy = orderBy;
		if (direction) qs.orderDirection = direction;
		return setRequest(request, 'GET', '/v2/subscribers', undefined, qs);
	}
	const id = requiredString(this, 'subscriberId', 'External Subscriber ID');
	if (operation === 'createOrUpdate' || operation === 'update') {
		const body = subscriberBody(this, operation === 'createOrUpdate');
		if (operation === 'update' && !Object.keys(body).length)
			throw routingError(this, 'Select at least one subscriber field to update or clear');
		const strict = this.getNodeParameter('failIfExists', false);
		if (operation === 'createOrUpdate' && typeof strict !== 'boolean')
			throw routingError(this, 'Fail If Subscriber Exists must be a boolean');
		return setRequest(
			request,
			operation === 'createOrUpdate' ? 'POST' : 'PATCH',
			operation === 'createOrUpdate'
				? '/v2/subscribers'
				: `/v2/subscribers/${encodeURIComponent(id)}`,
			body,
			operation === 'createOrUpdate' && strict ? { failIfExists: true } : undefined,
		);
	}
	return setRequest(
		request,
		operation === 'delete' ? 'DELETE' : 'GET',
		`/v2/subscribers/${encodeURIComponent(id)}`,
	);
}

export async function receiveSubscriber(
	this: IExecuteSingleFunctions,
	_items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
) {
	return receiveWrapped(this, response, (value) => assertSubscriber(this, value));
}

export const receiveSubscriberList = receiveCursor(
	(entry) => typeof (entry as IDataObject).subscriberId === 'string',
);
export const paginateSubscribers = cursorPagination('subscriber');

export async function receiveSubscriberDelete(
	this: IExecuteSingleFunctions,
	_items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
) {
	assertHttpSuccess(this, response);
	const value = unwrapRawEnvelope(this, response.body);
	if (
		!isObject(value) ||
		typeof value.acknowledged !== 'boolean' ||
		typeof value.status !== 'string'
	)
		throw routingError(this, 'Novu returned a malformed subscriber delete acknowledgment');
	return one({
		subscriberId: requiredString(this, 'subscriberId', 'External Subscriber ID'),
		acknowledged: value.acknowledged,
		status: value.status,
	});
}

export async function preparePreferences(
	this: IExecuteSingleFunctions,
	request: IHttpRequestOptions,
) {
	const id = encodedParameter(this, 'subscriberId', 'External Subscriber ID');
	const operation = this.getNodeParameter('operation');
	if (operation === 'get') {
		const criticality = stringOption(
			this,
			this.getNodeParameter('criticality', ''),
			'Criticality',
			new Set(['critical', 'nonCritical', 'all']),
		);
		const contextKeys = stringArray(this, this.getNodeParameter('contextKeys', []), 'Context Keys');
		return setRequest(request, 'GET', `/v2/subscribers/${id}/preferences`, undefined, {
			...(criticality ? { criticality } : {}),
			...(contextKeys ? { contextKeys } : {}),
		});
	}
	const scope = this.getNodeParameter('preferenceScope');
	if (scope !== 'global' && scope !== 'workflow')
		throw routingError(this, 'Preference Scope must be Global or Workflow');
	const selections = objectParameter(this, 'preferenceChannels', 'Channels');
	const channels: IDataObject = {};
	for (const channel of CHANNELS) {
		const state = selections[channel] ?? 'unchanged';
		if (!['unchanged', 'enabled', 'disabled'].includes(state as string))
			throw routingError(this, `Invalid ${channel} preference state`);
		if (state !== 'unchanged') channels[channel] = state === 'enabled';
	}
	if (!Object.keys(channels).length)
		throw routingError(this, 'Select at least one channel to enable or disable');
	const body: IDataObject = { channels };
	if (scope === 'workflow')
		body.workflowId = requiredString(this, 'workflowReference', 'Workflow Reference');
	return setRequest(request, 'PATCH', `/v2/subscribers/${id}/preferences`, body);
}

export async function receivePreferences(
	this: IExecuteSingleFunctions,
	_items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
) {
	return receiveWrapped(this, response, (value) => assertPreferences(this, value));
}

const topicData = (context: IExecuteSingleFunctions, value: unknown): IDataObject | null => {
	let parsed = value;
	if (typeof parsed === 'string') {
		try {
			parsed = JSON.parse(parsed) as unknown;
		} catch {
			throw routingError(context, 'Custom Data must contain valid JSON');
		}
	}
	if (parsed === null) return null;
	if (!isObject(parsed))
		throw routingError(context, 'Custom Data must be a flat JSON object or null');
	for (const entry of Object.values(parsed)) {
		if (
			typeof entry === 'string' ||
			(typeof entry === 'number' && Number.isFinite(entry)) ||
			typeof entry === 'boolean'
		)
			continue;
		if (Array.isArray(entry) && entry.every((item) => typeof item === 'string')) continue;
		throw routingError(
			context,
			'Custom Data values must be strings, numbers, booleans, or string arrays',
		);
	}
	if (new TextEncoder().encode(JSON.stringify(parsed)).length > 64 * 1024)
		throw routingError(context, 'Custom Data must not exceed 64 KB');
	return parsed;
};

export async function prepareTopic(this: IExecuteSingleFunctions, request: IHttpRequestOptions) {
	const operation = this.getNodeParameter('operation');
	if (operation === 'getMany') {
		const limit = readLimit(this);
		const filters = objectParameter(this, 'topicFilters', 'Topic filters');
		const options = objectParameter(this, 'topicListOptions', 'Topic list options');
		if (
			Object.keys(filters).some((key) => !['key', 'name'].includes(key)) ||
			Object.keys(options).some((key) => !['orderBy', 'orderDirection'].includes(key))
		)
			throw routingError(this, 'Topic list contains an unsupported filter or option');
		const qs: IDataObject = {
			limit: Number.isFinite(limit) ? Math.min(limit, PAGE_SIZE) : PAGE_SIZE,
		};
		for (const key of ['key', 'name']) {
			const value = stringOption(this, filters[key], `${key} topic filter`);
			if (value) qs[key] = value;
		}
		const orderBy = stringOption(this, options.orderBy, 'Order By');
		const direction = stringOption(
			this,
			options.orderDirection,
			'Order Direction',
			new Set(['ASC', 'DESC']),
		);
		if (orderBy) qs.orderBy = orderBy;
		if (direction) qs.orderDirection = direction;
		return setRequest(request, 'GET', '/v2/topics', undefined, qs);
	}
	const key = requiredString(this, 'topicKey', 'Topic Key');
	if ([...key].length > 100)
		throw routingError(this, 'Topic Key must be a non-empty string of at most 100 characters');
	if (operation === 'createOrUpdate') {
		const fields = objectParameter(this, 'topicFields', 'Fields');
		const body: IDataObject = { key };
		if (Object.prototype.hasOwnProperty.call(fields, 'name')) {
			if (typeof fields.name !== 'string' || [...fields.name].length > 100)
				throw routingError(this, 'Display Name must be a string of at most 100 characters');
			body.name = fields.name;
		}
		if (Object.prototype.hasOwnProperty.call(fields, 'data'))
			body.data = topicData(this, fields.data);
		const strict = this.getNodeParameter('failIfExists', false);
		if (typeof strict !== 'boolean')
			throw routingError(this, 'Fail If Topic Exists must be a boolean');
		return setRequest(
			request,
			'POST',
			'/v2/topics',
			body,
			strict ? { failIfExists: true } : undefined,
		);
	}
	if (operation === 'update') {
		const name = requiredString(this, 'topicName', 'Display Name');
		if ([...name].length > 100)
			throw routingError(this, 'Display Name must be a string of at most 100 characters');
		return setRequest(request, 'PATCH', `/v2/topics/${encodeURIComponent(key)}`, { name });
	}
	return setRequest(
		request,
		operation === 'delete' ? 'DELETE' : 'GET',
		`/v2/topics/${encodeURIComponent(key)}`,
	);
}

export async function receiveTopic(
	this: IExecuteSingleFunctions,
	_items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
) {
	return receiveWrapped(this, response, (value) => assertTopic(this, value));
}
export const receiveTopicList = receiveCursor(
	(entry) =>
		typeof (entry as IDataObject)._id === 'string' &&
		typeof (entry as IDataObject).key === 'string',
);
export const paginateTopics = cursorPagination('topic');

export async function receiveTopicDelete(
	this: IExecuteSingleFunctions,
	_items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
) {
	assertHttpSuccess(this, response);
	const value = unwrapRawEnvelope(this, response.body);
	if (!isObject(value) || typeof value.acknowledged !== 'boolean')
		throw routingError(this, 'Novu returned a malformed topic delete acknowledgment');
	return one({
		topicKey: requiredString(this, 'topicKey', 'Topic Key'),
		acknowledged: value.acknowledged,
	});
}

const subscriptionEntries = (
	context: IExecuteSingleFunctions,
	operation: 'create' | 'delete',
): IDataObject[] => {
	const raw = context.getNodeParameter('subscriptions');
	const collection = raw as IDataObject;
	if (
		!isObject(raw) ||
		!Array.isArray(collection.subscription) ||
		collection.subscription.length < 1 ||
		collection.subscription.length > 100
	)
		throw routingError(context, 'Subscriptions must contain between 1 and 100 entries');
	return (collection.subscription as unknown[]).map((entry, index) => {
		if (
			!isObject(entry) ||
			Object.keys(entry).some((key) => !['subscriberId', 'identifier'].includes(key))
		)
			throw routingError(context, `Subscription entry ${index + 1} is malformed`);
		const subscriberId = entry.subscriberId;
		const identifier = entry.identifier;
		if (subscriberId !== undefined && typeof subscriberId !== 'string')
			throw routingError(context, `Subscription entry ${index + 1} Subscriber ID must be a string`);
		if (identifier !== undefined && typeof identifier !== 'string')
			throw routingError(context, `Subscription entry ${index + 1} Identifier must be a string`);
		if (typeof identifier === 'string' && [...identifier].length > 512)
			throw routingError(
				context,
				`Subscription entry ${index + 1} Identifier must not exceed 512 characters`,
			);
		if (operation === 'create' && !subscriberId)
			throw routingError(context, `Subscription entry ${index + 1} requires a Subscriber ID`);
		if (operation === 'delete' && !subscriberId && !identifier)
			throw routingError(
				context,
				`Subscription entry ${index + 1} requires a Subscriber ID or Identifier`,
			);
		return { ...(subscriberId ? { subscriberId } : {}), ...(identifier ? { identifier } : {}) };
	});
};

const assertMutation = (context: IExecuteSingleFunctions, value: unknown): IDataObject => {
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
		throw routingError(context, 'Novu returned a malformed topic subscription mutation envelope');
	return value;
};

export async function prepareTopicSubscription(
	this: IExecuteSingleFunctions,
	request: IHttpRequestOptions,
) {
	const key = encodedParameter(this, 'topicKey', 'Topic Key');
	const operation = this.getNodeParameter('operation');
	if (operation === 'getMany') {
		const limit = readLimit(this);
		const filters = objectParameter(this, 'subscriptionFilters', 'Subscription filters');
		const options = objectParameter(this, 'subscriptionListOptions', 'Subscription list options');
		if (
			Object.keys(filters).some((name) => !['subscriberId', 'contextKeys'].includes(name)) ||
			Object.keys(options).some((name) => !['orderBy', 'orderDirection'].includes(name))
		)
			throw routingError(this, 'Unsupported subscription filter or option');
		const subscriberId = stringOption(this, filters.subscriberId, 'Subscriber ID filter');
		const contextKeys = stringArray(this, filters.contextKeys, 'Context Keys');
		const orderBy = stringOption(this, options.orderBy, 'Order By');
		const direction = stringOption(
			this,
			options.orderDirection,
			'Order Direction',
			new Set(['ASC', 'DESC']),
		);
		const qs: IDataObject = {
			limit: Number.isFinite(limit) ? Math.min(limit, PAGE_SIZE) : PAGE_SIZE,
			...(subscriberId ? { subscriberId } : {}),
			...(contextKeys ? { contextKeys } : {}),
			...(orderBy ? { orderBy } : {}),
			...(direction ? { orderDirection: direction } : {}),
		};
		return setRequest(request, 'GET', `/v2/topics/${key}/subscriptions`, undefined, qs);
	}
	if (operation !== 'create' && operation !== 'delete')
		throw routingError(this, `Unsupported Topic Subscription operation: ${operation}`);
	return setRequest(
		request,
		operation === 'create' ? 'POST' : 'DELETE',
		`/v2/topics/${key}/subscriptions`,
		{ subscriptions: subscriptionEntries(this, operation) },
	);
}

export async function receiveTopicSubscriptionMutation(
	this: IExecuteSingleFunctions,
	_items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
) {
	return receiveDirect(this, response, (value) => assertMutation(this, value));
}
export const receiveTopicSubscriptionList = receiveCursor();
export const paginateTopicSubscriptions = cursorPagination('topic subscription');

const workflowQuery = (context: IExecuteSingleFunctions): IDataObject => {
	const filters = objectParameter(context, 'workflowFilters', 'Workflow filters');
	const options = objectParameter(context, 'workflowListOptions', 'Workflow list options');
	if (
		Object.keys(filters).some((key) => !['query', 'status', 'tags'].includes(key)) ||
		Object.keys(options).some((key) => !['orderBy', 'orderDirection'].includes(key))
	)
		throw routingError(context, 'Workflow list contains an unsupported filter or option');
	const query = stringOption(context, filters.query, 'Query');
	const status = stringArray(context, filters.status, 'Status', WORKFLOW_STATUSES);
	const tags = stringArray(context, filters.tags, 'Tags');
	const orderBy = stringOption(context, options.orderBy, 'Order By', WORKFLOW_ORDERS);
	const direction = stringOption(
		context,
		options.orderDirection,
		'Order Direction',
		new Set(['ASC', 'DESC']),
	);
	return {
		...(query ? { query } : {}),
		...(status ? { status } : {}),
		...(tags ? { tags } : {}),
		...(orderBy ? { orderBy } : {}),
		...(direction ? { orderDirection: direction } : {}),
	};
};

export async function prepareWorkflow(this: IExecuteSingleFunctions, request: IHttpRequestOptions) {
	const operation = this.getNodeParameter('operation');
	if (operation === 'getMany') {
		const limit = readLimit(this);
		return setRequest(request, 'GET', '/v2/workflows', undefined, {
			...workflowQuery(this),
			offset: 0,
			limit: Number.isFinite(limit) ? Math.min(limit, PAGE_SIZE) : PAGE_SIZE,
		});
	}
	const raw = this.getNodeParameter('workflowIdentifier') as unknown;
	let id: string;
	if (typeof raw === 'string') id = raw;
	else if (
		isObject(raw) &&
		(raw.mode === 'list' || raw.mode === 'id') &&
		typeof raw.value === 'string'
	)
		id = raw.value;
	else throw routingError(this, 'Workflow must use From List or By ID');
	if (!id.length) throw routingError(this, 'Workflow Identifier must be a non-empty string');
	return setRequest(request, 'GET', `/v2/workflows/${encodeURIComponent(id)}`);
}

export async function receiveWorkflow(
	this: IExecuteSingleFunctions,
	_items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
) {
	return receiveWrapped(this, response, (value) => assertWorkflow(this, value));
}

export async function receiveWorkflowList(
	this: IExecuteSingleFunctions,
	_items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
) {
	assertHttpSuccess(this, response);
	const value = unwrapRawEnvelope(this, response.body);
	if (
		!isObject(value) ||
		!Array.isArray(value.workflows) ||
		!Number.isInteger(value.totalCount) ||
		(value.totalCount as number) < 0 ||
		!value.workflows.every((workflow) => {
			try {
				assertWorkflow(this, workflow);
				return true;
			} catch {
				return false;
			}
		})
	)
		throw routingError(this, 'Novu returned a malformed workflow list');
	if (value.workflows.length > PAGE_SIZE)
		throw routingError(this, 'Novu returned a malformed workflow list');
	return one(value);
}

export async function paginateWorkflows(
	this: IExecutePaginationFunctions,
	requestOptions: DeclarativeRestApiSettings.ResultOptions,
): Promise<INodeExecutionData[]> {
	const limit = readLimit(this);
	const output: INodeExecutionData[] = [];
	let offset = 0;
	let current = requestOptions;
	while (output.length < limit) {
		const page = await this.makeRoutingRequest(current);
		if (
			page.length !== 1 ||
			!isObject(page[0].json) ||
			!Array.isArray(page[0].json.workflows) ||
			typeof page[0].json.totalCount !== 'number'
		)
			throw routingError(this, 'Novu returned a malformed workflow pagination page');
		const workflows = page[0].json.workflows as IDataObject[];
		const requestedPageLimit = Number((current.options.qs as IDataObject | undefined)?.limit);
		if (
			!Number.isInteger(requestedPageLimit) ||
			requestedPageLimit < 1 ||
			workflows.length > requestedPageLimit
		)
			throw routingError(this, 'Novu returned a malformed workflow list');
		const remaining = limit - output.length;
		for (const workflow of workflows.slice(0, remaining)) output.push({ json: workflow });
		if (output.length >= limit || offset + workflows.length >= (page[0].json.totalCount as number))
			return output;
		if (!workflows.length) throw routingError(this, 'Novu workflow pagination made no progress');
		offset += workflows.length;
		current = {
			...current,
			options: {
				...current.options,
				qs: {
					...(current.options.qs ?? {}),
					offset,
					limit: Number.isFinite(limit) ? Math.min(limit - output.length, PAGE_SIZE) : PAGE_SIZE,
				},
			},
		};
	}
	return output;
}

export async function prepareCancel(this: IExecuteSingleFunctions, request: IHttpRequestOptions) {
	return setRequest(
		request,
		'DELETE',
		`/v1/events/trigger/${encodedParameter(this, 'cancelTransactionId', 'Transaction ID')}`,
	);
}

export async function receiveCancel(
	this: IExecuteSingleFunctions,
	_items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
) {
	assertHttpSuccess(this, response);
	const value = unwrapRawEnvelope(this, response.body);
	if (typeof value !== 'boolean')
		throw routingError(this, 'Novu returned a malformed cancellation response');
	return one({
		transactionId: requiredString(this, 'cancelTransactionId', 'Transaction ID'),
		cancelled: value,
	});
}
