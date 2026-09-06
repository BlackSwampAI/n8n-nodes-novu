import type { IExecuteFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';

import { novuApiRequest, type NovuRequestOptions } from '../nodes/Novu/shared/transport';

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

	it.each([
		[408, undefined, 1000],
		[409, '2', 2000],
		[429, '1', 1000],
		[500, undefined, 1000],
		[502, undefined, 1000],
		[503, undefined, 1000],
		[504, undefined, 1000],
		[undefined, undefined, 1000],
	])('retries transient status %s with bounded delays', async (statusCode, retryAfter, delay) => {
		const error =
			statusCode === undefined
				? new Error('timeout')
				: { statusCode, response: { headers: retryAfter ? { 'retry-after': retryAfter } : {} } };
		const request = vi.fn().mockRejectedValueOnce(error).mockResolvedValue({ ok: true });
		const retryDelay = vi.fn().mockResolvedValue(undefined);
		await expect(
			novuApiRequest(makeContext(request), {
				method: 'POST',
				version: 'v1',
				pathSegments: ['events', 'trigger'],
				body: { name: 'workflow', to: 'subscriber', payload: {} },
				headers: { 'Idempotency-Key': 'stable' },
				retryPolicy: 'idempotent-trigger',
				retryDelay,
			}),
		).resolves.toEqual({ ok: true });
		expect(retryDelay).toHaveBeenCalledWith(delay);
		expect(request).toHaveBeenCalledTimes(2);
		expect(request.mock.calls[1][1]).toEqual(request.mock.calls[0][1]);
	});

	it('uses deterministic exponential delay and stops after three identical attempts', async () => {
		const request = vi.fn().mockRejectedValue({ statusCode: 500 });
		const retryDelay = vi.fn().mockResolvedValue(undefined);
		await expect(
			novuApiRequest(makeContext(request), {
				method: 'POST',
				version: 'v1',
				pathSegments: ['events', 'trigger'],
				body: { name: 'workflow', to: 'subscriber', payload: {}, transactionId: 'tx' },
				headers: { 'Idempotency-Key': 'stable' },
				retryPolicy: 'idempotent-trigger',
				retryDelay,
				itemIndex: 2,
			}),
		).rejects.toThrow('failed after 3 attempts');
		expect(request).toHaveBeenCalledTimes(3);
		expect(retryDelay.mock.calls).toEqual([[1000], [2000]]);
		expect(request.mock.calls.every((call) => call[1] === request.mock.calls[0][1])).toBe(true);
	});

	it('does not retry terminal errors or Retry-After beyond the package cap', async () => {
		for (const statusCode of [400, 401, 402, 403, 404, 413, 422]) {
			const request = vi.fn().mockRejectedValue({ statusCode });
			await expect(
				novuApiRequest(makeContext(request), {
					method: 'POST',
					version: 'v1',
					pathSegments: ['events', 'trigger'],
					headers: { 'Idempotency-Key': 'stable' },
					retryPolicy: 'idempotent-trigger',
					retryDelay: vi.fn(),
				}),
			).rejects.toThrow();
			expect(request).toHaveBeenCalledTimes(1);
		}

		const request = vi.fn().mockRejectedValue({
			statusCode: 429,
			response: { headers: { 'retry-after': '31' } },
		});
		await expect(
			novuApiRequest(makeContext(request), {
				method: 'POST',
				version: 'v1',
				pathSegments: ['events', 'trigger'],
				headers: { 'Idempotency-Key': 'stable' },
				retryPolicy: 'idempotent-trigger',
				retryDelay: vi.fn(),
			}),
		).rejects.toThrow('30-second package cap');
		expect(request).toHaveBeenCalledTimes(1);
	});

	it.each([
		['missing key', { method: 'POST', version: 'v1', pathSegments: ['events', 'trigger'] }],
		[
			'empty key',
			{
				method: 'POST',
				version: 'v1',
				pathSegments: ['events', 'trigger'],
				headers: { 'IDEMPOTENCY-KEY': '' },
			},
		],
		[
			'wrong method',
			{
				method: 'PATCH',
				version: 'v1',
				pathSegments: ['events', 'trigger'],
				headers: { 'idempotency-key': 'stable' },
			},
		],
		[
			'wrong route',
			{
				method: 'POST',
				version: 'v2',
				pathSegments: ['subscribers'],
				headers: { 'Idempotency-Key': 'stable' },
			},
		],
	] as const)('rejects unsafe retry policy configuration: %s', async (_label, invalid) => {
		const request = vi.fn();
		await expect(
			novuApiRequest(makeContext(request), {
				...invalid,
				retryPolicy: 'idempotent-trigger',
			} as unknown as NovuRequestOptions),
		).rejects.toThrow('require POST /v1/events/trigger');
		expect(request).not.toHaveBeenCalled();
	});
});
