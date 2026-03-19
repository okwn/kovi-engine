export type PageType = 'listing' | 'detail' | 'unknown';
export type FetchMode = 'static' | 'js';
export type AuthMode =
  | 'none'
  | 'manual-cookie-import'
  | 'playwright-form-login'
  | 'header-token-injection';

export interface SelectorRule {
  key: string;
  selector: string;
  attribute?: string;
  required: boolean;
  multiple?: boolean;
}

export interface PaginationRule {
  mode: 'next-link' | 'query-param' | 'none';
  nextSelector?: string;
  paramName?: string;
  maxPages?: number;
}

export interface NoAuthStrategy {
  type: 'none';
}

export interface ManualCookieImportAuthStrategy {
  type: 'manual-cookie-import';
  renewalSeconds: number;
}

export interface PlaywrightFormLoginAuthStrategy {
  type: 'playwright-form-login';
  loginUrl: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
  successSelector: string;
  usernameSecretRef: string;
  passwordSecretRef: string;
  renewalSeconds: number;
}

export interface HeaderTokenInjectionAuthStrategy {
  type: 'header-token-injection';
  headerName: string;
  tokenSecretRef: string;
  prefix?: string;
  renewalSeconds: number;
}

export type AuthStrategy =
  | NoAuthStrategy
  | ManualCookieImportAuthStrategy
  | PlaywrightFormLoginAuthStrategy
  | HeaderTokenInjectionAuthStrategy;

export interface ChangeDetectionPolicy {
  ignoredFields: string[];
  logicalDeleteAfterMisses: number;
}

export interface ExportPolicy {
  subject: string;
  includeRawMetadata: boolean;
}

export interface SourceDefinition {
  id: string;
  name: string;
  adapterType: string;
  baseUrl: string;
  crawlEntrypoints: string[];
  allowedDomains: string[];
  internalLinkPatterns: string[];
  extractionSelectors: Record<'listing' | 'detail', SelectorRule[]>;
  pagination: PaginationRule;
  authentication: AuthStrategy;
  scheduleInterval: string;
  changeDetection: ChangeDetectionPolicy;
  exportPolicy: ExportPolicy;
  maxDepth: number;
  fetchMode: FetchMode;
  aiFallbackEnabled: boolean;
}

export interface ExtractionContext {
  source: SourceDefinition;
  url: string;
  depth: number;
  html: string;
}

export interface RawPageMetadata {
  sourceId: string;
  runId: string;
  url: string;
  canonicalUrl: string;
  depth: number;
  contentHash: string;
  pageType: PageType;
  fetchedAt: string;
  statusCode: number;
}

export interface NormalizedEntity {
  sourceId: string;
  recordKey: string;
  pageUrl: string;
  canonicalData: Record<string, unknown>;
}

export interface SourceAdapter {
  readonly type: string;
  validateDefinition(source: SourceDefinition): void;
  classifyPage(context: ExtractionContext): PageType;
  shouldFollowLink(currentUrl: string, nextUrl: string, depth: number, source: SourceDefinition): boolean;
  extract(context: ExtractionContext, pageType: Exclude<PageType, 'unknown'>): NormalizedEntity[];
  normalize(entity: NormalizedEntity, source: SourceDefinition): NormalizedEntity;
}

export interface ExtractorAiFallback {
  extractFromHtml(html: string, source: SourceDefinition, pageType: Exclude<PageType, 'unknown'>): Promise<NormalizedEntity[]>;
}
