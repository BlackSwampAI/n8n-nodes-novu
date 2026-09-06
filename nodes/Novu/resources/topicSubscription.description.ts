import type { INodeProperties } from 'n8n-workflow';

const display = { show: { resource: ['topicSubscription'] } };
const mutationDisplay = {
	show: { resource: ['topicSubscription'], operation: ['create', 'delete'] },
};

export const topicSubscriptionProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: display,
		options: [
			{ name: 'Create', value: 'create', action: 'Create topic subscriptions' },
			{ name: 'Delete', value: 'delete', action: 'Delete topic subscriptions' },
			{ name: 'Get Many', value: 'getMany', action: 'Get many topic subscriptions' },
		],
		default: 'create',
	},
	{
		displayName: 'Topic Key',
		name: 'topicKey',
		type: 'string',
		required: true,
		default: '',
		description: "The topic's public key, not Novu's internal _id",
		displayOptions: display,
	},
	{
		displayName: 'Subscriptions',
		name: 'subscriptions',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		default: {},
		placeholder: 'Add Subscription',
		displayOptions: mutationDisplay,
		description:
			'Modern subscription entries. Subscriber-only delete removes all relationships for that subscriber in this topic.',
		options: [
			{
				displayName: 'Subscription',
				name: 'subscription',
				values: [
					{
						displayName: 'External Subscriber ID',
						name: 'subscriberId',
						type: 'string',
						default: '',
						description:
							'Required for Create; on Delete, subscriber-only removes all relationships for this subscriber',
					},
					{
						displayName: 'Relationship Identifier',
						name: 'identifier',
						type: 'string',
						default: '',
						description: 'Optional relationship identifier, maximum 512 characters',
					},
				],
			},
		],
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: ['topicSubscription'], operation: ['getMany'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: {
			show: { resource: ['topicSubscription'], operation: ['getMany'], returnAll: [false] },
		},
	},
	{
		displayName: 'Filters',
		name: 'subscriptionFilters',
		type: 'collection',
		default: {},
		placeholder: 'Add Filter',
		displayOptions: { show: { resource: ['topicSubscription'], operation: ['getMany'] } },
		options: [
			{
				displayName: 'Context Keys',
				name: 'contextKeys',
				type: 'string',
				typeOptions: { multipleValues: true },
				default: [],
			},
			{ displayName: 'External Subscriber ID', name: 'subscriberId', type: 'string', default: '' },
		],
	},
	{
		displayName: 'Options',
		name: 'subscriptionListOptions',
		type: 'collection',
		default: {},
		placeholder: 'Add Option',
		displayOptions: { show: { resource: ['topicSubscription'], operation: ['getMany'] } },
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
