import type { IExecuteFunctions, IHttpRequestOptions, INodeExecutionData } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';

import { Novu } from '../nodes/Novu/Novu.node';
import { subscriberPreferenceProperties } from '../nodes/Novu/resources/subscriberPreference.description';

type Parameters = Record<string, unknown>;
const makeContext = (
	parameters: Parameters[],
	request: (type: string, options: IHttpRequestOptions) => Promise<unknown>,
	continueOnFail = false,
) =>
	({
		getInputData: vi.fn().mockReturnValue(parameters.map(() => ({ json: {} }))),
		getNodeParameter: vi.fn((name: string, itemIndex: number, fallback?: unknown) =>
			Object.prototype.hasOwnProperty.call(parameters[itemIndex], name)
				? parameters[itemIndex][name]
				: fallback,
		),
		getCredentials: vi.fn().mockResolvedValue({ apiKey: 'secret', region: 'us' }),
		getNode: vi.fn().mockReturnValue({ name: 'Novu', type: 'novu', typeVersion: 1 }),
		continueOnFail: vi.fn().mockReturnValue(continueOnFail),
		helpers: { httpRequestWithAuthentication: vi.fn(request) },
	}) as unknown as IExecuteFunctions;
const run = async (context: IExecuteFunctions): Promise<INodeExecutionData[]> =>
	(await new Novu().execute.call(context))[0];
const envelope = {
	global: { enabled: true, channels: { email: true, tool: false }, schedule: { isEnabled: false } },
	workflows: [{ workflow: { identifier: 'order' }, channels: { sms: false }, overrides: {} }],
};

describe('Subscriber Preference metadata', () => {
	it('exposes Get/Update, six tri-state channels, and conditional workflow reference', () => {
		const operation = subscriberPreferenceProperties.find(
			(property) => property.name === 'operation',
		);
		expect(operation?.options).toEqual([
			expect.objectContaining({ value: 'get' }),
			expect.objectContaining({ value: 'update' }),
		]);
		const channels = subscriberPreferenceProperties.find(
			(property) => property.name === 'preferenceChannels',
		);
		expect(channels?.options?.map((option) => option.name).sort()).toEqual(
			['chat', 'email', 'in_app', 'push', 'sms', 'tool'].sort(),
		);
		const workflow = subscriberPreferenceProperties.find(
			(property) => property.name === 'workflowReference',
		);
		expect(workflow?.displayOptions?.show?.preferenceScope).toEqual(['workflow']);
	});
});

describe('Subscriber Preference Get', () => {
	it('omits optional query and preserves the full response', async () => {
		const request = vi.fn().mockResolvedValue(envelope);
		const output = await run(
			makeContext(
				[{ resource: 'subscriberPreference', operation: 'get', subscriberId: 'customer/a' }],
				request,
			),
		);
		expect(request).toHaveBeenCalledWith('novuApi', {
			method: 'GET',
			url: 'https://api.novu.co/v2/subscribers/customer%2Fa/preferences',
			json: true,
		});
		expect(output).toEqual([{ json: envelope, pairedItem: 0 }]);
	});

	it('includes criticality and context key arrays', async () => {
		const request = vi.fn().mockResolvedValue(envelope);
		await run(
			makeContext(
				[
					{
						resource: 'subscriberPreference',
						operation: 'get',
						subscriberId: 'id',
						criticality: 'all',
						contextKeys: ['tenant:one', 'region:us'],
					},
				],
				request,
			),
		);
		expect(request).toHaveBeenCalledWith(
			'novuApi',
			expect.objectContaining({
				qs: { criticality: 'all', contextKeys: ['tenant:one', 'region:us'] },
			}),
		);
	});

	it.each([
		[{ subscriberId: '', criticality: '', contextKeys: [] }, 'External Subscriber ID'],
		[{ subscriberId: 'id', criticality: 'urgent', contextKeys: [] }, 'Criticality'],
		[{ subscriberId: 'id', criticality: '', contextKeys: 'tenant' }, 'Context Keys'],
		[{ subscriberId: 'id', criticality: '', contextKeys: ['valid', 1] }, 'Context Keys'],
	])('rejects malformed GET input locally', async (specific, message) => {
		const request = vi.fn();
		await expect(
			run(
				makeContext([{ resource: 'subscriberPreference', operation: 'get', ...specific }], request),
			),
		).rejects.toThrow(message);
		expect(request).not.toHaveBeenCalled();
	});
});

