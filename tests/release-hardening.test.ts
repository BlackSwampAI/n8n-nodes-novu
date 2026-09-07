// Release-tool tests intentionally use Node built-ins and disposable local files.
// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports
import { tmpdir } from 'node:os';
// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error Operational release helper intentionally remains direct-execution JavaScript.
const { prepareNpmAuth } = await import('../scripts/prepare-npm-auth.mjs');
const { isDeterministicSecurityFailure, isLikelyPropagationFailure } =
	// @ts-expect-error Operational release policy helper intentionally remains JavaScript.
	await import('../scripts/scan-policy.mjs');

const temporaryDirectories: string[] = [];
afterEach(() => {
	for (const directory of temporaryDirectories.splice(0))
		rmSync(directory, { recursive: true, force: true });
});

describe('npm authentication preparation', () => {
	it('preserves token bootstrap configuration', () => {
		const directory = mkdtempSync(join(tmpdir(), 'novu-auth-test-'));
		temporaryDirectories.push(directory);
		const config = join(directory, '.npmrc');
		const contents = '//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}\nprovenance=true\n';
		writeFileSync(config, contents);
		expect(prepareNpmAuth({ NODE_AUTH_TOKEN: 'present', NPM_CONFIG_USERCONFIG: config })).toBe(
			'token',
		);
		expect(readFileSync(config, 'utf8')).toBe(contents);
	});

	it('removes only the empty setup-node placeholder for OIDC', () => {
		const directory = mkdtempSync(join(tmpdir(), 'novu-auth-test-'));
		temporaryDirectories.push(directory);
		const config = join(directory, '.npmrc');
		writeFileSync(
			config,
			'registry=https://registry.npmjs.org/\n//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}\nprovenance=true\n',
		);
		expect(prepareNpmAuth({ NODE_AUTH_TOKEN: '', NPM_CONFIG_USERCONFIG: config })).toBe('oidc');
		expect(readFileSync(config, 'utf8')).toBe(
			'registry=https://registry.npmjs.org/\nprovenance=true\n',
		);
	});
});

describe('published scanner retry policy', () => {
	const packageSpec = '@blackswampai/n8n-nodes-novu@0.1.0';

	it('retries only exact known propagation failures for this version', () => {
		for (const reason of [
			'Reason: Analysis failed: Request failed with status code 404',
			'Reason: No package metadata found for version 0.1.0',
			"Reason: Could not fetch the source repository recorded in the package's npm provenance (Request failed with status code 404).",
		])
			expect(
				isLikelyPropagationFailure(
					`Package ${packageSpec} has failed security checks\n${reason}`,
					packageSpec,
				),
			).toBe(true);
		expect(
			isLikelyPropagationFailure(
				'Reason: No package metadata found for version 0.1.1',
				packageSpec,
			),
		).toBe(false);
	});

	it('rejects security output and unrelated failures immediately', () => {
		for (const reason of [
			'Reason: ESLint violations found\nfile.ts:404:3 error',
			'Reason: Analysis failed: Request timed out',
			'Reason: Analysis failed: Request failed with status code 403',
			'Reason: Analysis failed: Request failed with status code 429',
			'Reason: Could not fetch source repository (Request failed with status code 404)',
		]) {
			const output = `Package ${packageSpec} has failed security checks\n${reason}`;
			expect(isLikelyPropagationFailure(output, packageSpec)).toBe(false);
			expect(isDeterministicSecurityFailure(output, packageSpec)).toBe(true);
		}
	});
});
