// Scaffold invariant tests intentionally inspect repository files.
// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('private Novu Batch 1 scaffold', () => {
	it('has final working identity while publication stays blocked', async () => {
		const packageJson = JSON.parse(await read('package.json')) as {
			name: string;
			private?: boolean;
			repository: { url: string };
			dependencies?: Record<string, string>;
			peerDependencies: Record<string, string>;
			n8n: { nodes: string[]; credentials: string[]; strict: boolean };
		};

		expect(packageJson.name).toBe('n8n-nodes-novu');
		expect(packageJson.private).toBe(true);
		expect(packageJson.repository.url).toBe('https://github.com/BlackSwampAI/n8n-nodes-novu.git');
		expect(packageJson.dependencies ?? {}).toEqual({});
		expect(packageJson.peerDependencies).toEqual({ 'n8n-workflow': '*' });
		expect(packageJson.n8n).toMatchObject({
			strict: true,
			nodes: ['dist/nodes/Novu/Novu.node.js'],
			credentials: ['dist/credentials/NovuApi.credentials.js'],
		});
	});

	it('advertises only the implemented Subscriber resource', async () => {
		const [node, readme, status] = await Promise.all([
			read('nodes/Novu/Novu.node.ts'),
			read('README.md'),
			read('docs/STATUS.md'),
		]);

		expect(node).toContain("value: 'subscriber'");
		expect(node).not.toContain("value: 'notification'");
		expect(readme).toContain('Create or Update');
		expect(status).toContain('Live Novu requests: none');
	});

	it('records required contract decisions and release controls', async () => {
		const [coverage, adr, releaseCheck, packageCheck, ci, publish] = await Promise.all([
			read('docs/API_COVERAGE.md'),
			read('docs/decisions/0001-node-architecture.md'),
			read('scripts/release-check.mjs'),
			read('scripts/validate-pack.mjs'),
			read('.github/workflows/ci.yml'),
			read('.github/workflows/publish.yml'),
		]);

		for (const contract of [
			'DELETE /v2/topics/{topicKey}/subscriptions',
			'GET /v2/workflows',
			'PATCH /v2/subscribers/{subscriberId}/preferences',
			'DELETE /v1/events/trigger/{transactionId}',
		]) {
			expect(coverage).toContain(contract);
		}
		expect(adr).toContain('no runtime dependencies');
		expect(releaseCheck).toContain('private initialization audit passed');
		expect(packageCheck).toContain('template fixture artifact must not be packed');
		expect(ci).toContain('branches: [main]');
		expect(ci).toContain('pull_request:');
		expect(publish).toContain("'v*.*.*'");
	});
});
