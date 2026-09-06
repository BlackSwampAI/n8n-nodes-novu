import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchResult,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { novuApiRequest } from '../shared/transport';
import { WORKFLOW_STATUS_OPTIONS } from './workflow.description';

const PAGE_SIZE = 100;
const ORDER_FIELDS = new Set(['createdAt', 'updatedAt', 'name', 'lastTriggeredAt']);
const STATUS_VALUES = new Set<string>(WORKFLOW_STATUS_OPTIONS.map(({ value }) => value));
const isObject = (value: unknown): value is IDataObject =>
	typeof value === 'object' && value !== null && !Array.isArray(value);
const localError = (
	context: IExecuteFunctions | ILoadOptionsFunctions,
	message: string,
	itemIndex?: number,
) =>
	new NodeOperationError(context.getNode(), message, {
		...(itemIndex !== undefined ? { itemIndex } : {}),
	});

export const normalizeWorkflowIdentifier = (
	context: IExecuteFunctions | ILoadOptionsFunctions,
	value: unknown,
	itemIndex?: number,
): string => {
	if (typeof value === 'string') {
		if (value.length > 0) return value;
		throw localError(context, 'Workflow Identifier must be a non-empty string', itemIndex);
	}
	if (!isObject(value) || (value.mode !== 'list' && value.mode !== 'id'))
		throw localError(context, 'Workflow must use From List or By ID', itemIndex);
	if (typeof value.value !== 'string' || value.value.length === 0)
		throw localError(context, 'Workflow Identifier must be a non-empty string', itemIndex);
	return value.value;
};

const assertWorkflow = (
	context: IExecuteFunctions | ILoadOptionsFunctions,
	value: unknown,
	itemIndex?: number,
): IDataObject => {
	if (
		!isObject(value) ||
		typeof value.name !== 'string' ||
		value.name.length === 0 ||
		typeof value._id !== 'string' ||
		value._id.length === 0 ||
		typeof value.workflowId !== 'string' ||
		value.workflowId.length === 0
	)
		throw localError(context, 'Novu returned a malformed workflow', itemIndex);
	return value;
};

const assertWorkflowList = (
	context: IExecuteFunctions | ILoadOptionsFunctions,
	value: unknown,
	requestedLimit: number,
	itemIndex?: number,
): { workflows: IDataObject[]; totalCount: number } => {
	if (
		!isObject(value) ||
		!Array.isArray(value.workflows) ||
		value.workflows.length > requestedLimit ||
		!Number.isInteger(value.totalCount) ||
		(value.totalCount as number) < 0
	)
		throw localError(context, 'Novu returned a malformed workflow list', itemIndex);
	return {
		workflows: value.workflows.map((workflow) => assertWorkflow(context, workflow, itemIndex)),
		totalCount: value.totalCount as number,
	};
};

const readStringArray = (
	context: IExecuteFunctions,
	value: unknown,
	label: string,
	allowed: Set<string> | undefined,
	itemIndex: number,
): string[] | undefined => {
	if (value === undefined) return undefined;
	if (
		!Array.isArray(value) ||
		!value.every((entry) => typeof entry === 'string' && entry.length > 0)
	)
		throw localError(context, `${label} must be an array of non-empty strings`, itemIndex);
	if (allowed && value.some((entry) => !allowed.has(entry)))
		throw localError(context, `${label} contains an unsupported value`, itemIndex);
	return value.length ? value : undefined;
};

