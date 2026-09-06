import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { unwrapNovuDataEnvelope } from '../shared/response';
import { novuApiRequest } from '../shared/transport';
import { normalizeWorkflowIdentifier } from './workflow';

const TRIGGER_STATUSES = new Set([
	'error',
	'trigger_not_active',
	'no_workflow_active_steps_defined',
	'no_workflow_steps_defined',
	'processed',
	'no_tenant_found',
	'invalid_recipients',
]);

const isObject = (value: unknown): value is IDataObject =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const localError = (context: IExecuteFunctions, message: string, itemIndex: number) =>
	new NodeOperationError(context.getNode(), message, { itemIndex });

const requiredString = (
	context: IExecuteFunctions,
	parameter: string,
	label: string,
	itemIndex: number,
): string => {
	const value = context.getNodeParameter(parameter, itemIndex);
	if (typeof value !== 'string' || value.length === 0) {
		throw localError(context, `${label} must be a non-empty string`, itemIndex);
	}
	return value;
};

const parsePayload = (
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): IDataObject => {
	let parsed = value;
	if (typeof value === 'string') {
		try {
			parsed = JSON.parse(value) as unknown;
		} catch {
			throw localError(context, 'Payload must contain valid JSON', itemIndex);
		}
	}
	if (!isObject(parsed)) throw localError(context, 'Payload must be a JSON object', itemIndex);
	return parsed;
};

const assertTriggerResponse = (
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): IDataObject => {
	if (
		!isObject(value) ||
		typeof value.acknowledged !== 'boolean' ||
		typeof value.status !== 'string'
	) {
		throw localError(context, 'Novu returned a malformed trigger acknowledgment', itemIndex);
	}
	if (!TRIGGER_STATUSES.has(value.status)) {
		throw localError(
			context,
			'Novu returned an unrecognized trigger acknowledgment status',
			itemIndex,
		);
	}
	if (
		(value.error !== undefined &&
			(!Array.isArray(value.error) || !value.error.every((entry) => typeof entry === 'string'))) ||
		(value.transactionId !== undefined && typeof value.transactionId !== 'string') ||
		(value.activityFeedLink !== undefined && typeof value.activityFeedLink !== 'string') ||
		(value.jobData !== undefined && !isObject(value.jobData))
	) {
		throw localError(context, 'Novu returned a malformed trigger acknowledgment', itemIndex);
	}
	return value;
};

export const executeNotificationOperation = async (
	context: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> => {
	if (operation === 'cancelExecution') {
		const transactionId = requiredString(
			context,
			'cancelTransactionId',
			'Transaction ID',
			itemIndex,
		);
		const response = unwrapNovuDataEnvelope(
			await novuApiRequest<unknown>(context, {
				method: 'DELETE',
				version: 'v1',
				pathSegments: ['events', 'trigger', transactionId],
				itemIndex,
			}),
		);
		if (typeof response !== 'boolean')
			throw localError(context, 'Novu returned a malformed cancellation response', itemIndex);
		return [{ json: { transactionId, cancelled: response }, pairedItem: itemIndex }];
	}
	if (operation !== 'triggerWorkflow') {
		throw localError(context, `Unsupported Notification operation: ${operation}`, itemIndex);
	}
	const workflowIdentifier = normalizeWorkflowIdentifier(
		context,
		context.getNodeParameter('workflowIdentifier', itemIndex),
		itemIndex,
	);
	const recipientType = context.getNodeParameter('recipientType', itemIndex, 'subscriber');
	if (recipientType !== 'subscriber' && recipientType !== 'topic')
		throw localError(context, 'Recipient Type must be Subscriber or Topic', itemIndex);
	const to: string | IDataObject =
		recipientType === 'topic'
			? {
					type: 'Topic',
					topicKey: requiredString(context, 'recipientTopicKey', 'Topic Key', itemIndex),
				}
			: requiredString(context, 'subscriberId', 'External Subscriber ID', itemIndex);
	const payload = parsePayload(context, context.getNodeParameter('payload', itemIndex), itemIndex);
	const rawOptions = context.getNodeParameter('triggerOptions', itemIndex, {});
	if (!isObject(rawOptions)) throw localError(context, 'Options must be an object', itemIndex);
	const options = rawOptions as IDataObject;
	const transactionId = options.transactionId;
	const idempotencyKey = options.idempotencyKey;
	if (
		options.retryWithIdempotencyKey !== undefined &&
		typeof options.retryWithIdempotencyKey !== 'boolean'
	) {
		throw localError(context, 'Retry With Idempotency Key must be a boolean', itemIndex);
	}
	const retry = options.retryWithIdempotencyKey === true;
	if (transactionId !== undefined && typeof transactionId !== 'string') {
		throw localError(context, 'Transaction ID must be a string', itemIndex);
	}
	if (idempotencyKey !== undefined && typeof idempotencyKey !== 'string') {
		throw localError(context, 'Idempotency Key must be a string', itemIndex);
	}
	if (typeof idempotencyKey === 'string' && idempotencyKey.length > 255) {
		throw localError(context, 'Idempotency Key must not exceed 255 characters', itemIndex);
	}
	if (retry && !idempotencyKey) {
		throw localError(
			context,
			'Retry With Idempotency Key requires a non-empty Idempotency Key',
			itemIndex,
		);
	}

	const body: IDataObject = { name: workflowIdentifier, to, payload };
	if (transactionId) body.transactionId = transactionId;
	const response = unwrapNovuDataEnvelope(
		await novuApiRequest<unknown>(context, {
			method: 'POST',
			version: 'v1',
			pathSegments: ['events', 'trigger'],
			body,
			...(idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {}),
			retryPolicy: retry ? 'idempotent-trigger' : 'none',
			itemIndex,
		}),
	);
	return [{ json: assertTriggerResponse(context, response, itemIndex), pairedItem: itemIndex }];
};
