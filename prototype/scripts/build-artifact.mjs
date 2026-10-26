// Builds a self-contained copy of the prototype for hosting as a claude.ai
// Artifact: one page with the CSS and JS inlined (hosted pages only load
// scripts from public CDNs) plus the terrain packs beside it.
//
// Usage: node scripts/build-artifact.mjs [out-dir]
// (run build-terrain-pack.mjs first; it writes the pack to <out-dir>/terrain)

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(root, process.argv[2] ?? 'dist/artifact');
const MAPLIBRE_CDN = 'https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/maplibre-gl.js';
// Dependency order: each module only imports from modules before it.
const MODULES = ['data', 'routing', 'search', 'query', 'locate', 'geometry', 'terrain-pack', 'app'];

const read = (p) => readFile(path.join(root, p), 'utf8');

// A tiny bundler for our own ES modules: each becomes a function scope whose
// exports are collected into __modules[name].
async function bundle() {
  const parts = ['const __modules = {};'];
  for (const name of MODULES) {
    let code = await read(`src/${name}.js`);
    const exported = [];
    code = code
      .replace(/^import \* as (\w+) from '\.\/([\w-]+)\.js';$/gm, (_, local, mod) => `const ${local} = __modules['${mod}'];`)
      .replace(/^import \{([^}]+)\} from '\.\/([\w-]+)\.js';$/gm, (_, names, mod) => `const {${names}} = __modules['${mod}'];`)
      .replace(/^export (const|let|function|async function) (\w+)/gm, (_, kind, id) => {
        exported.push(id);
        return `${kind} ${id}`;
      });
    if (/^\s*(import|export)\s/m.test(code)) throw new Error(`Unbundled import/export left in ${name}.js`);
    parts.push(`__modules['${name}'] = (() => {\n${code}\nreturn { ${exported.join(', ')} };\n})();`);
  }
  const js = parts.join('\n\n');
  if (js.includes('</script')) throw new Error('Script contains </script');
  return js;
}

const html = await read('index.html');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1]
  .replace(/\s*<script[^>]*><\/script>/g, '');
const css = (await read('vendor/maplibre-gl/maplibre-gl.css')) + '\n' + (await read('styles.css'));
const config = { terrainPack: 'terrain/', basemaps: false };

const page = `<title>PdS Mountain Guide</title>
<style>
${css}
</style>
${body.trim()}
<script src="${MAPLIBRE_CDN}"></script>
<script>window.PDS_CONFIG = ${JSON.stringify(config)};</script>
<script>
${await bundle()}
</script>
`;

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'index.html'), page);
console.log(`Wrote ${path.relative(root, path.join(outDir, 'index.html'))} (${(page.length / 1024).toFixed(0)} KB)`);
