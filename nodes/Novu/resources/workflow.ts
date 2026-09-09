import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeListSearchResult,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { unwrapNovuDataEnvelope } from '../shared/response';
import { novuApiRequest } from '../shared/transport';

const PAGE_SIZE = 100;
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
		unwrapNovuDataEnvelope(
			await novuApiRequest(this, {
				method: 'GET',
				version: 'v2',
				pathSegments: ['workflows'],
				qs: { limit: PAGE_SIZE, offset, ...(filter ? { query: filter } : {}) },
			}),
		),
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
