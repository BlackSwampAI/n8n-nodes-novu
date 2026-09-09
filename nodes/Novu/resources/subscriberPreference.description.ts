import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { preparePreferences, receivePreferences } from './routing';

const display = { show: { resource: ['subscriberPreference'] } };
const updateDisplay = { show: { resource: ['subscriberPreference'], operation: ['update'] } };
const triState: INodePropertyOptions[] = [
	{ name: 'Unchanged', value: 'unchanged' },
	{ name: 'Enabled', value: 'enabled' },
	{ name: 'Disabled', value: 'disabled' },
];

export const subscriberPreferenceProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: display,
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get subscriber preferences',
				routing: {
					request: { method: 'GET', url: '/v2/subscribers' },
					send: { preSend: [preparePreferences] },
					output: { postReceive: [receivePreferences] },
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update subscriber preferences',
				routing: {
					request: { method: 'PATCH', url: '/v2/subscribers' },
					send: { preSend: [preparePreferences] },
					output: { postReceive: [receivePreferences] },
				},
			},
		],
		default: 'get',
	},
	{
		displayName: 'External Subscriber ID',
		name: 'subscriberId',
		type: 'string',
		required: true,
		default: '',
		description: "The stable subscriberId from your application, not Novu's internal _id",
		displayOptions: display,
	},
	{
		displayName: 'Criticality',
		name: 'criticality',
		type: 'options',
		options: [
			{ name: 'Default (Non-Critical)', value: '' },
			{ name: 'All', value: 'all' },
			{ name: 'Critical', value: 'critical' },
			{ name: 'Non-Critical', value: 'nonCritical' },
		],
		default: '',
		displayOptions: { show: { resource: ['subscriberPreference'], operation: ['get'] } },
	},
	{
		displayName: 'Context Keys',
		name: 'contextKeys',
		type: 'string',
		typeOptions: { multipleValues: true },
		default: [],
		description: 'Optional context keys used to filter returned preferences',
		displayOptions: { show: { resource: ['subscriberPreference'], operation: ['get'] } },
	},
	{
		displayName: 'Scope',
		name: 'preferenceScope',
		type: 'options',
		options: [
			{ name: 'Global', value: 'global' },
			{ name: 'Workflow', value: 'workflow' },
		],
		default: 'global',
		displayOptions: updateDisplay,
	},
	{
		displayName: 'Workflow Reference',
		name: 'workflowReference',
		type: 'string',
		required: true,
		default: '',
		description: 'A Novu workflow internal _id, identifier, or slug',
		displayOptions: {
			show: {
				resource: ['subscriberPreference'],
				operation: ['update'],
				preferenceScope: ['workflow'],
			},
		},
	},
	{
		displayName: 'Channels',
		name: 'preferenceChannels',
		type: 'collection',
		placeholder: 'Add Channel',
		default: {},
		displayOptions: updateDisplay,
		options: [
			{
				displayName: 'Chat',
				name: 'chat',
				type: 'options',
				options: triState,
				default: 'unchanged',
			},
			{
				displayName: 'Email',
				name: 'email',
				type: 'options',
				options: triState,
				default: 'unchanged',
			},
			{
				displayName: 'In-App',
				name: 'in_app',
				type: 'options',
				options: triState,
				default: 'unchanged',
			},
			{
				displayName: 'Push',
				name: 'push',
				type: 'options',
				options: triState,
				default: 'unchanged',
			},
			{ displayName: 'SMS', name: 'sms', type: 'options', options: triState, default: 'unchanged' },
			{
				displayName: 'Tool',
				name: 'tool',
				type: 'options',
				options: triState,
				default: 'unchanged',
			},
		],
	},
];
