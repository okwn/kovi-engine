import * as cheerio from 'cheerio';
import {
  type ExtractionContext,
  type NormalizedEntity,
  type PageType,
  type SourceAdapter,
  type SourceDefinition
} from '../contracts.js';
import { shouldFollowInternalLink } from '../crawl-policy.js';

const extractByRules = (html: string, selectors: SourceDefinition['extractionSelectors']['listing']): Record<string, unknown> => {
  const $ = cheerio.load(html);
  const output: Record<string, unknown> = {};
  for (const selector of selectors) {
    const node = $(selector.selector).first();
    const value = selector.attribute ? node.attr(selector.attribute) : node.text().trim();
    if (selector.required && !value) {
      throw new Error(`selector miss for field ${selector.key}`);
    }
    output[selector.key] = value ?? null;
  }
  return output;
};

export class StaticCatalogAdapter implements SourceAdapter {
  public readonly type = 'static-catalog';

  public validateDefinition(source: SourceDefinition): void {
    if (source.fetchMode !== 'static') {
      throw new Error('static catalog adapter requires static fetch mode');
    }
  }

  public classifyPage(context: ExtractionContext): PageType {
    const $ = cheerio.load(context.html);
    if ($('[data-item-card]').length > 0 || $('.product-card').length > 0) {
      return 'listing';
    }
    if ($('[data-item-detail]').length > 0 || $('.product-detail').length > 0) {
      return 'detail';
    }
    return 'unknown';
  }

  public shouldFollowLink(currentUrl: string, nextUrl: string, depth: number, source: SourceDefinition): boolean {
    void currentUrl;
    return shouldFollowInternalLink(source, depth, nextUrl);
  }

  public extract(context: ExtractionContext, pageType: Exclude<PageType, 'unknown'>): NormalizedEntity[] {
    const selectors = context.source.extractionSelectors[pageType];
    const data = extractByRules(context.html, selectors);
    const key = String(data.id ?? data.sku ?? context.url);
    return [
      {
        sourceId: context.source.id,
        recordKey: key,
        pageUrl: context.url,
        canonicalData: data
      }
    ];
  }

  public normalize(entity: NormalizedEntity): NormalizedEntity {
    return {
      ...entity,
      canonicalData: Object.fromEntries(
        Object.entries(entity.canonicalData).map(([key, value]) => [
          key,
          typeof value === 'string' ? value.trim() : value
        ])
      )
    };
  }
}
