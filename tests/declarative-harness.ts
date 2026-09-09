import type {
	DeclarativeRestApiSettings,
	IExecuteFunctions,
	IExecutePaginationFunctions,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	IN8nHttpFullResponse,
	INodeExecutionData,
	INodePropertyOptions,
} from 'n8n-workflow';

import { Novu } from '../nodes/Novu/Novu.node';
import { readNovuErrorStatus } from '../nodes/Novu/shared/errors';
import { resolveNovuBaseUrl } from '../nodes/Novu/shared/url';

type Request = (type: string, options: IHttpRequestOptions) => Promise<unknown>;

const optionFor = (resource: string, operation: string): INodePropertyOptions => {
	const property = new Novu().description.properties.find(
		(candidate) =>
			candidate.name === 'operation' &&
			candidate.displayOptions?.show?.resource?.includes(resource),
	);
	const option = ((property?.options ?? []) as INodePropertyOptions[]).find(
		(candidate) => candidate.value === operation,
	);
	if (!option) throw new Error(`Missing ${resource}/${operation} metadata`);
	return option;
};

export async function runDeclarative(context: IExecuteFunctions): Promise<INodeExecutionData[]> {
	const output: INodeExecutionData[] = [];
	const request = context.helpers.httpRequestWithAuthentication as unknown as Request;
	for (let itemIndex = 0; itemIndex < context.getInputData().length; itemIndex++) {
		try {
			const resource = context.getNodeParameter('resource', itemIndex) as string;
			const operation = context.getNodeParameter('operation', itemIndex) as string;
			const routing = optionFor(resource, operation).routing;
			if (!routing?.request)
				throw new Error(`Missing declarative route for ${resource}/${operation}`);
			const single = {
				getItemIndex: () => itemIndex,
				getInputData: () => context.getInputData()[itemIndex],
				getNode: () => context.getNode(),
				getNodeParameter: (name: string, fallback?: unknown) =>
					context.getNodeParameter(name, itemIndex, fallback),
			} as unknown as IExecuteSingleFunctions;
			let options: IHttpRequestOptions = {
				method: routing.request.method ?? 'GET',
				url: routing.request.url?.toString() ?? '',
				json: true,
			};
			for (const preSend of routing.send?.preSend ?? [])
				options = await preSend.call(single, options);

			const routeRequest = async (
				settings: DeclarativeRestApiSettings.ResultOptions,
			): Promise<INodeExecutionData[]> => {
				const credentials = await context.getCredentials('novuApi');
				const resolvedOptions = {
					...settings.options,
					url: settings.options.url?.startsWith('/')
						? `${resolveNovuBaseUrl(credentials)}${settings.options.url}`
						: settings.options.url,
				} as IHttpRequestOptions;
				let response: IN8nHttpFullResponse;
				try {
					response = {
						statusCode: 200,
						headers: {},
						body: (await request.call(
							context,
							'novuApi',
							resolvedOptions,
						)) as IN8nHttpFullResponse['body'],
					};
				} catch (error) {
					const statusCode = readNovuErrorStatus(error);
					// The harness preserves status-free routing failures for stop/continue assertions.
					// eslint-disable-next-line @n8n/community-nodes/require-node-api-error
					if (statusCode === undefined) throw error;
					response = { statusCode, headers: {}, body: {} };
				}
				let items: INodeExecutionData[] = [];
				for (const postReceive of routing.output?.postReceive ?? []) {
					if (typeof postReceive === 'function')
						items = await postReceive.call(single, items, response);
				}
				return items;
			};

			const settings = {
				options,
				preSend: [],
				postReceive: [],
			} as DeclarativeRestApiSettings.ResultOptions;
			let items: INodeExecutionData[];
			if (typeof routing.operations?.pagination === 'function') {
				const pagination = {
					...single,
					makeRoutingRequest: routeRequest,
				} as unknown as IExecutePaginationFunctions;
				items = await routing.operations.pagination.call(pagination, settings);
			} else {
				items = await routeRequest(settings);
			}
			output.push(...items.map((item) => ({ ...item, pairedItem: itemIndex })));
		} catch (error) {
			// The harness preserves the declarative engine's stop-on-error boundary.
			// eslint-disable-next-line @n8n/community-nodes/require-node-api-error
			if (!context.continueOnFail()) throw error;
			output.push({
				json: { error: error instanceof Error ? error.message : 'Unknown Novu error' },
				pairedItem: itemIndex,
			});
		}
	}
	return output;
}
