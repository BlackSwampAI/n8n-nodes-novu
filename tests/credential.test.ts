import type { IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { NovuApi } from '../credentials/NovuApi.credentials';

describe('Novu credential', () => {
	it('authenticates with ApiKey and a normalized custom base', async () => {
		const credential = new NovuApi();
		const request: IHttpRequestOptions = { url: '/v2/workflows', headers: { Accept: 'json' } };
		if (typeof credential.authenticate !== 'function') throw new Error('Expected function auth');
		const result = await credential.authenticate(
			{
				apiKey: ' secret-value ',
				region: 'custom',
				customBaseUrl: 'https://novu.example.com/proxy/',
			},
			request,
		);
		expect(result).toMatchObject({
			baseURL: 'https://novu.example.com/proxy',
			headers: { Accept: 'json', Authorization: 'ApiKey secret-value' },
		});
	});

	it('overwrites a caller-supplied Authorization header', async () => {
		const credential = new NovuApi();
		if (typeof credential.authenticate !== 'function') throw new Error('Expected function auth');
		const result = await credential.authenticate(
			{ apiKey: 'secret-value', region: 'us' },
			{ url: '/v2/workflows', headers: { Authorization: 'Bearer caller-value' } },
		);
		expect(result.headers?.Authorization).toBe('ApiKey secret-value');
	});

	it('defines a low-volume read-only test and categorized response rules', () => {
		const credential = new NovuApi();
		expect(credential.test.request).toMatchObject({
			method: 'GET',
			url: '/v2/workflows',
			qs: { limit: 1 },
		});
		expect(credential.test.rules?.map((rule) => rule.properties.value)).toEqual([
			401, 403, 404, 429,
		]);
	});

	it('refuses missing API keys before a request', async () => {
		const credential = new NovuApi();
		if (typeof credential.authenticate !== 'function') throw new Error('Expected function auth');
		await expect(
			credential.authenticate({ apiKey: '', region: 'us' }, { url: '/v2/workflows' }),
		).rejects.toThrow('Novu API Key is required');
	});
});
