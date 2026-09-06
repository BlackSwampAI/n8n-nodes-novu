import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url);
const temporary = mkdtempSync(join(tmpdir(), 'n8n-novu-install-'));
let tarball;
try {
	const output = execFileSync('npm', ['pack', '--json', '--cache', '.npm-cache'], {
		cwd: root,
		encoding: 'utf8',
	});
	const [{ filename }] = JSON.parse(output);
	tarball = new URL(filename, root).pathname;
	execFileSync('npm', ['init', '-y'], { cwd: temporary, stdio: 'ignore' });
	execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], {
		cwd: temporary,
		stdio: 'ignore',
	});
	const installed = JSON.parse(
		readFileSync(join(temporary, 'node_modules/@blackswampai/n8n-nodes-novu/package.json'), 'utf8'),
	);
	if (installed.name !== '@blackswampai/n8n-nodes-novu')
		throw new Error('Installed package identity mismatch');
	console.log('Isolated packed-package install smoke passed');
} finally {
	rmSync(temporary, { recursive: true, force: true });
	if (tarball) unlinkSync(tarball);
}
