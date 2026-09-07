// Example contract tests intentionally inspect repository JSON.
// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const paths = ['customer-onboarding.json', 'topic-opt-in-out.json'];
const communityType = '@blackswampai/n8n-nodes-novu.novu';

describe('sanitized importable workflow examples', () => {
	it.each(paths)('%s is inactive, credential-free, and uses only permitted nodes', async (path) => {
		const source = await readFile(new URL(`../examples/${path}`, import.meta.url), 'utf8');
		const workflow = JSON.parse(source) as {
			active: boolean;
			nodes: Array<{ type: string; typeVersion: number; credentials?: unknown }>;
		};
		expect(workflow.active).toBe(false);
		expect(workflow.nodes.some(({ type }) => type === 'n8n-nodes-base.manualTrigger')).toBe(true);
		expect(workflow.nodes.some(({ type }) => type === 'n8n-nodes-base.set')).toBe(true);
		for (const node of workflow.nodes) {
			expect(['n8n-nodes-base.manualTrigger', 'n8n-nodes-base.set', communityType]).toContain(
				node.type,
			);
			expect(node.credentials).toBeUndefined();
			if (node.type === communityType) expect(node.typeVersion).toBe(1);
		}
		expect(source).not.toMatch(/ApiKey|Authorization|credentials\s*"\s*:/i);
	});

	it('customer onboarding upserts a subscriber and triggers a manually identified workflow', async () => {
		const workflow = JSON.parse(
			await readFile(new URL('../examples/customer-onboarding.json', import.meta.url), 'utf8'),
		) as { nodes: Array<{ type: string; parameters: Record<string, unknown> }> };
		expect(
			workflow.nodes
				.filter(({ type }) => type === communityType)
				.map(({ parameters }) => [parameters.resource, parameters.operation]),
		).toEqual([
			['subscriber', 'createOrUpdate'],
			['notification', 'triggerWorkflow'],
		]);
		expect(workflow.nodes[workflow.nodes.length - 1]?.parameters.workflowIdentifier).toEqual({
			mode: 'id',
			value: 'replace-with-workflow-id',
		});
	});

	it('topic example creates a topic and relationship with opt-out disabled', async () => {
		const workflow = JSON.parse(
			await readFile(new URL('../examples/topic-opt-in-out.json', import.meta.url), 'utf8'),
		) as { nodes: Array<{ disabled?: boolean; parameters: Record<string, unknown> }> };
		expect(
			workflow.nodes.map(({ parameters }) => [parameters.resource, parameters.operation]),
		).toEqual(
			expect.arrayContaining([
				['topic', 'createOrUpdate'],
				['topicSubscription', 'create'],
				['topicSubscription', 'delete'],
			]),
		);
		expect(
			workflow.nodes.find(({ parameters }) => parameters.operation === 'delete')?.disabled,
		).toBe(true);
	});
});
