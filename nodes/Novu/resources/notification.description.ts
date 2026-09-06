import type { INodeProperties } from 'n8n-workflow';
import { workflowLocator } from './workflow.description';

const triggerDisplay = { show: { resource: ['notification'], operation: ['triggerWorkflow'] } };
const cancelDisplay = { show: { resource: ['notification'], operation: ['cancelExecution'] } };

export const notificationProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['notification'] } },
		options: [
			{
				name: 'Cancel Execution',
				value: 'cancelExecution',
				action: 'Cancel a notification execution',
			},
			{
				name: 'Trigger Workflow',
				value: 'triggerWorkflow',
				action: 'Trigger a notification workflow',
			},
		],
		default: 'triggerWorkflow',
	},
	{
		...workflowLocator,
		description: 'The workflow trigger identifier sent as the REST name field',
		displayOptions: triggerDisplay,
	},
	{
		displayName: 'Transaction ID',
		name: 'cancelTransactionId',
		type: 'string',
		required: true,
		default: '',
		description:
			'Cancels only eligible active or pending work such as delays or digests. Delivered messages cannot be recalled.',
		displayOptions: cancelDisplay,
	},
	{
		displayName: 'Recipient Type',
		name: 'recipientType',
		type: 'options',
		options: [
			{ name: 'Subscriber', value: 'subscriber' },
			{ name: 'Topic', value: 'topic' },
		],
		default: 'subscriber',
		description: 'Whether to notify one subscriber or one Novu topic',
		displayOptions: triggerDisplay,
	},
	{
		displayName: 'External Subscriber ID',
		name: 'subscriberId',
		type: 'string',
		required: true,
		default: '',
		description: "The stable subscriberId from your application, not Novu's internal _id",
		displayOptions: {
			show: {
				resource: ['notification'],
				operation: ['triggerWorkflow'],
				recipientType: ['subscriber'],
			},
		},
	},
	{
		displayName: 'Topic Key',
		name: 'recipientTopicKey',
		type: 'string',
		required: true,
		default: '',
		description: 'The public key of one Novu topic; Novu performs topic fan-out',
		displayOptions: {
			show: {
				resource: ['notification'],
				operation: ['triggerWorkflow'],
				recipientType: ['topic'],
			},
		},
	},
	{
		displayName: 'Payload',
		name: 'payload',
		type: 'json',
		required: true,
		default: '{}',
		description: 'A JSON object passed to the existing Novu workflow',
		displayOptions: triggerDisplay,
	},
	{
		displayName: 'Options',
		name: 'triggerOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: triggerDisplay,
		options: [
			{
				displayName: 'Idempotency Key',
				name: 'idempotencyKey',
				type: 'string',
				default: '',
				description:
					'A stable key per business event (maximum 255 characters). Novu caches API-layer results for 24 hours, and this feature is not enabled for every organization.',
			},
			{
				displayName: 'Retry With Idempotency Key',
				name: 'retryWithIdempotencyKey',
				type: 'boolean',
				default: false,
				description:
					'Whether to make at most 3 total attempts for documented transient failures. Requires a non-empty Idempotency Key and Novu idempotency enablement. Do not stack this with n8n node-level retries.',
			},
			{
				displayName: 'Transaction ID',
				name: 'transactionId',
				type: 'string',
				default: '',
				description:
					'Optional trace/cancellation identifier; this is separate from API-layer idempotency',
			},
		],
	},
];
