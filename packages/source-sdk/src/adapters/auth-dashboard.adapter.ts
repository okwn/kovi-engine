import * as cheerio from 'cheerio';
import {
  type ExtractionContext,
  type NormalizedEntity,
  type PageType,
  type SourceAdapter,
  type SourceDefinition
} from '../contracts.js';
import { shouldFollowInternalLink } from '../crawl-policy.js';

export class AuthDashboardAdapter implements SourceAdapter {
  public readonly type = 'auth-dashboard';

  public validateDefinition(source: SourceDefinition): void {
    if (source.authentication.type !== 'playwright-form-login') {
      throw new Error('auth dashboard adapter requires playwright-form-login auth strategy');
    }
  }

  public classifyPage(context: ExtractionContext): PageType {
    const $ = cheerio.load(context.html);
    if ($('[data-dashboard-list]').length > 0) {
      return 'listing';
    }
    if ($('[data-dashboard-detail]').length > 0) {
      return 'detail';
    }
    return 'unknown';
  }

  public shouldFollowLink(currentUrl: string, nextUrl: string, depth: number, source: SourceDefinition): boolean {
    void currentUrl;
    return shouldFollowInternalLink(source, depth, nextUrl);
  }

  public extract(context: ExtractionContext, pageType: Exclude<PageType, 'unknown'>): NormalizedEntity[] {
    const $ = cheerio.load(context.html);
    const selectors = context.source.extractionSelectors[pageType];
    const data: Record<string, unknown> = {};

    for (const selector of selectors) {
      const node = $(selector.selector).first();
      const value = selector.attribute ? node.attr(selector.attribute) : node.text().trim();
      if (selector.required && !value) {
        throw new Error(`selector miss for field ${selector.key}`);
      }
      data[selector.key] = value ?? null;
    }

    return [
      {
        sourceId: context.source.id,
        recordKey: String(data.id ?? data.account_id ?? context.url),
        pageUrl: context.url,
        canonicalData: data
      }
    ];
  }

  public normalize(entity: NormalizedEntity): NormalizedEntity {
    return entity;
  }
}
