import type {
	GenericValue,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { describeNovuError } from './errors';
import { buildNovuApiUrl, type NovuApiVersion } from './url';

export type NovuRetryPolicy = 'none';

export interface NovuRequestOptions {
	method: IHttpRequestMethods;
	version: NovuApiVersion;
	pathSegments: string[];
	qs?: Record<string, GenericValue>;
	body?: GenericValue | GenericValue[];
	headers?: Record<string, GenericValue>;
	itemIndex?: number;
	retryPolicy?: NovuRetryPolicy;
}

export const novuApiRequest = async <T>(
	context: IExecuteFunctions,
	options: NovuRequestOptions,
): Promise<T> => {
	const credentials = await context.getCredentials('novuApi');
	const apiKey = typeof credentials.apiKey === 'string' ? credentials.apiKey : undefined;
	if (Object.keys(options.headers ?? {}).some((name) => name.toLowerCase() === 'authorization')) {
		throw new NodeOperationError(context.getNode(), 'Authorization is managed by Novu credentials');
	}

	const requestOptions: IHttpRequestOptions = {
		method: options.method,
		url: buildNovuApiUrl(credentials, options.version, ...options.pathSegments),
		json: true,
		...(options.qs ? { qs: options.qs } : {}),
		...(options.body !== undefined ? { body: options.body } : {}),
		...(options.headers ? { headers: options.headers } : {}),
	};

	try {
		return (await context.helpers.httpRequestWithAuthentication.call(
			context,
			'novuApi',
			requestOptions,
		)) as T;
	} catch (error) {
		throw new NodeOperationError(context.getNode(), describeNovuError(error, apiKey), {
			...(options.itemIndex !== undefined ? { itemIndex: options.itemIndex } : {}),
		});
	}
};
