import type {
	GenericValue,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeOperationError, sleep } from 'n8n-workflow';

import { describeNovuError, readNovuErrorStatus, readNovuRetryAfter } from './errors';
import { buildNovuApiUrl, type NovuApiVersion } from './url';

export type NovuRetryPolicy = 'none' | 'idempotent-trigger';

const MAX_ATTEMPTS = 3;
const MAX_RETRY_AFTER_SECONDS = 30;
const defaultDelay = async (milliseconds: number): Promise<void> => await sleep(milliseconds);

export interface NovuRequestOptions {
	method: IHttpRequestMethods;
	version: NovuApiVersion;
	pathSegments: string[];
	qs?: Record<string, GenericValue>;
	body?: GenericValue | GenericValue[];
	headers?: Record<string, GenericValue>;
	itemIndex?: number;
	retryPolicy?: NovuRetryPolicy;
	retryDelay?: (milliseconds: number) => Promise<void>;
}

export const novuApiRequest = async <T>(
	context: IExecuteFunctions,
	options: NovuRequestOptions,
): Promise<T> => {
	if (options.retryPolicy === 'idempotent-trigger') {
		const idempotencyKey = Object.entries(options.headers ?? {}).find(
			([name]) => name.toLowerCase() === 'idempotency-key',
		)?.[1];
		const validRoute =
			options.method === 'POST' &&
			options.version === 'v1' &&
			options.pathSegments.length === 2 &&
			options.pathSegments[0] === 'events' &&
			options.pathSegments[1] === 'trigger';
		if (!validRoute || typeof idempotencyKey !== 'string' || idempotencyKey.length === 0) {
			throw new NodeOperationError(
				context.getNode(),
				'Idempotent trigger retries require POST /v1/events/trigger with a non-empty Idempotency-Key header',
				{ ...(options.itemIndex !== undefined ? { itemIndex: options.itemIndex } : {}) },
			);
		}
	}
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

	const retryEnabled = options.retryPolicy === 'idempotent-trigger';
	for (let attempt = 1; attempt <= (retryEnabled ? MAX_ATTEMPTS : 1); attempt++) {
		try {
			return (await context.helpers.httpRequestWithAuthentication.call(
				context,
				'novuApi',
				requestOptions,
			)) as T;
		} catch (error) {
			const status = readNovuErrorStatus(error);
			const retryable =
				retryEnabled &&
				(status === undefined || [408, 409, 429, 500, 502, 503, 504].includes(status));
			if (!retryable || attempt === MAX_ATTEMPTS) {
				const detail = describeNovuError(error, apiKey);
				const message =
					retryable && attempt === MAX_ATTEMPTS
						? `Novu request failed after ${MAX_ATTEMPTS} attempts. ${detail}`
						: detail;
				throw new NodeOperationError(context.getNode(), message, {
					...(options.itemIndex !== undefined ? { itemIndex: options.itemIndex } : {}),
				});
			}

			const retryAfter = readNovuRetryAfter(error);
			const retryAfterSeconds = retryAfter === undefined ? undefined : Number(retryAfter);
			if (
				retryAfterSeconds !== undefined &&
				Number.isFinite(retryAfterSeconds) &&
				retryAfterSeconds >= 0 &&
				retryAfterSeconds > MAX_RETRY_AFTER_SECONDS
			) {
				throw new NodeOperationError(
					context.getNode(),
					`Novu requested Retry-After longer than the ${MAX_RETRY_AFTER_SECONDS}-second package cap; the request was not retried.`,
					{ ...(options.itemIndex !== undefined ? { itemIndex: options.itemIndex } : {}) },
				);
			}
			const delayMilliseconds =
				retryAfterSeconds !== undefined &&
				Number.isFinite(retryAfterSeconds) &&
				retryAfterSeconds >= 0
					? retryAfterSeconds * 1000
					: 2 ** (attempt - 1) * 1000;
			await (options.retryDelay ?? defaultDelay)(delayMilliseconds);
		}
	}
	throw new NodeOperationError(context.getNode(), 'Novu request failed unexpectedly');
};
