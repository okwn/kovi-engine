import type { SourceDefinition } from '../contracts.js';

export interface PaginationContext {
  currentPage: number;
  currentUrl: string;
  maxPages: number;
}

export const buildNextPageUrl = (
  source: SourceDefinition,
  context: PaginationContext
): string | null => {
  if (context.currentPage >= context.maxPages) {
    return null;
  }

  const pagination = source.pagination;

  switch (pagination.mode) {
    case 'next-link': {
      return null;
    }
    case 'query-param': {
      const url = new URL(context.currentUrl);
      const param = pagination.paramName ?? 'page';
      url.searchParams.set(param, String(context.currentPage + 1));
      return url.toString();
    }
    case 'none':
    default:
      return null;
  }
};

export const detectNextPageUrl = (
  html: string,
  nextSelectors: string[],
  baseUrl: string
): string | null => {
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);

  for (const selector of nextSelectors) {
    const link = $(selector).first();
    if (link.length) {
      const href = link.attr('href');
      if (href) {
        try {
          return new URL(href, baseUrl).toString();
        } catch {
          return href;
        }
      }
    }
  }

  return null;
};

export interface PaginationResult {
  nextUrl: string | null;
  hasMore: boolean;
  pageNumber: number;
}

export const calculateNextPage = (
  currentUrl: string,
  page: number,
  maxPages: number,
  paramName = 'page'
): PaginationResult => {
  if (page >= maxPages) {
    return { nextUrl: null, hasMore: false, pageNumber: page };
  }

  try {
    const url = new URL(currentUrl);
    url.searchParams.set(paramName, String(page + 1));
    return { nextUrl: url.toString(), hasMore: page + 1 < maxPages, pageNumber: page + 1 };
  } catch {
    return { nextUrl: null, hasMore: false, pageNumber: page };
  }
};

export const extractPageNumber = (
  url: string,
  paramName = 'page'
): number => {
  try {
    const parsed = new URL(url);
    const value = parsed.searchParams.get(paramName);
    return value ? parseInt(value, 10) : 1;
  } catch {
    return 1;
  }
};