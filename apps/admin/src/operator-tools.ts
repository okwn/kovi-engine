import type { SelectorRule, SourceDefinition } from '@kovi/source-sdk';

export interface WizardFieldInput {
  key: string;
  selector: string;
  attribute?: string;
  required?: boolean;
  multiple?: boolean;
  pageType?: 'listing' | 'detail';
}

export interface OnboardingDraftJson {
  basic?: {
    sourceName?: string;
    tenantId?: string;
    baseUrl?: string;
    allowedDomains?: string[];
    scheduleInterval?: string;
  };
  crawl?: {
    entrypoints?: string[];
    internalLinkPatterns?: string[];
    maxDepth?: number;
    maxPagesPerRun?: number;
    pageTypes?: string[];
  };
  fetch?: {
    mode?: 'http-only' | 'browser-required' | 'hybrid';
  };
  authentication?: {
    type?: 'none' | 'cookie-import' | 'form-login' | 'token-header';
    renewalSeconds?: number;
    loginUrl?: string;
    usernameSelector?: string;
    passwordSelector?: string;
    submitSelector?: string;
    successSelector?: string;
    usernameSecretRef?: string;
    passwordSecretRef?: string;
    headerName?: string;
    tokenSecretRef?: string;
    headerPrefix?: string;
  };
  extraction?: {
    entityType?: string;
    fields?: WizardFieldInput[];
    requiredFields?: string[];
    canonicalUrlRule?: string;
    entityIdentityRule?: string;
  };
  output?: {
    eventTypes?: string[];
    webhookRouting?: string;
    retentionDays?: number;
    exportRestrictions?: Record<string, unknown>;
  };
  validation?: {
    dryRunUrl?: string;
  };
}

export interface DraftValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const toSelectorRules = (draft: OnboardingDraftJson, pageType: 'listing' | 'detail'): SelectorRule[] => {
  const fields = draft.extraction?.fields ?? [];
  const requiredFields = new Set((draft.extraction?.requiredFields ?? []).map((value) => value.trim()).filter(Boolean));

  return fields
    .filter((field) => (field.pageType ?? 'detail') === pageType)
    .filter((field) => field.key.trim().length > 0 && field.selector.trim().length > 0)
    .map((field) => ({
      key: field.key.trim(),
      selector: field.selector.trim(),
      ...(field.attribute ? { attribute: field.attribute.trim() } : {}),
      required: field.required ?? requiredFields.has(field.key.trim()),
      ...(field.multiple ? { multiple: true } : {})
    }));
};

const normalizeInterval = (value: string | undefined): string => {
  const raw = (value ?? 'PT15M').trim();
  if (!raw) {
    return 'PT15M';
  }
  if (/^PT\d+[MHS]$/i.test(raw)) {
    return raw.toUpperCase();
  }
  const mins = Number(raw);
  if (Number.isFinite(mins) && mins > 0) {
    return `PT${Math.round(mins)}M`;
  }
  return 'PT15M';
};

