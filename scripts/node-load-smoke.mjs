import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const loaded = [];
for (const registration of [...pkg.n8n.nodes, ...pkg.n8n.credentials]) {
	const file = resolve(root, registration);
	if (!existsSync(file)) throw new Error(`Missing compiled registration: ${registration}`);
	const module = await import(pathToFileURL(file).href);
	const Constructor = Object.values(module).find((value) => typeof value === 'function');
	if (!Constructor) throw new Error(`No loadable constructor in ${registration}`);
	const instance = new Constructor();
	const icon = instance.description?.icon ?? instance.icon;
	const refs = typeof icon === 'string' ? [icon] : [icon?.light, icon?.dark];
	if (
		!refs.length ||
		refs.some((reference) => typeof reference !== 'string' || !reference.startsWith('file:'))
	)
		throw new Error(`${registration} must declare packaged file icons`);
	for (const reference of refs) {
		const asset = resolve(dirname(file), reference.slice(5));
		if (!asset.startsWith(`${root}/`) || !existsSync(asset) || statSync(asset).size === 0)
			throw new Error(`Invalid packaged icon ${reference} for ${registration}`);
	}
	loaded.push(instance.description?.name ?? instance.name);
}
console.log(`Compiled registration smoke passed: ${loaded.join(', ')}`);
