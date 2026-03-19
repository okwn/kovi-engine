import type { SourceAdapter, SourceDefinition, ExtractionContext, NormalizedEntity, PageType } from '@kovi/source-sdk';

export class TemplateAdapter implements SourceAdapter {
  public readonly type = 'product-catalog';

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
