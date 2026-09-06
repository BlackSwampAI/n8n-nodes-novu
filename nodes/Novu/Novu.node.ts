import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { subscriberProperties } from './resources/subscriber.description';
import { executeSubscriberOperation } from './resources/subscriber';
import { notificationProperties } from './resources/notification.description';
import { executeNotificationOperation } from './resources/notification';
import { subscriberPreferenceProperties } from './resources/subscriberPreference.description';
import { executeSubscriberPreferenceOperation } from './resources/subscriberPreference';
import { topicProperties } from './resources/topic.description';
import { executeTopicOperation } from './resources/topic';
import { topicSubscriptionProperties } from './resources/topicSubscription.description';
import { executeTopicSubscriptionOperation } from './resources/topicSubscription';

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
				],
				default: 'subscriber',
			},
			...subscriberProperties,
			...notificationProperties,
			...subscriberPreferenceProperties,
			...topicProperties,
			...topicSubscriptionProperties,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const output: INodeExecutionData[] = [];
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				if (resource === 'subscriber') {
					output.push(...(await executeSubscriberOperation(this, operation, itemIndex)));
				} else if (resource === 'notification') {
					output.push(...(await executeNotificationOperation(this, operation, itemIndex)));
				} else if (resource === 'subscriberPreference') {
					output.push(...(await executeSubscriberPreferenceOperation(this, operation, itemIndex)));
				} else if (resource === 'topic') {
					output.push(...(await executeTopicOperation(this, operation, itemIndex)));
				} else if (resource === 'topicSubscription') {
					output.push(...(await executeTopicSubscriptionOperation(this, operation, itemIndex)));
				} else {
					throw new NodeOperationError(this.getNode(), `Unsupported resource: ${resource}`, {
						itemIndex,
					});
				}
			} catch (error) {
				if (!this.continueOnFail()) {
					throw new NodeOperationError(this.getNode(), error, { itemIndex });
				}
				const message = error instanceof Error ? error.message : 'Unknown Novu error';
				output.push({ json: { error: message }, pairedItem: itemIndex });
			}
		}
		return [output];
	}
}
