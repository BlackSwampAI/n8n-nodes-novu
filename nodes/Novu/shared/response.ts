export const unwrapNovuDataEnvelope = (value: unknown): unknown => {
	if (
		typeof value !== 'object' ||
		value === null ||
		Array.isArray(value) ||
		!Object.prototype.hasOwnProperty.call(value, 'data')
	) {
		return undefined;
	}
	return (value as { data: unknown }).data;
};
