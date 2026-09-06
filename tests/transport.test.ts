import type { IExecuteFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';

import { novuApiRequest } from '../nodes/Novu/shared/transport';

const makeContext = (request: (type: string, options: IHttpRequestOptions) => Promise<unknown>) =>
	({
		getCredentials: vi.fn().mockResolvedValue({
			apiKey: 'not-for-output',
			region: 'custom',
			customBaseUrl: 'https://novu.example.com/prefix/',
		}),
		getNode: vi.fn().mockReturnValue({ name: 'Novu', type: 'novu', typeVersion: 1 }),
		helpers: { httpRequestWithAuthentication: vi.fn(request) },
	}) as unknown as IExecuteFunctions;

describe('Novu transport', () => {
	it('uses n8n credential authentication with an explicit versioned URL', async () => {
		const request = vi.fn().mockResolvedValue({ workflows: [], totalCount: 0 });
		const context = makeContext(request);

		await expect(
			novuApiRequest(context, {
				method: 'GET',
				version: 'v2',
				pathSegments: ['workflows'],
				qs: { limit: 1 },
			}),
		).resolves.toEqual({ workflows: [], totalCount: 0 });
		expect(request).toHaveBeenCalledWith('novuApi', {
			method: 'GET',
			url: 'https://novu.example.com/prefix/v2/workflows',
			json: true,
			qs: { limit: 1 },
		});
	});

	it('does not permit callers to override credential authentication', async () => {
		const context = makeContext(vi.fn());
		await expect(
			novuApiRequest(context, {
				method: 'GET',
				version: 'v2',
				pathSegments: ['workflows'],
				headers: { authorization: 'Bearer unsafe' },
			}),
		).rejects.toThrow('Authorization is managed by Novu credentials');
	});

	it('maps transport errors without exposing the API key', async () => {
		const context = makeContext(async () => {
			throw { statusCode: 401, message: 'not-for-output' };
		});
		await expect(
			novuApiRequest(context, {
				method: 'GET',
				version: 'v2',
				pathSegments: ['workflows'],
			}),
		).rejects.toThrow('Check the API key and selected region');
	});
});
