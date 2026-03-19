#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const helpText = `
Kovi Adapter Preview Tool

Usage: node scripts/adapter-preview.mjs <adapter-package-folder> [options]

Options:
  --help, -h           Show this help message

This tool runs your adapter against fixture HTML to preview extraction results.
Create a fixtures/sample.html file in your adapter package to test.
`;

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(helpText);
    process.exit(0);
  }

  const adapterFolder = args[0];
  if (!adapterFolder) {
    console.error('Error: adapter package folder required\n');
    console.log(helpText);
    process.exit(1);
  }

  const packageDir = path.resolve(process.cwd(), 'adapters', 'packages', adapterFolder);
  
  console.log(`Previewing adapter: ${adapterFolder}`);
  
  let runtimeModule;
  try {
    runtimeModule = await import(path.join(packageDir, 'runtime.ts'));
  } catch (err) {
    console.error(`Error: Could not load adapter runtime from ${packageDir}`);
    console.error(err);
    process.exit(1);
  }

  const createAdapter = runtimeModule.createAdapter ?? runtimeModule.default;
  if (typeof createAdapter !== 'function') {
    console.error('Error: runtime module must export createAdapter()');
    process.exit(1);
  }

  const adapter = createAdapter();

  const fixturePath = path.join(packageDir, 'fixtures', 'sample.html');
  let fixtureHtml;
  try {
    fixtureHtml = await readFile(fixturePath, 'utf-8');
  } catch {
    console.error(`Error: Fixture not found at ${fixturePath}`);
    console.error('Create fixtures/sample.html to test your adapter');
    process.exit(1);
  }

  const cheerio = require('cheerio');
  const $ = cheerio.load(fixtureHtml);
  
  const source = {
    id: adapterFolder,
    name: adapterFolder,
    adapterType: adapterFolder,
    baseUrl: 'https://example.local',
    crawlEntrypoints: ['/'],
    allowedDomains: ['example.local'],
    internalLinkPatterns: ['^https://example\\.local'],
    extractionSelectors: {
      listing: [],
      detail: []
    },
    pagination: { mode: 'none' },
    authentication: { type: 'none' },
    scheduleInterval: '0 * * * *',
    changeDetection: { ignoredFields: [], logicalDeleteAfterMisses: 3 },
    exportPolicy: { subject: 'test', includeRawMetadata: false },
    maxDepth: 2,
    fetchMode: 'static',
    aiFallbackEnabled: false
  };

  const url = 'https://example.local/test';
  const context = { source, url, depth: 0, html: fixtureHtml };

  console.log('\n--- Page Classification ---');
  const pageType = adapter.classifyPage(context);
  console.log(`Page type: ${pageType}`);

  if (pageType !== 'unknown') {
    console.log('\n--- Extraction ---');
    try {
      const entities = adapter.extract(context, pageType);
      console.log(`Extracted ${entities.length} entity(s):`);
      for (const entity of entities) {
        console.log(JSON.stringify(entity, null, 2));
      }
      
      console.log('\n--- Normalization ---');
      for (const entity of entities) {
        const normalized = adapter.normalize(entity, source);
        console.log(JSON.stringify(normalized, null, 2));
      }
    } catch (err) {
      console.error('Extraction error:', err);
    }
  } else {
    console.log('Warning: page type could not be determined');
  }

  console.log('\n✓ Preview complete');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});