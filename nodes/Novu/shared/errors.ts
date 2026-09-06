type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | undefined =>
	typeof value === 'object' && value !== null ? (value as UnknownRecord) : undefined;

const readStatus = (error: unknown): number | undefined => {
	const root = asRecord(error);
	const response = asRecord(root?.response);
	for (const candidate of [
		root?.httpCode,
		root?.statusCode,
		root?.status,
		response?.statusCode,
		response?.status,
	]) {
		const value = typeof candidate === 'string' ? Number(candidate) : candidate;
		if (typeof value === 'number' && Number.isInteger(value)) return value;
	}
	return undefined;
};

const readRetryAfter = (error: unknown): string | undefined => {
	const root = asRecord(error);
	const response = asRecord(root?.response);
	const headers = asRecord(response?.headers) ?? asRecord(root?.headers);
	const value = headers?.['retry-after'] ?? headers?.['Retry-After'];
	return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
};

export const redactSecret = (value: string, secret?: string): string =>
	secret ? value.split(secret).join('[REDACTED]') : value;

export const describeNovuError = (error: unknown, secret?: string): string => {
	const status = readStatus(error);
	if (status === 401)
		return 'Novu rejected the credentials. Check the API key and selected region.';
	if (status === 403)
		return 'Novu authenticated the request but the API key lacks permission for this operation.';
	if (status === 404)
		return 'Novu could not find the resource or route. Check the identifier, region, custom prefix, and API compatibility.';
	if (status === 429) {
		const retryAfter = readRetryAfter(error);
		return retryAfter
			? `Novu rate limit exceeded. Retry-After: ${redactSecret(retryAfter, secret)} seconds.`
			: 'Novu rate limit exceeded. Retry after the interval supplied by Novu.';
	}
	if (status !== undefined) return `Novu API request failed with HTTP status ${status}.`;
	return 'Unable to reach the Novu API. Check the base URL, DNS, network access, and TLS configuration.';
};
