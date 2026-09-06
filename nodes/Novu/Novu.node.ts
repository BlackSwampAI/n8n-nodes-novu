import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export class Novu implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Novu',
		name: 'novu',
		icon: { light: 'file:novu.svg', dark: 'file:novu.dark.svg' },
		group: ['transform'],
		version: 1,
		description: 'Work with the Novu notification platform',
		subtitle: 'Batch 2 transport foundation',
		defaults: { name: 'Novu' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'novuApi', required: true }],
		properties: [
			{
				displayName:
					'The Batch 2 credential and transport foundation is ready, but no API operations are exposed yet. Subscriber operations begin in Batch 3.',
				name: 'batchOneNotice',
				type: 'notice',
				default: '',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		throw new NodeOperationError(
			this.getNode(),
			'No Novu operations are exposed through the Batch 2 transport foundation',
		);
	}
}
