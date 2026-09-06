import {
	analyzePackage,
	SOURCE_FILE_PATTERNS,
} from '@n8n/scan-community-package/scanner/scanner.mjs';

for (const [label, patterns] of [
	['source', SOURCE_FILE_PATTERNS],
	['built package', ['dist/**/*.js', 'package.json']],
]) {
	const result = await analyzePackage(process.cwd(), patterns);
	if (!result.passed) {
		console.error(`${label} scanner preflight failed: ${result.message}`);
		if (result.details) console.error(result.details);
		process.exit(1);
	}
}
console.log('Official scanner source and built-package preflight passed');
