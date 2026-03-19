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
    if (source.fetchMode !== 'static') {
      throw new Error('This template requires static fetch mode');
    }
  }

  public classifyPage(context: ExtractionContext): PageType {
    const cheerio = require('cheerio');
    const $ = cheerio.load(context.html);
    
    // Customize page type detection based on your selectors
    if ($('.listing, .list-view, [data-listing]').length > 0) {
      return 'listing';
    }
    if ($('.detail, .product-detail, [data-detail]').length > 0) {
      return 'detail';
    }
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
    
    for (const selector of selectors) {
      if (selector.multiple) {
        const items: Record<string, string>[] = [];
        $(selector.selector).each((_i: number, el: unknown) => {
          const node = $(el);
          const value = selector.attribute === 'href' ? node.attr('href') : node.text().trim();
          if (value) items.push({ [selector.key]: value });
        });
        output[selector.key] = items;
      } else {
        const node = $(selector.selector).first();
        const value = selector.attribute 
          ? node.attr(selector.attribute)
          : node.text().trim();
        if (selector.required && !value) {
          throw new Error(`Required selector failed: ${selector.key}`);
        }
        output[selector.key] = value ?? null;
      }
    }

    const keyField = output.id ?? output.sku ?? output.slug ?? context.url;
    return [{
      sourceId: context.source.id,
      recordKey: String(keyField),
      pageUrl: context.url,
      canonicalData: output
    }];
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