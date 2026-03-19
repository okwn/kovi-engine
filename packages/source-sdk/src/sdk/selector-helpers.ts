export type SelectorAttribute = 'text' | 'href' | 'src' | 'alt' | 'title' | 'data' | 'innerHTML';

export interface SelectorDefinition {
  key: string;
  selector: string;
  attribute?: SelectorAttribute;
  required?: boolean;
  multiple?: boolean;
  transform?: (value: string) => string;
}

export interface SelectorTestContext {
  html: string;
  url: string;
  selectors: SelectorDefinition[];
}

export const testSelectors = (context: SelectorTestContext): {
  success: boolean;
  results: Record<string, unknown>;
  errors: string[];
} => {
  const cheerio = require('cheerio');
  const $ = cheerio.load(context.html);
  const results: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const def of context.selectors) {
    try {
      const nodes = $(def.selector);
      if (nodes.length === 0) {
        if (def.required) {
          errors.push(`required selector ${def.key}: ${def.selector} found nothing`);
        }
        results[def.key] = null;
        continue;
      }

      if (def.multiple) {
        const items: string[] = [];
        nodes.each((_i: number, el: unknown) => {
          const node = $(el);
          let value: string | null = null;
          switch (def.attribute) {
            case 'text':
              value = node.text().trim();
              break;
            case 'href':
              value = node.attr('href') ?? null;
              break;
            case 'src':
              value = node.attr('src') ?? null;
              break;
            case 'alt':
              value = node.attr('alt') ?? null;
              break;
            case 'title':
              value = node.attr('title') ?? null;
              break;
            case 'innerHTML':
              value = node.html();
              break;
            default:
              value = node.text().trim();
          }
          if (value) items.push(value);
        });
        results[def.key] = items;
      } else {
        const node = nodes.first();
        let value: string | null = null;
        switch (def.attribute) {
          case 'text':
            value = node.text().trim();
            break;
          case 'href':
            value = node.attr('href') ?? null;
            break;
          case 'src':
            value = node.attr('src') ?? null;
            break;
          case 'alt':
            value = node.attr('alt') ?? null;
            break;
          case 'title':
            value = node.attr('title') ?? null;
            break;
          case 'innerHTML':
            value = node.html();
            break;
          default:
            value = node.text().trim();
        }

        if (def.transform && value) {
          value = def.transform(value);
        }

        if (def.required && !value) {
          errors.push(`required selector ${def.key}: ${def.selector} returned empty`);
        }
        results[def.key] = value ?? null;
      }
    } catch (err) {
      errors.push(`selector ${def.key}: ${String(err)}`);
    }
  }

  return {
    success: errors.length === 0,
    results,
    errors
  };
};

export const validateSelector = (
  html: string,
  selector: string
): { exists: boolean; count: number } => {
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  const nodes = $(selector);
  return { exists: nodes.length > 0, count: nodes.length };
};

export const buildSelectorMap = (
  selectors: Record<string, string>,
  attribute: SelectorAttribute = 'text'
): SelectorDefinition[] => {
  return Object.entries(selectors).map(([key, selector]) => ({
    key,
    selector,
    attribute,
    required: true
  }));
};