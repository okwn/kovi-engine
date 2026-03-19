#!/usr/bin/env node
import { mkdir, cp, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const helpText = `
Kovi Adapter Scaffolder

Usage: node scripts/scaffold-adapter.mjs <template-name> <adapter-id> [options]

Templates:
  static-html      - Static HTML list/detail site
  js-rendered      - JavaScript-rendered (browser) site
  authenticated-portal - Authenticated dashboard/portal
  blog-feed        - Blog or news feed
  product-catalog  - E-commerce product catalog
  document-repo    - Document repository/file listing
  table-heavy      - Table-heavy data pages
  api-assisted     - API-assisted extraction

Options:
  --output, -o    Output directory (default: adapters/packages/<adapter-id>)
  --help, -h      Show this help message

Examples:
  node scripts/scaffold-adapter.mjs static-html my-catalog-adapter
  node scripts/scaffold-adapter.mjs js-rendered my-spa-adapter -o ./custom/path
`;

const templateRoot = path.resolve(process.cwd(), 'adapters', 'templates');

async function listTemplates() {
  try {
    const entries = await readdir(templateRoot, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch {
    return [];
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(helpText);
    process.exit(0);
  }

  const templateName = args[0];
  const adapterId = args[1];
  
  if (!templateName || !adapterId) {
    console.error('Error: template name and adapter ID required\n');
    console.log(helpText);
    process.exit(1);
  }

  const templates = await listTemplates();
  if (!templates.includes(templateName)) {
    console.error(`Error: unknown template "${templateName}"`);
    console.log(`Available templates: ${templates.join(', ')}`);
    process.exit(1);
  }

  const outDir = path.resolve(process.cwd(), 'adapters', 'packages', adapterId);
  
  console.log(`Scaffolding adapter "${adapterId}" from template "${templateName}"...`);
  
  await mkdir(outDir, { recursive: true });
  await cp(path.join(templateRoot, templateName), outDir, { recursive: true });

  const manifestPath = path.join(outDir, 'manifest.json');
  const manifest = {
    adapterId,
    name: adapterId,
    version: '0.1.0',
    status: 'beta',
    description: `Generated from template ${templateName}`,
    supportedAuthModes: ['none'],
    supportedFetchMode: ['static'],
    entityTypes: ['custom_entity'],
    requiredConfigurationFields: ['baseUrl', 'crawlEntrypoints', 'allowedDomains', 'extractionSelectors'],
    optionalConfigurationFields: ['pagination', 'internalLinkPatterns', 'changeDetection', 'exportPolicy'],
    policyDefaults: {
      allowedDomainsRequired: true,
      maxDepth: 2,
      maxPagesPerRun: 200,
      authRequired: false
    },
    retentionDefaults: {
      days: 30
    },
    sampleOutputs: [{ id: 'sample-id', title: 'sample' }],
    compatibility: {
      koviVersionRange: '>=0.1.0',
      authModes: ['none'],
      fetchModes: ['static']
    },
    changelog: [{ version: '0.1.0', date: new Date().toISOString().slice(0, 10), notes: 'Generated scaffold' }],
    runtime: {
      modulePath: './runtime.js',
      exportName: 'createAdapter'
    }
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

  const runtimePath = path.join(outDir, 'runtime.ts');
  const runtime = `import { ${templateName.replace(/-./g, c => c[1].toUpperCase())}Adapter } from './adapter.skeleton.js';

export const createAdapter = () => new ${templateName.replace(/-./g, c => c[1].toUpperCase())}Adapter();
`;
  await writeFile(runtimePath, runtime, 'utf-8');

  const skeletonPath = path.join(outDir, 'adapter.skeleton.ts');
  try {
    const skeleton = await readFile(skeletonPath, 'utf-8');
    const className = adapterId.replace(/[^a-zA-Z0-9]/g, '') + 'Adapter';
    await writeFile(skeletonPath, skeleton.replace('TemplateAdapter', className), 'utf-8');
  } catch {}

  console.log(`✓ Adapter scaffolded at ${outDir}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Edit manifest.json with your adapter metadata`);
  console.log(`  2. Customize adapter.skeleton.ts with your extraction logic`);
  console.log(`  3. Run: node scripts/adapter-preview.mjs ${adapterId}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});