export const validateOnboardingDraft = (draft: OnboardingDraftJson, stepIndex?: number): DraftValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  const checkStep = (minStep: number): boolean => stepIndex === undefined || stepIndex >= minStep;

  if (checkStep(0)) {
    if (!draft.basic?.sourceName?.trim()) {
      errors.push('Source name is required.');
    }
    if (!draft.basic?.baseUrl?.trim()) {
      errors.push('Base URL is required.');
    }
    if ((draft.basic?.allowedDomains ?? []).length === 0) {
      warnings.push('Allowed domains are empty; policy checks may fail.');
    }
  }

  if (checkStep(1)) {
    if ((draft.crawl?.entrypoints ?? []).length === 0) {
      errors.push('At least one crawl entrypoint is required.');
    }
    if (Number(draft.crawl?.maxDepth ?? 0) <= 0) {
      errors.push('Max depth must be greater than 0.');
    }
    if (Number(draft.crawl?.maxPagesPerRun ?? 0) <= 0) {
      errors.push('Max pages per run must be greater than 0.');
    }
  }

  if (checkStep(3)) {
    const authType = draft.authentication?.type ?? 'none';
    if (authType === 'form-login') {
      if (!draft.authentication?.loginUrl?.trim()) {
        errors.push('Login URL is required for form login auth.');
      }
      if (!draft.authentication?.usernameSelector?.trim() || !draft.authentication?.passwordSelector?.trim()) {
        errors.push('Username/password selectors are required for form login auth.');
      }
      if (!draft.authentication?.usernameSecretRef?.trim() || !draft.authentication?.passwordSecretRef?.trim()) {
        warnings.push('Secret refs for credentials should be configured before production.');
      }
    }
    if (authType === 'token-header' && !draft.authentication?.tokenSecretRef?.trim()) {
      warnings.push('Token secret ref is missing for header token auth.');
    }
  }

  if (checkStep(4)) {
    const fields = draft.extraction?.fields ?? [];
    if (fields.length === 0) {
      errors.push('At least one extraction field is required.');
    }
    if (!draft.extraction?.entityIdentityRule?.trim()) {
      warnings.push('Entity identity rule is missing; record keys may be unstable.');
    }
  }

  if (checkStep(5) && Number(draft.output?.retentionDays ?? 0) <= 0) {
    warnings.push('Retention days not set; default policy will be used.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

export const buildSourceDefinitionConfig = (draft: OnboardingDraftJson, sourceId: string): SourceDefinition => {
  const auth = draft.authentication ?? { type: 'none' };
  const authStrategy: SourceDefinition['authentication'] =
    auth.type === 'cookie-import'
      ? {
          type: 'manual-cookie-import',
          renewalSeconds: Number(auth.renewalSeconds ?? 3600)
        }
      : auth.type === 'form-login'
        ? {
            type: 'playwright-form-login',
            loginUrl: String(auth.loginUrl ?? ''),
            usernameSelector: String(auth.usernameSelector ?? ''),
            passwordSelector: String(auth.passwordSelector ?? ''),
            submitSelector: String(auth.submitSelector ?? 'button[type="submit"]'),
            successSelector: String(auth.successSelector ?? '[data-dashboard-root]'),
            usernameSecretRef: String(auth.usernameSecretRef ?? ''),
            passwordSecretRef: String(auth.passwordSecretRef ?? ''),
            renewalSeconds: Number(auth.renewalSeconds ?? 3600)
          }
        : auth.type === 'token-header'
          ? {
              type: 'header-token-injection',
              headerName: String(auth.headerName ?? 'Authorization'),
              tokenSecretRef: String(auth.tokenSecretRef ?? ''),
              ...(auth.headerPrefix ? { prefix: String(auth.headerPrefix) } : {}),
              renewalSeconds: Number(auth.renewalSeconds ?? 3600)
            }
          : { type: 'none' };

  const listingSelectors = toSelectorRules(draft, 'listing');
  const detailSelectors = toSelectorRules(draft, 'detail');

  const fetchMode: SourceDefinition['fetchMode'] =
    draft.fetch?.mode === 'browser-required' || draft.fetch?.mode === 'hybrid' ? 'js' : 'static';

  const adapterType =
    authStrategy.type === 'playwright-form-login'
      ? 'auth-dashboard'
      : fetchMode === 'js'
        ? 'js-listing-detail'
        : 'static-catalog';

  return {
    id: sourceId,
    name: draft.basic?.sourceName?.trim() || 'Untitled Source',
    adapterType,
    baseUrl: String(draft.basic?.baseUrl ?? '').trim(),
    crawlEntrypoints: (draft.crawl?.entrypoints ?? []).map((value) => value.trim()).filter(Boolean),
    allowedDomains: (draft.basic?.allowedDomains ?? []).map((value) => value.trim()).filter(Boolean),
    internalLinkPatterns: (draft.crawl?.internalLinkPatterns ?? []).map((value) => value.trim()).filter(Boolean),
    extractionSelectors: {
      listing: listingSelectors,
      detail: detailSelectors
    },
    pagination: {
      mode: 'next-link',
      nextSelector: 'a[rel="next"], .next-page, button.next',
      maxPages: Number(draft.crawl?.maxPagesPerRun ?? 25)
    },
    authentication: authStrategy,
    scheduleInterval: normalizeInterval(draft.basic?.scheduleInterval),
    changeDetection: {
      ignoredFields: [],
      logicalDeleteAfterMisses: 3
    },
    exportPolicy: {
      subject: String(draft.output?.webhookRouting ?? `kovi.source.${sourceId}.changed`),
      includeRawMetadata: false
    },
    maxDepth: Number(draft.crawl?.maxDepth ?? 2),
    fetchMode,
    aiFallbackEnabled: false
  };
}
