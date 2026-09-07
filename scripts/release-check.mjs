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
const releasing = read('RELEASING.md');
const sourceScanner = read('scripts/scan-source.mjs');
const publishedScanner = read('scripts/scan-published.mjs');
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

for (const path of [
	'LICENSE.md',
	'CHANGELOG.md',
	'RELEASING.md',
	'vitest.config.mts',
	'tsconfig.test.json',
	'.github/workflows/ci.yml',
	'.github/workflows/publish.yml',
	'.blackswamp/template.json',
	'docs/branding.md',
	'docs/api-matrix.md',
	'docs/testing.md',
	'docs/BATCH_HANDOFF_TEMPLATE.md',
	'docs/TEMPLATE_MIGRATIONS.md',
	'docs/SMOKE_TESTS.md',
	'docs/RELEASE_NOTES.md',
	'docs/SUBMISSION_CHECKLIST.md',
	'examples/customer-onboarding.json',
	'examples/topic-opt-in-out.json',
	'.github/pull_request_template.md',
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
	'scan:source',
	'scan:published',
	'smoke:load',
	'smoke:install',
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
	['@n8n/scan-community-package', '0.34.0'],
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
if (!/timeout-minutes:\s*30/.test(publishWorkflow))
	fail('publish must have a 30-minute job timeout');
const [publishJob, verifyPublishedJob = ''] = publishWorkflow.split(/\n {2}verify-published:\s*\n/);
const publishPreamble = publishJob.slice(0, publishJob.indexOf('\njobs:'));
if (/id-token:\s*write/.test(publishPreamble))
	fail('id-token: write must be scoped to the publish job');
if (!/id-token:\s*write/.test(publishJob) || !/contents:\s*read/.test(publishJob))
	fail('publish job permissions are incomplete');
if (
	!/needs:\s*publish/.test(verifyPublishedJob) ||
	!verifyPublishedJob.includes('actions/checkout@v6') ||
	!verifyPublishedJob.includes('actions/setup-node@v6') ||
	!verifyPublishedJob.includes('package-manager-cache: false') ||
	!verifyPublishedJob.includes('npm install --global npm@11.19.0') ||
	!verifyPublishedJob.includes('npm ci') ||
	!verifyPublishedJob.includes('npm run scan:published') ||
	!/contents:\s*read/.test(verifyPublishedJob) ||
	!/timeout-minutes:\s*30/.test(verifyPublishedJob)
)
	fail(
		'verify-published must be a fresh, pinned-toolchain, read-only, bounded job that depends on publish',
	);
if (publishJob.includes('npm run scan:published') || verifyPublishedJob.includes('npm run release'))
	fail('publication and published verification must remain separate jobs');
if (/id-token:\s*write/.test(verifyPublishedJob))
	fail('verify-published must not receive id-token: write');
if (!publishWorkflow.includes('secrets.NPM_TOKEN'))
	fail('publish must retain first-publication token bootstrap support');
for (const path of [
	'scripts/prepare-npm-auth.mjs',
	'scripts/verify-npm-version.mjs',
	'scripts/scan-published.mjs',
	'scripts/scan-policy.mjs',
])
	if (!existsSync(resolve(root, path))) fail(`${path} is required`);
if (!publishedScanner.includes('has passed all security checks'))
	fail('published scan must require explicit official scanner success');
if (
	!sourceScanner.includes('SOURCE_FILE_PATTERNS') ||
	!sourceScanner.includes("'dist/**/*.js'") ||
	!sourceScanner.includes("'package.json'")
)
	fail('source scanner must inspect source and built-package patterns');
for (const [label, workflow] of [
	['CI', ciWorkflow],
	['publish', publishWorkflow],
]) {
	if (!workflow.includes('npm install --global npm@11.19.0')) {
		fail(`${label} workflow must install npm 11.19.0 before npm ci`);
	}
}
if (!/timeout-minutes:\s*20/.test(ciWorkflow)) fail('CI must have a 20-minute timeout');
for (const gate of ['scan:source', 'package:check', 'smoke:load', 'smoke:install'])
	if (!ciWorkflow.includes(`npm run ${gate}`)) fail(`CI must run npm run ${gate}`);
const ciCommands = [...ciWorkflow.matchAll(/^\s*- run:\s*(.+)$/gm)].map((match) => match[1].trim());
const buildIndex = ciCommands.indexOf('npm run build');
for (const command of [
	'npm run scan:source',
	'npm run package:check',
	'npm run smoke:load',
	'npm run smoke:install',
]) {
	if (buildIndex < 0 || ciCommands.indexOf(command) <= buildIndex)
		fail(`CI must run build before ${command}`);
}
if (packageJson.name !== '@blackswampai/n8n-nodes-novu')
	fail('scoped package identity is required');
if (packageJson.homepage !== 'https://blackswampai.com/n8n-nodes/novu/')
	fail('canonical homepage is required');
if (packageJson.private === true) fail('public release candidate must not be private');
if (packageJson.n8n?.nodes?.length !== 1 || packageJson.n8n?.credentials?.length !== 1)
	fail('compiled node and credential registrations are required');
const marker = JSON.parse(read('.blackswamp/template.json'));
if (
	marker.schemaVersion !== 1 ||
	marker.templateVersion !== '2.0.1' ||
	marker.sourceRepository !== TEMPLATE_ORIGIN
)
	fail('Template v2.0.1 provenance marker is invalid');
const expectedIconHash = 'cb594d2b275dc9308df325c348388b9395d7eae615b366ef9f9ba02267b08c82';
const { createHash } = await import('node:crypto');
for (const icon of ['nodes/Novu/novu.svg', 'nodes/Novu/novu.dark.svg'])
	if (
		createHash('sha256')
			.update(readFileSync(resolve(root, icon)))
			.digest('hex') !== expectedIconHash
	)
		fail(`official Novu icon hash changed: ${icon}`);
for (const gate of ['format:check', 'lint', 'typecheck', 'test', 'build', 'package:check']) {
	if (
		!ciWorkflow.includes(`npm run ${gate}`) &&
		!(gate === 'test' && ciWorkflow.includes('npm test'))
	) {
		fail(`CI must run npm run ${gate}`);
	}
}
for (const [label, workflow] of [
	['CI', ciWorkflow],
	['publish', publishWorkflow],
]) {
	const build = workflow.indexOf('npm run build');
	const scan = workflow.indexOf('npm run scan:source');
	const pack = workflow.indexOf('npm run package:check');
	if (build < 0 || scan < build || pack < scan)
		fail(`${label} must scan source/built output after build and before packaging`);
	for (const command of ['npm run smoke:load', 'npm run smoke:install'])
		if (!workflow.includes(command)) fail(`${label} must run ${command}`);
}
for (const command of ['node scripts/verify-npm-version.mjs', 'node scripts/prepare-npm-auth.mjs'])
	if (!publishJob.includes(command)) fail(`publish must run ${command}`);
if (
	/private prerelease|installation is intentionally unavailable|do not attempt to install/i.test(
		readme,
	)
)
	fail('README contains private/unavailable release-state wording');
if (/npm publish/.test(releasing) && !/Never run `npm publish` locally/.test(releasing))
	fail('RELEASING must prohibit local npm publish');
if (process.env.GITHUB_REF_TYPE === 'tag') {
	const expectedTag = `v${packageJson.version}`;
	if (process.env.GITHUB_REF_NAME !== expectedTag)
		fail(`release tag must exactly match package version (${expectedTag})`);
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
		'## Troubleshooting',
		'## Resources',
		'## License',
	]) {
		if (!readme.includes(heading)) fail(`README is missing ${heading}`);
	}
	if (hasPlaceholder(readme)) fail('README still contains template placeholders');
	if (/nodes\/Example|nodes\/GithubIssues|GithubIssuesApi/.test(JSON.stringify(packageJson.n8n)))
		fail('remove or replace template example registrations');
	const nodeSource = read('nodes/Novu/Novu.node.ts');
	const resourceOptions = nodeSource.match(
		/displayName: 'Resource'[\s\S]*?options:\s*\[([\s\S]*?)\],\s*default:/,
	)?.[1];
	const resources = [...(resourceOptions ?? '').matchAll(/value: '([^']+)'/g)]
		.map((match) => match[1])
		.sort();
	const expectedResources = [
		'notification',
		'subscriber',
		'subscriberPreference',
		'topic',
		'topicSubscription',
		'workflow',
	].sort();
	if (JSON.stringify(resources) !== JSON.stringify(expectedResources))
		fail(`Novu resources must be exactly ${expectedResources.join(', ')}`);
	for (const document of [
		'docs/api-matrix.md',
		'docs/testing.md',
		'docs/branding.md',
		'docs/SMOKE_TESTS.md',
		'docs/RELEASE_NOTES.md',
		'docs/SUBMISSION_CHECKLIST.md',
	]) {
		const content = read(document);
		if (content.length < 500 || /\b(?:TODO|CHANGEME)\b/i.test(content))
			fail(`${document} must be completed rather than a placeholder`);
	}
	for (const example of ['examples/customer-onboarding.json', 'examples/topic-opt-in-out.json']) {
		const workflow = JSON.parse(read(example));
		if (workflow.active !== false) fail(`${example} must be inactive`);
		if (!workflow.nodes?.some((node) => node.type === '@blackswampai/n8n-nodes-novu.novu'))
			fail(`${example} must contain the Novu node`);
		if (workflow.nodes?.some((node) => node.credentials))
			fail(`${example} must not contain credentials`);
	}
	for (const safeguard of [
		'optional package root',
		'createRequire',
		'referencedCredentials',
		'viewBox',
	]) {
		const smoke = read('scripts/node-load-smoke.mjs');
		if (safeguard === 'optional package root') {
			if (!smoke.includes('process.argv[2]'))
				fail('load smoke must accept an optional package root');
		} else if (!smoke.includes(safeguard)) fail(`load smoke is missing ${safeguard} safeguard`);
	}
	const installSmoke = read('scripts/package-install-smoke.mjs');
	for (const flag of ['--ignore-scripts', '--no-package-lock', '--omit=peer'])
		if (!installSmoke.includes(flag)) fail(`install smoke must use ${flag}`);
	if (!installSmoke.includes('NODE_PATH'))
		fail('install smoke must resolve host-provided peers through development NODE_PATH');
}

if (failures.length) {
	console.error('Release audit failed:\n');
	for (const failure of failures) console.error(`- ${failure}`);
	process.exit(1);
}
console.log(
	isTemplateMode
		? 'Template audit passed in fail-closed private mode'
		: `Release audit passed for ${packageJson.name}@${packageJson.version}`,
);
