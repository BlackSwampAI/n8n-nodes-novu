import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const TEMPLATE_ORIGIN = 'https://github.com/christopherjnelson/n8n-community-node-template';
const failures = [];
const fail = (message) => failures.push(message);
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const normalizeGitHubUrl = (value = '') =>
	String(value)
		.trim()
		.replace(/^ssh:\/\/git@github\.com\//, 'https://github.com/')
		.replace(/^git@github\.com:/, 'https://github.com/')
		.replace(/^git\+/, '')
		.replace(/\.git\/?$/, '')
		.replace(/\/$/, '');
const hasPlaceholder = (value) =>
	typeof value === 'string' &&
	(/<[A-Z][A-Z0-9_ -]*>/.test(value) ||
		/\b(?:TODO|CHANGEME)\b/i.test(value) ||
		/YOUR[-_][A-Z0-9_-]+/.test(value));

const packageJson = JSON.parse(read('package.json'));
const readme = read('README.md');
const publishWorkflow = read('.github/workflows/publish.yml');
const ciWorkflow = read('.github/workflows/ci.yml');
let origin = '';
try {
	const dotGit = resolve(root, '.git');
	const gitDirectory = statSync(dotGit).isDirectory()
		? dotGit
		: resolve(root, readFileSync(dotGit, 'utf8').slice('gitdir:'.length).trim());
	const gitConfig = readFileSync(resolve(gitDirectory, 'config'), 'utf8');
	const originSection = gitConfig.match(/\[remote "origin"\]([\s\S]*?)(?=\n\[|$)/)?.[1] ?? '';
	origin = normalizeGitHubUrl(originSection.match(/^\s*url\s*=\s*(.+)$/m)?.[1]);
	if (!origin) throw new Error('origin URL is missing');
} catch (error) {
	fail(
		`unable to verify the GitHub origin: ${error instanceof Error ? error.message : 'unknown error'}`,
	);
}
const isTemplateMode = origin === TEMPLATE_ORIGIN;
const isPrivateInitialization = !isTemplateMode && packageJson.private === true;

for (const path of [
	'LICENSE.md',
	'CHANGELOG.md',
	'RELEASING.md',
	'vitest.config.mts',
	'tsconfig.test.json',
	'.github/workflows/ci.yml',
	'.github/workflows/publish.yml',
]) {
	if (!existsSync(resolve(root, path))) fail(`${path} is required`);
}
for (const script of [
	'format',
	'format:check',
	'lint',
	'lint:fix',
	'typecheck',
	'test',
	'test:unit',
	'build',
	'release:check',
	'package:check',
	'release',
	'prepublishOnly',
]) {
	if (!packageJson.scripts?.[script]) fail(`package.json script ${script} is required`);
}
if (packageJson.scripts?.release !== 'n8n-node release') fail('release must use n8n-node release');
if (packageJson.scripts?.prepublishOnly !== 'n8n-node prerelease')
	fail('prepublishOnly must use n8n-node prerelease');
if (packageJson.scripts?.test !== 'vitest run') fail('test must run Vitest');
if (!packageJson.scripts?.typecheck?.includes('tsconfig.test.json'))
	fail('typecheck must include strict test TypeScript');
if (packageJson.devDependencies?.vitest !== '4.1.11') fail('Vitest must be pinned to 4.1.11');
if (packageJson.packageManager !== 'npm@11.19.0') fail('packageManager must pin npm@11.19.0');
for (const [dependency, version] of [
	['@n8n/node-cli', '0.46.4'],
	['eslint', '9.39.4'],
	['prettier', '3.8.3'],
	['release-it', '20.2.0'],
	['typescript', '5.9.3'],
	['vitest', '4.1.11'],
]) {
	if (packageJson.devDependencies?.[dependency] !== version) {
		fail(`${dependency} must be pinned to ${version}`);
	}
}
if (packageJson.engines?.node !== '>=22.22.0') fail('engines.node must be >=22.22.0');
if (packageJson.allowScripts?.['eslint-plugin-n8n-nodes-base'] !== false)
	fail('eslint-plugin install scripts must be denied');
if (Object.keys(packageJson.dependencies ?? {}).length)
	fail('runtime dependencies are not allowed');
if (packageJson.peerDependencies?.['n8n-workflow'] !== '*')
	fail('n8n-workflow must remain a host-provided peer');
if (packageJson.n8n?.strict !== true) fail('n8n.strict must be true');
if (packageJson.files?.length !== 1 || packageJson.files[0] !== 'dist')
	fail('package files must expose only dist');
if (!publishWorkflow.includes("- 'v*.*.*'")) fail('publish must be tag-only');
if (!/id-token:\s*write/.test(publishWorkflow) || !/contents:\s*read/.test(publishWorkflow))
	fail('publish permissions are incomplete');
if (!publishWorkflow.includes('secrets.NPM_TOKEN'))
	fail('publish must retain bootstrap token support');
for (const [label, workflow] of [
	['CI', ciWorkflow],
	['publish', publishWorkflow],
]) {
	if (!workflow.includes('npm install --global npm@11.19.0')) {
		fail(`${label} workflow must install npm 11.19.0 before npm ci`);
	}
}
for (const gate of ['format:check', 'lint', 'typecheck', 'test', 'build', 'package:check']) {
	if (
		!ciWorkflow.includes(`npm run ${gate}`) &&
		!(gate === 'test' && ciWorkflow.includes('npm test'))
	) {
		fail(`CI must run npm run ${gate}`);
	}
}

if (isTemplateMode) {
	if (packageJson.private !== true) fail('raw template must remain private');
	if (packageJson.name !== 'n8n-nodes-community-template') fail('template package name changed');
	if (normalizeGitHubUrl(packageJson.repository?.url) !== TEMPLATE_ORIGIN)
		fail('template repository URL must match origin');
	for (const example of [
		'dist/nodes/Example/Example.node.js',
		'dist/nodes/GithubIssues/GithubIssues.node.js',
	]) {
		if (!packageJson.n8n?.nodes?.includes(example)) fail(`template must retain ${example}`);
	}
	if (!readme.includes('Use this template'))
		fail('template README must explain GitHub template use');
} else {
	if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?n8n-nodes-[a-z0-9][a-z0-9._-]*$/.test(packageJson.name ?? ''))
		fail('name must be a final scoped or unscoped n8n-nodes-* name');
	for (const [label, value] of [
		['name', packageJson.name],
		['description', packageJson.description],
		['homepage', packageJson.homepage],
		['repository.url', packageJson.repository?.url],
		['author.name', packageJson.author?.name],
		['author.email', packageJson.author?.email],
	]) {
		if (!value || hasPlaceholder(value)) fail(`package.json ${label} is missing or a placeholder`);
	}
	if (isPrivateInitialization && !readme.includes('private scaffold'))
		fail('private initialization README must identify the package as a private scaffold');
	if (packageJson.license !== 'MIT' || packageJson.publishConfig?.access !== 'public')
		fail('normal mode requires MIT and public publish config');
	if (!packageJson.keywords?.includes('n8n-community-node-package'))
		fail('community keyword is required');
	if (!packageJson.n8n?.nodes?.length) fail('register at least one compiled node');
	if (normalizeGitHubUrl(packageJson.repository?.url) !== origin)
		fail('repository.url must match origin');
	for (const heading of [
		'## Installation',
		'## Compatibility',
		'## Credentials',
		'## Operations',
		'## Resources',
		'## License',
	]) {
		if (!readme.includes(heading)) fail(`README is missing ${heading}`);
	}
	if (hasPlaceholder(readme)) fail('README still contains template placeholders');
	if (/nodes\/Example|nodes\/GithubIssues|GithubIssuesApi/.test(JSON.stringify(packageJson.n8n)))
		fail('remove or replace template example registrations');
}

if (failures.length) {
	console.error('Release audit failed:\n');
	for (const failure of failures) console.error(`- ${failure}`);
	process.exit(1);
}
console.log(
	isTemplateMode
		? 'Template audit passed in fail-closed private mode'
		: isPrivateInitialization
			? `Fail-closed private Batch 1 initialization audit passed for ${packageJson.name}@${packageJson.version}; npm publication remains blocked`
			: `Release audit passed for ${packageJson.name}@${packageJson.version}`,
);
