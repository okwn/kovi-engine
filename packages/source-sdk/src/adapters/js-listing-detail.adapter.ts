import * as cheerio from 'cheerio';
import {
  type ExtractionContext,
  type NormalizedEntity,
  type PageType,
  type SourceAdapter,
  type SourceDefinition
} from '../contracts.js';
import { shouldFollowInternalLink } from '../crawl-policy.js';

const extractValues = (html: string, selectors: SourceDefinition['extractionSelectors']['detail']): Record<string, unknown> => {
  const $ = cheerio.load(html);
  const output: Record<string, unknown> = {};
  for (const selector of selectors) {
    const nodes = $(selector.selector);
    if (selector.multiple) {
      output[selector.key] = nodes
        .toArray()
        .map((node) => {
          const wrapped = $(node);
          return selector.attribute ? wrapped.attr(selector.attribute) ?? null : wrapped.text().trim();
        })
        .filter((value) => value !== null && value !== '');
      continue;
    }

    const node = nodes.first();
    const value = selector.attribute ? node.attr(selector.attribute) : node.text().trim();
    if (selector.required && !value) {
      throw new Error(`selector miss for field ${selector.key}`);
    }
    output[selector.key] = value ?? null;
  }
  return output;
};

export class JsListingDetailAdapter implements SourceAdapter {
  public readonly type = 'js-listing-detail';

  public validateDefinition(source: SourceDefinition): void {
    if (source.fetchMode !== 'js') {
      throw new Error('js listing/detail adapter requires js fetch mode');
    }
  }

  public classifyPage(context: ExtractionContext): PageType {
    const $ = cheerio.load(context.html);
    if ($('[data-listing-root]').length > 0) {
      return 'listing';
    }
    if ($('[data-detail-root]').length > 0) {
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
    const data = extractValues(context.html, selectors);
    const key = String(data.id ?? data.slug ?? context.url);
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
    return entity;
  }
}
