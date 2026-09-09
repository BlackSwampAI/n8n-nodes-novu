import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function prepareNpmAuth(environment = process.env) {
	const setupNodeSentinel = 'XXXXX-XXXXX-XXXXX-XXXXX';
	const token = environment.NODE_AUTH_TOKEN;
	if (token && token !== setupNodeSentinel)
		throw new Error('Token authentication is forbidden; publish through npm Trusted Publishing');
	if (token === setupNodeSentinel) {
		if (!environment.GITHUB_ENV)
			throw new Error('GITHUB_ENV is required to clear the setup-node authentication sentinel');
		appendFileSync(environment.GITHUB_ENV, 'NODE_AUTH_TOKEN=\n');
	}
	const userConfig = environment.NPM_CONFIG_USERCONFIG;
	if (!userConfig || !existsSync(userConfig)) return 'oidc';
	const contents = readFileSync(userConfig, 'utf8');
	const lines = contents.split(/(?<=\n)/);
	const filtered = lines.filter(
		(line) =>
			!/^\s*\/\/registry\.npmjs\.org\/:_authToken=\$\{NODE_AUTH_TOKEN\}\s*(?:\r?\n)?$/.test(line),
	);
	if (filtered.length !== lines.length) writeFileSync(userConfig, filtered.join(''));
	return 'oidc';
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	const mode = prepareNpmAuth();
	console.log(`npm authentication prepared for ${mode.toUpperCase()}`);
}
