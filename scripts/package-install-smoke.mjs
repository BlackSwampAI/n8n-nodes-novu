import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporary = mkdtempSync(join(tmpdir(), 'n8n-novu-install-'));
try {
	const [{ filename }] = JSON.parse(
		execFileSync(
			'npm',
			[
				'pack',
				root,
				'--json',
				'--pack-destination',
				temporary,
				'--cache',
				join(temporary, 'cache'),
			],
			{ encoding: 'utf8' },
		),
	);
	writeFileSync(
		join(temporary, 'package.json'),
		`${JSON.stringify({ name: 'n8n-novu-packed-smoke', private: true, version: '0.0.0' }, null, 2)}\n`,
	);
	execFileSync(
		'npm',
		[
			'install',
			'--ignore-scripts',
			'--no-package-lock',
			'--omit=peer',
			'--no-audit',
			'--no-fund',
			join(temporary, filename),
		],
		{ cwd: temporary, stdio: 'ignore' },
	);
	const installedRoot = join(temporary, 'node_modules/@blackswampai/n8n-nodes-novu');
	const installed = JSON.parse(readFileSync(join(installedRoot, 'package.json'), 'utf8'));
	if (installed.name !== '@blackswampai/n8n-nodes-novu')
		throw new Error('Installed package identity mismatch');
	execFileSync(process.execPath, [resolve(root, 'scripts/node-load-smoke.mjs'), installedRoot], {
		cwd: temporary,
		env: { ...process.env, NODE_PATH: resolve(root, 'node_modules') },
		stdio: 'inherit',
	});
	console.log('Isolated packed-package install and load smoke passed');
} finally {
	rmSync(temporary, { recursive: true, force: true });
}
