import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'adapters', 'templates');

const templates = [
  'static-html-list-detail',
  'js-rendered-list-detail',
  'authenticated-portal',
  'blog-news-feed',
  'product-catalog',
  'document-repository',
  'table-heavy-page',
  'api-assisted-source'
];

const files = {
  'config.example.json': (name) => `{
  "name": "${name} template",
  "baseUrl": "https://example.local",
  "crawlEntrypoints": ["https://example.local/start"],
  "allowedDomains": ["example.local"],
  "internalLinkPatterns": ["https://example.local/*"],
  "maxDepth": 2,
  "fetchMode": "static"
}
`,
  'adapter.skeleton.ts': (name) => `import type { SourceAdapter, SourceDefinition, ExtractionContext, NormalizedEntity, PageType } from '@kovi/source-sdk';

export class TemplateAdapter implements SourceAdapter {
  public readonly type = '${name}';

  public validateDefinition(source: SourceDefinition): void {
    void source;
  }

  public classifyPage(context: ExtractionContext): PageType {
    void context;
    return 'detail';
  }

  public shouldFollowLink(currentUrl: string, nextUrl: string, depth: number, source: SourceDefinition): boolean {
    void currentUrl;
    void nextUrl;
    void depth;
    void source;
    return true;
  }

  public extract(context: ExtractionContext): NormalizedEntity[] {
    return [{
      sourceId: context.source.id,
      recordKey: context.url,
      pageUrl: context.url,
      canonicalData: { title: 'replace-me' }
    }];
  }

  public normalize(entity: NormalizedEntity): NormalizedEntity {
    return entity;
  }
}
`,
  'extraction.schema.json': () => `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["recordKey", "title"],
  "properties": {
    "recordKey": { "type": "string" },
    "title": { "type": "string" },
    "updatedAt": { "type": "string" }
  }
}
`,
  'identity.strategy.md': () => `# Identity Strategy

Use canonical URL + stable primary field for record key.
Fallback: source-specific immutable ID selector.
`,
  'policy.defaults.json': () => `{
  "allowedDomainsRequired": true,
  "maxDepth": 2,
  "maxPagesPerRun": 200,
  "authRequired": false,
  "retentionDays": 30
}
`,
  'fixtures.sample.html': () => `<html><body><main><article data-item-id="sample-1"><h1>Sample Item</h1></article></main></body></html>
`
};

await mkdir(root, { recursive: true });

for (const template of templates) {
  const dir = path.join(root, template);
  await mkdir(dir, { recursive: true });
  for (const [fileName, contentFactory] of Object.entries(files)) {
    await writeFile(path.join(dir, fileName), contentFactory(template), 'utf-8');
  }
}

process.stdout.write(`Generated ${templates.length} adapter templates at ${root}\n`);
