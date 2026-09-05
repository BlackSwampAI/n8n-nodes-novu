import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

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

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=ApiKey {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL:
				'={{$credentials.region === "eu" ? "https://eu.api.novu.co" : $credentials.region === "custom" ? $credentials.customBaseUrl : "https://api.novu.co"}}',
			url: '/v2/workflows',
			method: 'GET',
			qs: { limit: 1 },
		},
	};
}
