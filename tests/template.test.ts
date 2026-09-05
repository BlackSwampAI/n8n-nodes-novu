// Template invariant tests intentionally inspect repository files.
// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('raw template safety and tooling', () => {
	it('is private and keeps examples explicitly registered', async () => {
		const packageJson = JSON.parse(await read('package.json')) as {
			private?: boolean;
			packageManager?: string;
			engines: { node: string };
			devDependencies: Record<string, string>;
			n8n: { nodes: string[]; credentials: string[] };
		};
		expect(packageJson.private).toBe(true);
		expect(packageJson.packageManager).toBe('npm@11.19.0');
		expect(packageJson.engines.node).toBe('>=22.22.0');
		expect(packageJson.devDependencies).toMatchObject({
			'@n8n/node-cli': '0.46.4',
			eslint: '9.39.4',
			prettier: '3.8.3',
			'release-it': '20.2.0',
			typescript: '5.9.3',
			vitest: '4.1.11',
		});
		expect(packageJson.n8n.nodes).toEqual([
			'dist/nodes/GithubIssues/GithubIssues.node.js',
			'dist/nodes/Example/Example.node.js',
		]);
		expect(packageJson.n8n.credentials).toEqual([
			'dist/credentials/GithubIssuesApi.credentials.js',
			'dist/credentials/GithubIssuesOAuth2Api.credentials.js',
		]);
	});

	it('uses strict TypeScript and Vitest tests', async () => {
		const [testConfig, agents] = await Promise.all([read('tsconfig.test.json'), read('AGENTS.md')]);
		expect(testConfig).not.toMatch(/noImplicitAny.*false|noUnusedLocals.*false/);
		expect(agents).toContain('`*.test.ts`');
		expect(agents).toContain('Vitest');
	});

	it('keeps release and publish safeguards', async () => {
		const [releaseCheck, publish, ci] = await Promise.all([
			read('scripts/release-check.mjs'),
			read('.github/workflows/publish.yml'),
			read('.github/workflows/ci.yml'),
		]);
		expect(releaseCheck).toContain('TEMPLATE_ORIGIN');
		expect(releaseCheck).toContain('replace(/^ssh:\\/\\/git@github\\.com\\//');
		expect(releaseCheck).toContain('/<[A-Z][A-Z0-9_ -]*>/');
		expect(releaseCheck).toContain('/\\b(?:TODO|CHANGEME)\\b/i');
		expect(releaseCheck).not.toContain('/TODO|CHANGEME/i');
		expect(releaseCheck).toContain('/YOUR[-_][A-Z0-9_-]+/');
		expect(releaseCheck).not.toContain('YOUR[-_ ][A-Z0-9_-]*');
		expect(releaseCheck).not.toContain('<[^>]+>');
		expect(releaseCheck).not.toContain('_[a-z][^_]*_');
		expect(publish).toContain('id-token: write');
		expect(publish).toContain("'v*.*.*'");
		expect(publish).toContain('npm install --global npm@11.19.0');
		expect(ci).toContain('npm install --global npm@11.19.0');
	});
});
