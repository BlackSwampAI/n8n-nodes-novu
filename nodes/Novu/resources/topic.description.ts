import type { INodeProperties } from 'n8n-workflow';
import {
	paginateTopics,
	prepareTopic,
	receiveTopic,
	receiveTopicDelete,
	receiveTopicList,
} from './routing';

const itemOperations = ['createOrUpdate', 'get', 'update', 'delete'];
const display = { show: { resource: ['topic'] } };

export const topicProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: display,
		options: [
			{
				name: 'Create or Update',
				value: 'createOrUpdate',
				action: 'Create or update a topic',
				routing: {
					request: { method: 'POST', url: '/v2/topics' },
					send: { preSend: [prepareTopic] },
					output: { postReceive: [receiveTopic] },
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a topic',
				routing: {
					request: { method: 'DELETE', url: '/v2/topics' },
					send: { preSend: [prepareTopic] },
					output: { postReceive: [receiveTopicDelete] },
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a topic',
				routing: {
					request: { method: 'GET', url: '/v2/topics' },
					send: { preSend: [prepareTopic] },
					output: { postReceive: [receiveTopic] },
				},
			},
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many topics',
				routing: {
					request: { method: 'GET', url: '/v2/topics' },
					send: { preSend: [prepareTopic] },
					operations: { pagination: paginateTopics },
					output: { postReceive: [receiveTopicList] },
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a topic',
				routing: {
					request: { method: 'PATCH', url: '/v2/topics' },
					send: { preSend: [prepareTopic] },
					output: { postReceive: [receiveTopic] },
				},
			},
		],
		default: 'createOrUpdate',
	},
	{
		displayName: 'Topic Key',
		name: 'topicKey',
		type: 'string',
		required: true,
		default: '',
		description: "The topic's public key, not Novu's internal _id",
		displayOptions: { show: { resource: ['topic'], operation: itemOperations } },
	},
	{
		displayName: 'Fail If Topic Exists',
		name: 'failIfExists',
		type: 'boolean',
		default: false,
		description: 'Whether to request strict creation instead of updating an existing topic key',
		displayOptions: { show: { resource: ['topic'], operation: ['createOrUpdate'] } },
	},
	{
		displayName: 'Fields',
		name: 'topicFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['topic'], operation: ['createOrUpdate'] } },
		options: [
			{
				displayName: 'Custom Data',
				name: 'data',
				type: 'json',
				default: '{}',
				description: 'A flat JSON object or null, up to 64 KB',
			},
			{ displayName: 'Display Name', name: 'name', type: 'string', default: '' },
		],
	},
	{
		displayName: 'Display Name',
		name: 'topicName',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['topic'], operation: ['update'] } },
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: ['topic'], operation: ['getMany'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { resource: ['topic'], operation: ['getMany'], returnAll: [false] } },
	},
	{
		displayName: 'Filters',
		name: 'topicFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['topic'], operation: ['getMany'] } },
		options: [
			{ displayName: 'Topic Key', name: 'key', type: 'string', default: '' },
			{ displayName: 'Display Name', name: 'name', type: 'string', default: '' },
		],
	},
	{
		displayName: 'Options',
		name: 'topicListOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['topic'], operation: ['getMany'] } },
		options: [
			{ displayName: 'Order By', name: 'orderBy', type: 'string', default: '' },
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
