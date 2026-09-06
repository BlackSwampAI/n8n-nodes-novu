import { createRequire } from 'node:module';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, extname, relative, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] ?? resolve(import.meta.dirname, '..'));
const packageFile = resolve(root, 'package.json');
if (!existsSync(packageFile)) throw new Error(`Package root has no package.json: ${root}`);
const realRoot = realpathSync(root);
const requireFromPackage = createRequire(packageFile);
const pkg = JSON.parse(readFileSync(packageFile, 'utf8'));

const isConfinedExistingPath = (path) => {
	const lexical = relative(root, path);
	if (!lexical || lexical === '..' || lexical.startsWith(`..${sep}`) || !existsSync(path))
		return false;
	const physical = relative(realRoot, realpathSync(path));
	return Boolean(physical && physical !== '..' && !physical.startsWith(`..${sep}`));
};

const instantiateExports = (file, registration) => {
	const module = requireFromPackage(file);
	const constructors = Object.entries(module).filter(([, value]) => typeof value === 'function');
	if (!constructors.length) throw new Error(`No constructor exports in ${registration}`);
	return constructors.map(([name, Constructor]) => {
		try {
			return { exportName: name, instance: new Constructor() };
		} catch (error) {
			throw new Error(
				`Could not instantiate ${name} from ${registration}: ${error instanceof Error ? error.message : 'unknown error'}`,
			);
		}
	});
};

const loadRegistration = (registration, kind) => {
	const file = resolve(root, registration);
	if (!isConfinedExistingPath(file))
		throw new Error(`Missing or unsafe compiled ${kind} registration: ${registration}`);
	const instances = instantiateExports(file, registration);
	const matches = instances.filter(({ instance }) =>
		kind === 'node'
			? typeof instance?.description?.name === 'string' && typeof instance?.execute === 'function'
			: typeof instance?.name === 'string' &&
				typeof instance?.displayName === 'string' &&
				Array.isArray(instance?.properties),
	);
	if (matches.length !== 1)
		throw new Error(
			`${registration} must export exactly one ${kind} constructor; found ${matches.length}`,
		);
	return { file, instance: matches[0].instance, registration };
};

const nodes = pkg.n8n.nodes.map((path) => loadRegistration(path, 'node'));
if (!nodes.length) throw new Error('Package must register at least one node');
const credentials = pkg.n8n.credentials.map((path) => loadRegistration(path, 'credential'));

for (const { instance, registration } of nodes) {
	if (!instance.description.displayName || instance.description.version === undefined)
		throw new Error(`${registration} must declare a node displayName and version`);
}
const referencedCredentials = new Set(
	nodes.flatMap(({ instance }) => instance.description.credentials?.map(({ name }) => name) ?? []),
);
for (const { instance, registration } of credentials) {
	if (!referencedCredentials.has(instance.name))
		throw new Error(
			`Registered credential ${instance.name} from ${registration} is unused by a node`,
		);
}

for (const { file, instance, registration } of [...nodes, ...credentials]) {
	const icon = instance.description?.icon ?? instance.icon;
	if (!icon) throw new Error(`${registration} must declare a packaged icon`);
	const references = typeof icon === 'string' ? [icon] : [icon.light, icon.dark].filter(Boolean);
	if (!references.length) throw new Error(`${registration} declares an empty icon`);
	for (const reference of references) {
		if (typeof reference !== 'string' || !reference.startsWith('file:'))
			throw new Error(`${registration} must declare packaged file icons`);
		const asset = resolve(dirname(file), reference.slice(5));
		if (!isConfinedExistingPath(asset) || statSync(asset).size === 0)
			throw new Error(`Invalid packaged icon ${reference} for ${registration}`);
		const extension = extname(asset).toLowerCase();
		if (!['.svg', '.png'].includes(extension))
			throw new Error(`Unsupported packaged icon format ${reference} for ${registration}`);
		if (extension === '.svg') {
			const svg = readFileSync(asset, 'utf8');
			const viewBox = svg.match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1];
			const dimensions = viewBox
				?.trim()
				.split(/[\s,]+/)
				.map(Number);
			if (
				!/<svg\b/i.test(svg) ||
				dimensions?.length !== 4 ||
				dimensions.some((value) => !Number.isFinite(value)) ||
				dimensions[2] <= 0 ||
				dimensions[3] <= 0
			)
				throw new Error(`SVG icon lacks a usable viewBox: ${reference}`);
		}
	}
}

console.log(
	`Compiled registration smoke passed for ${pkg.name}: ${nodes.length} node(s), ${credentials.length} credential(s)`,
);