describe('Subscriber Preference Update', () => {
	it('omits workflowId globally and sends only changed true/false channels', async () => {
		const request = vi.fn().mockResolvedValue(envelope);
		await run(
			makeContext(
				[
					{
						resource: 'subscriberPreference',
						operation: 'update',
						subscriberId: 'id',
						preferenceScope: 'global',
						preferenceChannels: {
							email: 'enabled',
							sms: 'disabled',
							in_app: 'unchanged',
							push: 'unchanged',
							chat: 'unchanged',
							tool: 'enabled',
						},
					},
				],
				request,
			),
		);
		expect(request).toHaveBeenCalledWith(
			'novuApi',
			expect.objectContaining({
				method: 'PATCH',
				body: { channels: { email: true, sms: false, tool: true } },
			}),
		);
	});

	it('serializes every documented channel and omits the one marked unchanged', async () => {
		const request = vi.fn().mockResolvedValue(envelope);
		await run(
			makeContext(
				[
					{
						resource: 'subscriberPreference',
						operation: 'update',
						subscriberId: 'id',
						preferenceScope: 'global',
						preferenceChannels: {
							email: 'enabled',
							sms: 'disabled',
							in_app: 'enabled',
							push: 'disabled',
							chat: 'enabled',
							tool: 'unchanged',
						},
					},
				],
				request,
			),
		);
		expect(request).toHaveBeenCalledWith(
			'novuApi',
			expect.objectContaining({
				body: {
					channels: { email: true, sms: false, in_app: true, push: false, chat: true },
				},
			}),
		);
		expect((request.mock.calls[0][1].body as { channels: object }).channels).not.toHaveProperty(
			'tool',
		);
	});

	it('includes an exact workflow reference and resolves two input items', async () => {
		const request = vi.fn().mockResolvedValue(envelope);
		const params = ['workflow-slug', '_internal'].map((workflowReference, index) => ({
			resource: 'subscriberPreference',
			operation: 'update',
			subscriberId: `id-${index}`,
			preferenceScope: 'workflow',
			workflowReference,
			preferenceChannels: { push: index ? 'disabled' : 'enabled' },
		}));
		const output = await run(makeContext(params, request));
		expect(request.mock.calls.map((call) => call[1].body as Record<string, unknown>)).toEqual([
			{ channels: { push: true }, workflowId: 'workflow-slug' },
			{ channels: { push: false }, workflowId: '_internal' },
		]);
		expect(output.map((item) => item.pairedItem)).toEqual([0, 1]);
	});

	it.each([
		[{ preferenceScope: 'global', preferenceChannels: {} }, 'Select at least one'],
		[{ preferenceScope: 'bad', preferenceChannels: { email: 'enabled' } }, 'Scope'],
		[
			{
				preferenceScope: 'workflow',
				workflowReference: '',
				preferenceChannels: { email: 'enabled' },
			},
			'Workflow Reference',
		],
		[{ preferenceScope: 'global', preferenceChannels: { email: 'bad' } }, 'Invalid email'],
	])('rejects invalid/no-op input locally', async (specific, message) => {
		const request = vi.fn();
		await expect(
			run(
				makeContext(
					[
						{
							resource: 'subscriberPreference',
							operation: 'update',
							subscriberId: 'id',
							...specific,
						},
					],
					request,
				),
			),
		).rejects.toThrow(message);
		expect(request).not.toHaveBeenCalled();
	});

	it('rejects malformed responses and continues after request failure', async () => {
		await expect(
			run(
				makeContext(
					[
						{
							resource: 'subscriberPreference',
							operation: 'get',
							subscriberId: 'id',
						},
					],
					vi.fn().mockResolvedValue({ global: {}, workflows: {} }),
				),
			),
		).rejects.toThrow('malformed');
		const request = vi
			.fn()
			.mockRejectedValueOnce({ statusCode: 404 })
			.mockResolvedValueOnce(envelope);
		const params = ['missing', 'present'].map((subscriberId) => ({
			resource: 'subscriberPreference',
			operation: 'get',
			subscriberId,
		}));
		await expect(run(makeContext(params, request, true))).resolves.toEqual([
			{ json: { error: expect.stringContaining('resource or route') }, pairedItem: 0 },
			{ json: envelope, pairedItem: 1 },
		]);
	});
});
