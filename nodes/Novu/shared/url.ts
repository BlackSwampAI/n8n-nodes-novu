import type { ICredentialDataDecryptedObject } from 'n8n-workflow';

export type NovuRegion = 'us' | 'eu' | 'custom';
export type NovuApiVersion = 'v1' | 'v2';

export const NOVU_CLOUD_BASE_URLS: Record<Exclude<NovuRegion, 'custom'>, string> = {
	us: 'https://api.novu.co',
	eu: 'https://eu.api.novu.co',
};

const readCredentialString = (
	credentials: ICredentialDataDecryptedObject,
	name: string,
): string => {
	const value = credentials[name];
	return typeof value === 'string' ? value.trim() : '';
};

const parseUrl = (value: string): URL | undefined => {
	try {
		return new URL(value);
	} catch {
		return undefined;
	}
};

const decodePathSegment = (value: string): string | undefined => {
	try {
		return decodeURIComponent(value);
	} catch {
		return undefined;
	}
};

export const normalizeCustomBaseUrl = (value: string): string => {
	const trimmed = value.trim();
	if (!trimmed) throw new Error('Custom Base URL is required when Region is Custom');
	if (trimmed.includes('?')) throw new Error('Custom Base URL must not include a query string');
	if (trimmed.includes('#')) throw new Error('Custom Base URL must not include a fragment');

	const parsed = parseUrl(trimmed);
	if (!parsed) throw new Error('Custom Base URL must be a valid HTTPS URL');

	if (parsed.protocol !== 'https:') throw new Error('Custom Base URL must use HTTPS');
	if (!parsed.hostname) throw new Error('Custom Base URL must include a hostname');
	if (parsed.username || parsed.password)
		throw new Error('Custom Base URL must not include a username or password');

	const pathname = parsed.pathname.replace(/\/+$/, '');
	const pathSegments = pathname.split('/').filter(Boolean);
	const decodedPathSegments = pathSegments.map(decodePathSegment);
	if (decodedPathSegments.some((segment) => segment === undefined))
		throw new Error('Custom Base URL contains an invalid encoded path');
	const decodedFinalSegment = decodedPathSegments[decodedPathSegments.length - 1] ?? '';
	if (/^v[12]$/i.test(decodedFinalSegment))
		throw new Error('Custom Base URL must not end in /v1 or /v2');

	return `${parsed.origin}${pathname}`;
};

export const resolveNovuBaseUrl = (credentials: ICredentialDataDecryptedObject): string => {
	const region = readCredentialString(credentials, 'region') as NovuRegion;
	if (region === 'us' || region === 'eu') return NOVU_CLOUD_BASE_URLS[region];
	if (region === 'custom') {
		return normalizeCustomBaseUrl(readCredentialString(credentials, 'customBaseUrl'));
	}
	throw new Error('Novu Region must be US, EU, or Custom');
};

export const encodeNovuPathSegment = (value: string): string => {
	if (!value) throw new Error('Novu API path segments must not be empty');
	if (value === '.' || value === '..')
		throw new Error('Novu API path segments must not be dot traversal segments');
	return encodeURIComponent(value);
};

export const buildNovuApiUrl = (
	credentials: ICredentialDataDecryptedObject,
	version: NovuApiVersion,
	...pathSegments: string[]
): string => {
	if (!pathSegments.length) throw new Error('A version-owned Novu API route is required');
	const path = pathSegments.map(encodeNovuPathSegment).join('/');
	return `${resolveNovuBaseUrl(credentials)}/${version}/${path}`;
};
