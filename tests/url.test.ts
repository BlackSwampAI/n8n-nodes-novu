import type { ICredentialDataDecryptedObject } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import {
	buildNovuApiUrl,
	encodeNovuPathSegment,
	normalizeCustomBaseUrl,
	resolveNovuBaseUrl,
} from '../nodes/Novu/shared/url';

const credentials = (region: string, customBaseUrl = ''): ICredentialDataDecryptedObject => ({
	region,
	customBaseUrl,
	apiKey: 'secret',
});

describe('Novu base URLs', () => {
	it('selects fixed US and EU hosts without failover', () => {
		expect(resolveNovuBaseUrl(credentials('us'))).toBe('https://api.novu.co');
		expect(resolveNovuBaseUrl(credentials('eu'))).toBe('https://eu.api.novu.co');
	});

	it('normalizes a custom HTTPS prefix and trailing slashes', () => {
		expect(normalizeCustomBaseUrl(' https://novu.example.com/proxy/novu/// ')).toBe(
			'https://novu.example.com/proxy/novu',
		);
		expect(normalizeCustomBaseUrl('https://novu.example.com/')).toBe('https://novu.example.com');
	});

	it.each([
		['', 'required'],
		['not a url', 'valid HTTPS URL'],
		['http://novu.example.com', 'use HTTPS'],
		['ftp://novu.example.com', 'use HTTPS'],
		['https://user:pass@novu.example.com', 'username or password'],
		['https://novu.example.com?region=us', 'query string'],
		['https://novu.example.com/path?', 'query string'],
		['https://novu.example.com#fragment', 'fragment'],
		['https://novu.example.com/path#', 'fragment'],
		['https://novu.example.com/v1', 'must not end in /v1 or /v2'],
		['https://novu.example.com/proxy/v2/', 'must not end in /v1 or /v2'],
		['https://novu.example.com/%76%31', 'must not end in /v1 or /v2'],
		['https://novu.example.com/%ZZ/prefix', 'invalid encoded path'],
	])('rejects unsafe custom URL %s', (value, message) => {
		expect(() => normalizeCustomBaseUrl(value)).toThrow(message);
	});

	it('requires a known region', () => {
		expect(() => resolveNovuBaseUrl(credentials('automatic'))).toThrow(
			'Novu Region must be US, EU, or Custom',
		);
	});
});

describe('Novu API URL construction', () => {
	it('owns the version per operation and preserves custom prefixes', () => {
		expect(
			buildNovuApiUrl(
				credentials('custom', 'https://novu.example.com/reverse/'),
				'v2',
				'workflows',
			),
		).toBe('https://novu.example.com/reverse/v2/workflows');
		expect(buildNovuApiUrl(credentials('us'), 'v1', 'events', 'trigger')).toBe(
			'https://api.novu.co/v1/events/trigger',
		);
	});

	it('encodes every user-controlled path segment', () => {
		expect(encodeNovuPathSegment('subscriber/with spaces?#')).toBe(
			'subscriber%2Fwith%20spaces%3F%23',
		);
		expect(buildNovuApiUrl(credentials('eu'), 'v2', 'subscribers', 'a/b')).toBe(
			'https://eu.api.novu.co/v2/subscribers/a%2Fb',
		);
	});

	it('rejects absent or empty route segments', () => {
		expect(() => buildNovuApiUrl(credentials('us'), 'v2')).toThrow('route is required');
		expect(() => buildNovuApiUrl(credentials('us'), 'v2', 'subscribers', '')).toThrow(
			'must not be empty',
		);
	});

	it.each(['.', '..'])('rejects dot-only path segment %s', (segment) => {
		expect(() => buildNovuApiUrl(credentials('us'), 'v2', 'subscribers', segment)).toThrow(
			'dot traversal segments',
		);
	});
});
