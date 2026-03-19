import type { SourceDefinition, SelectorRule } from '../contracts.js';

export const extractSingle = (
  html: string,
  selector: string,
  attribute?: string
): string | null => {
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  const node = $(selector).first();
  if (!node.length) return null;
  return attribute ? node.attr(attribute) ?? null : node.text().trim() ?? null;
};

export const extractMultiple = (
  html: string,
  selector: string,
  attribute?: string
): string[] => {
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  const nodes = $(selector);
  const results: string[] = [];
  nodes.each((_i: number, el: unknown) => {
    const node = $(el);
    const value = attribute ? node.attr(attribute) ?? '' : node.text().trim();
    if (value) results.push(value);
  });
  return results;
};

export const extractByRules = (
  html: string,
  rules: SelectorRule[],
  context: { source: SourceDefinition; url: string; depth: number }
): Record<string, unknown> => {
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  const output: Record<string, unknown> = {};

  for (const rule of rules) {
    const nodes = $(rule.selector);
    if (rule.multiple) {
      const items: Record<string, unknown>[] = [];
      nodes.each((_i: number, el: unknown) => {
        const node = $(el);
        const value = rule.attribute ? node.attr(rule.attribute) : node.text().trim();
        if (value) items.push({ [rule.key]: value });
      });
      output[rule.key] = items;
    } else {
      const node = nodes.first();
      const value = rule.attribute ? node.attr(rule.attribute) : node.text().trim();
      if (rule.required && !value) {
        throw new Error(`required selector failed for ${rule.key} at ${context.url}`);
      }
      output[rule.key] = value ?? null;
    }
  }

  return output;
};

export const extractTableRows = (html: string, rowSelector = 'tr'): Record<string, string>[] => {
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  const rows: Record<string, string>[] = [];

  $(rowSelector).each((_i: number, row: unknown) => {
    const cells: Record<string, string> = {};
    $(row).find('th, td').each((j: number, cell: unknown) => {
      const key = $(cell).attr('data-label') || `col${j}`;
      cells[key] = $(cell).text().trim();
    });
    if (Object.keys(cells).length > 0) {
      rows.push(cells);
    }
  });

  return rows;
};

export const extractPaginationNextLink = (html: string, selectors: string[]): string | null => {
  for (const selector of selectors) {
    const link = extractSingle(html, selector, 'href');
    if (link) return link;
  }
  return null;
};