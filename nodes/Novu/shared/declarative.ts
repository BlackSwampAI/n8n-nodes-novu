import type {
	IDataObject,
	IExecutePaginationFunctions,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	IN8nHttpFullResponse,
	INodeExecutionData,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { describeNovuError } from './errors';

export type RoutingContext = IExecuteSingleFunctions | IExecutePaginationFunctions;

export const isObject = (value: unknown): value is IDataObject =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

export const routingError = (context: RoutingContext, message: string) =>
	new NodeOperationError(context.getNode(), message, { itemIndex: context.getItemIndex() });

export const requiredString = (
	context: RoutingContext,
	parameter: string,
	label: string,
): string => {
	const value = context.getNodeParameter(parameter);
	if (typeof value !== 'string' || value.length === 0)
		throw routingError(context, `${label} must be a non-empty string`);
	return value;
};

export const encodedParameter = (
	context: RoutingContext,
	parameter: string,
	label: string,
): string => encodeURIComponent(requiredString(context, parameter, label));

export const setRequest = (
	request: IHttpRequestOptions,
	method: IHttpRequestOptions['method'],
	url: string,
	body?: IDataObject,
	qs?: IDataObject,
): IHttpRequestOptions => ({
	...request,
	method,
	url,
	...(body !== undefined ? { body } : {}),
	...(qs !== undefined && Object.keys(qs).length ? { qs } : {}),
});

export const assertHttpSuccess = (
	context: RoutingContext,
	response: IN8nHttpFullResponse,
): void => {
	if (response.statusCode >= 200 && response.statusCode < 300) return;
	throw routingError(context, describeNovuError({ statusCode: response.statusCode }));
};

export const unwrapRawEnvelope = (_context: RoutingContext, value: unknown): unknown => {
	if (!isObject(value) || !Object.prototype.hasOwnProperty.call(value, 'data')) return undefined;
	return value.data;
};

export const one = (json: IDataObject): INodeExecutionData[] => [{ json }];

export const receiveWrapped = async (
	context: RoutingContext,
	response: IN8nHttpFullResponse,
	validator: (value: unknown) => IDataObject,
): Promise<INodeExecutionData[]> => {
	assertHttpSuccess(context, response);
	return one(validator(unwrapRawEnvelope(context, response.body)));
};

export const receiveDirect = async (
	context: RoutingContext,
	response: IN8nHttpFullResponse,
	validator: (value: unknown) => IDataObject,
): Promise<INodeExecutionData[]> => {
	assertHttpSuccess(context, response);
	return one(validator(response.body));
};

export const pageRequest = async (
	context: IExecutePaginationFunctions,
	requestOptions: Parameters<IExecutePaginationFunctions['makeRoutingRequest']>[0],
): Promise<INodeExecutionData[]> => context.makeRoutingRequest(requestOptions);
