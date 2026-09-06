import { describe, expect, it } from 'vitest';

import { describeNovuError, redactSecret } from '../nodes/Novu/shared/errors';

describe('Novu error mapping', () => {
	it.each([
		[401, 'API key and selected region'],
		[403, 'lacks permission'],
		[404, 'resource or route'],
		[500, 'HTTP status 500'],
	])('maps HTTP %s without upstream body leakage', (status, message) => {
		const result = describeNovuError({ response: { status, data: { apiKey: 'top-secret' } } });
		expect(result).toContain(message);
		expect(result).not.toContain('top-secret');
	});

	it('includes Retry-After context for rate limits', () => {
		expect(
			describeNovuError({ statusCode: 429, response: { headers: { 'retry-after': '12' } } }),
		).toBe('Novu rate limit exceeded. Retry-After: 12 seconds.');
	});

	it('maps status-free failures to a network-safe message', () => {
		expect(describeNovuError(new Error('request leaked abc123'), 'abc123')).toBe(
			'Unable to reach the Novu API. Check the base URL, DNS, network access, and TLS configuration.',
		);
	});

	it('redacts every exact secret occurrence', () => {
		expect(redactSecret('key=secret and secret', 'secret')).toBe('key=[REDACTED] and [REDACTED]');
	});
});
