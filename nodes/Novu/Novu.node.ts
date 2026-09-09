import type { INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { subscriberProperties } from './resources/subscriber.description';
import { notificationProperties } from './resources/notification.description';
import { executeTriggerWorkflow } from './resources/notification';
import { subscriberPreferenceProperties } from './resources/subscriberPreference.description';
import { topicProperties } from './resources/topic.description';
import { topicSubscriptionProperties } from './resources/topicSubscription.description';
import { workflowProperties } from './resources/workflow.description';
import { searchWorkflows } from './resources/workflow';

export class Novu implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Novu',
		name: 'novu',
		icon: { light: 'file:novu.svg', dark: 'file:novu.dark.svg' },
		group: ['transform'],
		version: 1,
		description: 'Work with the Novu notification platform',
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		defaults: { name: 'Novu' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'novuApi', required: true }],
		requestDefaults: {
			baseURL: 'https://api.novu.co',
			json: true,
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Notification', value: 'notification' },
					{ name: 'Subscriber', value: 'subscriber' },
					{ name: 'Subscriber Preference', value: 'subscriberPreference' },
					{ name: 'Topic', value: 'topic' },
					{ name: 'Topic Subscription', value: 'topicSubscription' },
					{ name: 'Workflow', value: 'workflow' },
				],
				default: 'subscriber',
			},
			...subscriberProperties,
			...notificationProperties,
			...subscriberPreferenceProperties,
			...topicProperties,
			...topicSubscriptionProperties,
			...workflowProperties,
		],
	};

	methods: INodeType['methods'] = { listSearch: { searchWorkflows } };

	customOperations: INodeType['customOperations'] = {
		notification: { triggerWorkflow: executeTriggerWorkflow },
	};
}