const getMany = async (context: IExecuteFunctions, itemIndex: number) => {
	const returnAll = context.getNodeParameter('returnAll', itemIndex);
	if (typeof returnAll !== 'boolean')
		throw localError(context, 'Return All must be a boolean', itemIndex);
	const limit = returnAll ? Number.POSITIVE_INFINITY : context.getNodeParameter('limit', itemIndex);
	if (!returnAll && (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1))
		throw localError(context, 'Limit must be a positive integer', itemIndex);
	const filters = context.getNodeParameter('workflowFilters', itemIndex, {});
	const options = context.getNodeParameter('workflowListOptions', itemIndex, {});
	if (!isObject(filters) || !isObject(options))
		throw localError(context, 'Workflow list filters and options must be objects', itemIndex);
	const filterValues = filters as IDataObject;
	const optionValues = options as IDataObject;
	if (
		Object.keys(filterValues).some((key) => !['query', 'status', 'tags'].includes(key)) ||
		Object.keys(optionValues).some((key) => !['orderBy', 'orderDirection'].includes(key))
	)
		throw localError(context, 'Workflow list contains an unsupported filter or option', itemIndex);
	const qs: IDataObject = {};
	if (filterValues.query !== undefined && typeof filterValues.query !== 'string')
		throw localError(context, 'Query must be a string', itemIndex);
	if (filterValues.query) qs.query = filterValues.query;
	const status = readStringArray(context, filterValues.status, 'Status', STATUS_VALUES, itemIndex);
	const tags = readStringArray(context, filterValues.tags, 'Tags', undefined, itemIndex);
	if (status) qs.status = status;
	if (tags) qs.tags = tags;
	if (
		optionValues.orderBy !== undefined &&
		(typeof optionValues.orderBy !== 'string' || !ORDER_FIELDS.has(optionValues.orderBy))
	)
		throw localError(context, 'Order By contains an unsupported value', itemIndex);
	if (optionValues.orderBy) qs.orderBy = optionValues.orderBy;
	if (
		optionValues.orderDirection !== undefined &&
		optionValues.orderDirection !== 'ASC' &&
		optionValues.orderDirection !== 'DESC'
	)
		throw localError(context, 'Order Direction must be ASC or DESC', itemIndex);
	if (optionValues.orderDirection) qs.orderDirection = optionValues.orderDirection;

	const output: INodeExecutionData[] = [];
	let offset = 0;
	while (output.length < limit) {
		const remaining = limit - output.length;
		const pageLimit = Number.isFinite(remaining) ? Math.min(remaining, PAGE_SIZE) : PAGE_SIZE;
		const response = assertWorkflowList(
			context,
			await novuApiRequest(context, {
				method: 'GET',
				version: 'v2',
				pathSegments: ['workflows'],
				qs: { ...qs, offset, limit: pageLimit },
				itemIndex,
			}),
			pageLimit,
			itemIndex,
		);
		for (const workflow of response.workflows.slice(0, remaining))
			output.push({ json: workflow, pairedItem: itemIndex });
		if (output.length >= limit || offset + response.workflows.length >= response.totalCount) break;
		if (response.workflows.length === 0)
			throw localError(context, 'Novu workflow pagination made no progress', itemIndex);
		offset += response.workflows.length;
	}
	return output;
};

export const executeWorkflowOperation = async (
	context: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> => {
	if (operation === 'getMany') return await getMany(context, itemIndex);
	if (operation !== 'get')
		throw localError(context, `Unsupported Workflow operation: ${operation}`, itemIndex);
	const workflowId = normalizeWorkflowIdentifier(
		context,
		context.getNodeParameter('workflowIdentifier', itemIndex),
		itemIndex,
	);
	const response = await novuApiRequest(context, {
		method: 'GET',
		version: 'v2',
		pathSegments: ['workflows', workflowId],
		itemIndex,
	});
	return [{ json: assertWorkflow(context, response, itemIndex), pairedItem: itemIndex }];
};

export async function searchWorkflows(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	if (filter !== undefined && typeof filter !== 'string')
		throw localError(this, 'Workflow search filter must be a string');
	const offset = paginationToken === undefined ? 0 : Number(paginationToken);
	if (
		!Number.isInteger(offset) ||
		offset < 0 ||
		(paginationToken !== undefined && String(offset) !== paginationToken)
	)
		throw localError(this, 'Workflow search pagination token is invalid');
	const response = assertWorkflowList(
		this,
		await novuApiRequest(this, {
			method: 'GET',
			version: 'v2',
			pathSegments: ['workflows'],
			qs: { limit: PAGE_SIZE, offset, ...(filter ? { query: filter } : {}) },
		}),
		PAGE_SIZE,
	);
	const nextOffset = offset + response.workflows.length;
	if (nextOffset < response.totalCount && response.workflows.length === 0)
		throw localError(this, 'Novu workflow search pagination made no progress');
	return {
		results: response.workflows.map((workflow) => ({
			name:
				workflow.name === workflow.workflowId
					? (workflow.name as string)
					: `${workflow.name} (${workflow.workflowId})`,
			value: workflow.workflowId as string,
		})),
		...(nextOffset < response.totalCount ? { paginationToken: String(nextOffset) } : {}),
	};
}
