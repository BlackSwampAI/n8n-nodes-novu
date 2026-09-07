// Scaffold invariant tests intentionally inspect repository files.
// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('private Novu Batch 9 release-candidate safeguards', () => {
	it('has final working identity while publication stays blocked', async () => {
		const packageJson = JSON.parse(await read('package.json')) as {
			name: string;
			private?: boolean;
			repository: { url: string };
			dependencies?: Record<string, string>;
			peerDependencies: Record<string, string>;
			devDependencies: Record<string, string>;
			n8n: { nodes: string[]; credentials: string[]; strict: boolean };
		};

		expect(packageJson.name).toBe('@blackswampai/n8n-nodes-novu');
		expect(packageJson.private).toBe(true);
		expect(packageJson.repository.url).toBe('https://github.com/BlackSwampAI/n8n-nodes-novu.git');
		expect(packageJson.dependencies ?? {}).toEqual({});
		expect(packageJson.peerDependencies).toEqual({ 'n8n-workflow': '*' });
		expect(packageJson.devDependencies['@n8n/scan-community-package']).toBe('0.34.0');
		expect(packageJson.n8n).toMatchObject({
			strict: true,
			nodes: ['dist/nodes/Novu/Novu.node.js'],
			credentials: ['dist/credentials/NovuApi.credentials.js'],
		});
	});

	it('advertises exactly the implemented release-candidate resources', async () => {
		const [node, readme, status] = await Promise.all([
			read('nodes/Novu/Novu.node.ts'),
			read('README.md'),
			read('docs/STATUS.md'),
		]);

		const resourceOptions = node.match(
			/displayName: 'Resource'[\s\S]*?options:\s*\[([\s\S]*?)\],\s*default:/,
		)?.[1];
		expect(
			[...(resourceOptions ?? '').matchAll(/value: '([^']+)'/g)].map((match) => match[1]),
		).toEqual([
			'notification',
			'subscriber',
			'subscriberPreference',
			'topic',
			'topicSubscription',
			'workflow',
		]);
		expect(readme).toContain('Create or Update');
		expect(readme).toContain('Topic Subscription');
		expect(status).toContain('Live Novu requests: none');
	});

	it('records required contract decisions and release controls', async () => {
		const [coverage, adr, releaseCheck, packageCheck, ci, branding, matrix, testing, migration] =
			await Promise.all([
				read('docs/API_COVERAGE.md'),
				read('docs/decisions/0001-node-architecture.md'),
				read('scripts/release-check.mjs'),
				read('scripts/validate-pack.mjs'),
				read('.github/workflows/ci.yml'),
				read('docs/branding.md'),
				read('docs/api-matrix.md'),
				read('docs/testing.md'),
				read('docs/TEMPLATE_MIGRATIONS.md'),
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
		expect(releaseCheck).toContain('CI must run build before');
		expect(releaseCheck).toContain('publish workflow must remain absent');
		expect(branding).toContain('cf904665b2916e631c29f3187d6afe5169a7db89');
		expect(matrix).toContain('Topic Subscription / Delete');
		expect(testing).toContain('npm run smoke:install');
		expect(migration).toContain('Template 2.0.1');
		expect(releaseCheck).toContain("marker.templateVersion !== '2.0.1'");
		expect(releaseCheck).toContain("'--omit=peer'");
		expect(releaseCheck).toContain("['@n8n/scan-community-package', '0.34.0']");
	});

	it('packages the immutable official Novu adaptive icon for both themes', async () => {
		const [light, dark, metadata] = await Promise.all([
			read('nodes/Novu/novu.svg'),
			read('nodes/Novu/novu.dark.svg'),
			read('nodes/Novu/Novu.node.json'),
		]);
		const expected = 'cb594d2b275dc9308df325c348388b9395d7eae615b366ef9f9ba02267b08c82';
		expect(createHash('sha256').update(light).digest('hex')).toBe(expected);
		expect(createHash('sha256').update(dark).digest('hex')).toBe(expected);
		expect(metadata).toContain('@blackswampai/n8n-nodes-novu.novu');
	});
});
