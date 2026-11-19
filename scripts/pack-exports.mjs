/**
 * Points `package.json` at `dist/` for the length of an `npm pack` / `npm publish`, then puts it back.
 *
 * In the repo `exports` names `src/*.ts`, so the monorepo runs rpg-md unbuilt everywhere — Bun, `tsc`,
 * and mochi's `target: 'browser'` client build, which honours no custom export condition. The tarball
 * holds only `dist/`, so the packed `package.json` must name it. `prepack` runs this, `postpack` runs
 * it with `--restore`. A pack that dies between the two leaves `package.json.orig` behind: move it back.
 *
 * Plain Node, no dependencies: it runs before anything is built.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const pkgPath = join(root, 'package.json');
const origPath = join(root, 'package.json.orig');

if (process.argv.includes('--restore')) {
	if (existsSync(origPath)) renameSync(origPath, pkgPath);
	process.exit(0);
}

if (existsSync(origPath)) {
	console.error('package.json.orig exists — a previous pack did not restore. Move it back to package.json first.');
	process.exit(1);
}

const source = readFileSync(pkgPath, 'utf-8');
const pkg = JSON.parse(source);
writeFileSync(origPath, source);

pkg.main = './dist/index.js';
pkg.types = './dist/index.d.ts';
pkg.exports = {
	'.': {
		types: './dist/index.d.ts',
		default: './dist/index.js'
	}
};
// Repo-only: the workspace's scripts and dev tooling mean nothing to an installer.
delete pkg.scripts;
delete pkg.devDependencies;

writeFileSync(pkgPath, `${JSON.stringify(pkg, null, '\t')}\n`);
