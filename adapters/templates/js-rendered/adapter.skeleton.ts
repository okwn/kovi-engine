import {
  type ExtractionContext,
  type NormalizedEntity,
  type PageType,
  type SourceAdapter,
  type SourceDefinition
} from '@kovi/source-sdk';
import { shouldFollowInternalLink } from '@kovi/source-sdk';

export class TemplateAdapter implements SourceAdapter {
  public readonly type = 'template-adapter';

  public validateDefinition(source: SourceDefinition): void {
    if (source.fetchMode !== 'js') {
      throw new Error('This template requires JS (browser) fetch mode');
    }
    if (!source.authentication || source.authentication.type === 'none') {
      throw new Error('This template requires authentication configuration');
    }
  }

  public classifyPage(context: ExtractionContext): PageType {
    const cheerio = require('cheerio');
    const $ = cheerio.load(context.html);
    if ($('.dashboard-view, .authenticated-view').length > 0) return 'detail';
    return 'unknown';
  }

  public shouldFollowLink(currentUrl: string, nextUrl: string, depth: number, source: SourceDefinition): boolean {
    return shouldFollowInternalLink(source, depth, nextUrl);
  }

  public extract(context: ExtractionContext, pageType: Exclude<PageType, 'unknown'>): NormalizedEntity[] {
    const selectors = context.source.extractionSelectors[pageType];
    const cheerio = require('cheerio');
    const $ = cheerio.load(context.html);
    const output: Record<string, unknown> = {};

    for (const rule of selectors) {
      const node = $(rule.selector).first();
      const value = rule.attribute ? node.attr(rule.attribute) : node.text().trim();
      output[rule.key] = value ?? null;
    }

    return [{
      sourceId: context.source.id,
      recordKey: String(context.url),
      pageUrl: context.url,
      canonicalData: output
    }];
  }

  public normalize(entity: NormalizedEntity): NormalizedEntity {
    return entity;
  }
}