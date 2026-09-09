import type { INodeProperties } from 'n8n-workflow';
import {
	paginateWorkflows,
	prepareWorkflow,
	receiveWorkflow,
	receiveWorkflowList,
} from './routing';

export const WORKFLOW_STATUS_OPTIONS = [
	{ name: 'Active', value: 'ACTIVE' },
	{ name: 'Error', value: 'ERROR' },
	{ name: 'Inactive', value: 'INACTIVE' },
] as const;

export const workflowLocator: INodeProperties = {
	displayName: 'Workflow',
	name: 'workflowIdentifier',
	type: 'resourceLocator',
	required: true,
	default: { mode: 'list', value: '' },
	description: "The workflow's public trigger-facing workflowId, not Novu's internal _id",
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod: 'searchWorkflows',
				searchable: true,
				slowLoadNotice: {
					message: 'If loading fails, choose By ID and enter the workflow identifier manually',
					timeout: 10000,
				},
			},
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'order-created',
		},
	],
};

export const workflowProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['workflow'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get a workflow',
				routing: {
					request: { method: 'GET', url: '/v2/workflows' },
					send: { preSend: [prepareWorkflow] },
					output: { postReceive: [receiveWorkflow] },
				},
			},
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many workflows',
				routing: {
					request: { method: 'GET', url: '/v2/workflows' },
					send: { preSend: [prepareWorkflow] },
					operations: { pagination: paginateWorkflows },
					output: { postReceive: [receiveWorkflowList] },
				},
			},
		],
		default: 'get',
	},
	{
		...workflowLocator,
		displayOptions: { show: { resource: ['workflow'], operation: ['get'] } },
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: ['workflow'], operation: ['getMany'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: {
			show: { resource: ['workflow'], operation: ['getMany'], returnAll: [false] },
		},
	},
	{
		displayName: 'Filters',
		name: 'workflowFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['workflow'], operation: ['getMany'] } },
		options: [
			{ displayName: 'Query', name: 'query', type: 'string', default: '' },
			{
				displayName: 'Status',
				name: 'status',
				type: 'multiOptions',
				options: [...WORKFLOW_STATUS_OPTIONS],
				default: [],
			},
			{
				displayName: 'Tags',
				name: 'tags',
				type: 'string',
				typeOptions: { multipleValues: true },
				default: [],
			},
		],
	},
	{
		displayName: 'Options',
		name: 'workflowListOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['workflow'], operation: ['getMany'] } },
		options: [
			{
				displayName: 'Order By',
				name: 'orderBy',
				type: 'options',
				options: [
					{ name: 'Created At', value: 'createdAt' },
					{ name: 'Last Triggered At', value: 'lastTriggeredAt' },
					{ name: 'Name', value: 'name' },
					{ name: 'Updated At', value: 'updatedAt' },
				],
				default: 'createdAt',
			},
			{
				displayName: 'Order Direction',
				name: 'orderDirection',
				type: 'options',
				options: [
					{ name: 'Ascending', value: 'ASC' },
					{ name: 'Descending', value: 'DESC' },
				],
				default: 'DESC',
			},
		],
	},
];
