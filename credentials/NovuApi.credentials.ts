import type {
	IAuthenticate,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

import { resolveNovuBaseUrl } from '../nodes/Novu/shared/url';

export class NovuApi implements ICredentialType {
	name = 'novuApi';

	displayName = 'Novu API';

	icon: Icon = {
		light: 'file:../nodes/Novu/novu.svg',
		dark: 'file:../nodes/Novu/novu.dark.svg',
	};

	documentationUrl = 'https://docs.novu.co/api-reference/authentication';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'The secret API key for the Novu environment',
		},
		{
			displayName: 'Region',
			name: 'region',
			type: 'options',
			options: [
				{ name: 'US', value: 'us' },
				{ name: 'EU', value: 'eu' },
				{ name: 'Custom', value: 'custom' },
			],
			default: 'us',
			description: 'The Novu API region. Requests never fail over between regions.',
		},
		{
			displayName: 'Custom Base URL',
			name: 'customBaseUrl',
			type: 'string',
			default: '',
			placeholder: 'https://novu.example.com/api',
			description:
				'Origin and optional reverse-proxy prefix, without an API version, query, or fragment',
			displayOptions: { show: { region: ['custom'] } },
			required: true,
		},
	];

	authenticate: IAuthenticate = async (credentials, requestOptions) => {
		const apiKey = typeof credentials.apiKey === 'string' ? credentials.apiKey.trim() : '';
		if (!apiKey) throw new Error('Novu API Key is required');
		return {
			...requestOptions,
			baseURL: resolveNovuBaseUrl(credentials),
			headers: {
				...requestOptions.headers,
				Authorization: `ApiKey ${apiKey}`,
			},
		};
	};

	test: ICredentialTestRequest = {
		request: {
			url: '/v2/workflows',
			method: 'GET',
			qs: { limit: 1 },
		},
		rules: [
			{
				type: 'responseCode',
				properties: {
					value: 401,
					message: 'Novu rejected the API key. Check the key and selected region.',
				},
			},
			{
				type: 'responseCode',
				properties: {
					value: 403,
					message: 'The Novu API key lacks permission to list workflows.',
				},
			},
			{
				type: 'responseCode',
				properties: {
					value: 404,
					message:
						'The Novu v2 workflow route was not found. Check region, custom prefix, and API compatibility.',
				},
			},
			{
				type: 'responseCode',
				properties: {
					value: 429,
					message: 'Novu rate limit exceeded. Retry after the interval supplied by Novu.',
				},
			},
		],
	};
}
