import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { unwrapNovuDataEnvelope } from '../shared/response';
import { novuApiRequest } from '../shared/transport';

const CHANNELS = ['email', 'sms', 'in_app', 'push', 'chat', 'tool'] as const;
const isObject = (value: unknown): value is IDataObject =>
	typeof value === 'object' && value !== null && !Array.isArray(value);
const localError = (context: IExecuteFunctions, message: string, itemIndex: number) =>
	new NodeOperationError(context.getNode(), message, { itemIndex });

const subscriberId = (context: IExecuteFunctions, itemIndex: number): string => {
	const value = context.getNodeParameter('subscriberId', itemIndex);
	if (typeof value !== 'string' || value.length === 0)
		throw localError(context, 'External Subscriber ID must be a non-empty string', itemIndex);
	return value;
};

const assertPreferences = (
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): IDataObject => {
	if (!isObject(value) || !isObject(value.global) || !Array.isArray(value.workflows)) {
		throw localError(context, 'Novu returned a malformed preference envelope', itemIndex);
	}
	return value;
};

export const executeSubscriberPreferenceOperation = async (
	context: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> => {
	const id = subscriberId(context, itemIndex);
	if (operation === 'get') {
		const criticality = context.getNodeParameter('criticality', itemIndex, '');
		const contextKeys = context.getNodeParameter('contextKeys', itemIndex, []);
		if (
			typeof criticality !== 'string' ||
			!['', 'critical', 'nonCritical', 'all'].includes(criticality)
		)
			throw localError(context, 'Criticality is invalid', itemIndex);
		if (!Array.isArray(contextKeys) || !contextKeys.every((key) => typeof key === 'string'))
			throw localError(context, 'Context Keys must be an array of strings', itemIndex);
		const qs: IDataObject = {};
		if (criticality) qs.criticality = criticality;
		if (contextKeys.length) qs.contextKeys = contextKeys;
		const response = unwrapNovuDataEnvelope(
			await novuApiRequest<unknown>(context, {
				method: 'GET',
				version: 'v2',
				pathSegments: ['subscribers', id, 'preferences'],
				...(Object.keys(qs).length ? { qs } : {}),
				itemIndex,
			}),
		);
		return [{ json: assertPreferences(context, response, itemIndex), pairedItem: itemIndex }];
	}
	if (operation === 'update') {
		const scope = context.getNodeParameter('preferenceScope', itemIndex);
		if (scope !== 'global' && scope !== 'workflow')
			throw localError(context, 'Preference Scope must be Global or Workflow', itemIndex);
		const rawChannels = context.getNodeParameter('preferenceChannels', itemIndex, {});
		if (!isObject(rawChannels)) throw localError(context, 'Channels must be an object', itemIndex);
		const channelSelections = rawChannels as IDataObject;
		const channels: IDataObject = {};
		for (const channel of CHANNELS) {
			const state = channelSelections[channel] ?? 'unchanged';
			if (!['unchanged', 'enabled', 'disabled'].includes(state as string))
				throw localError(context, `Invalid ${channel} preference state`, itemIndex);
			if (state !== 'unchanged') channels[channel] = state === 'enabled';
		}
		if (!Object.keys(channels).length)
			throw localError(context, 'Select at least one channel to enable or disable', itemIndex);
		const body: IDataObject = { channels };
		if (scope === 'workflow') {
			const reference = context.getNodeParameter('workflowReference', itemIndex);
			if (typeof reference !== 'string' || reference.length === 0)
				throw localError(context, 'Workflow Reference must be a non-empty string', itemIndex);
			body.workflowId = reference;
		}
		const response = unwrapNovuDataEnvelope(
			await novuApiRequest<unknown>(context, {
				method: 'PATCH',
				version: 'v2',
				pathSegments: ['subscribers', id, 'preferences'],
				body,
				itemIndex,
			}),
		);
		return [{ json: assertPreferences(context, response, itemIndex), pairedItem: itemIndex }];
	}
	throw localError(context, `Unsupported Subscriber Preference operation: ${operation}`, itemIndex);
};
