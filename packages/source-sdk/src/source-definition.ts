import type { SourceDefinition } from './contracts.js';

export interface SourceDefinitionHydrateInput {
  id: string;
  name: string;
  adapterType: string;
  configJson: Record<string, unknown>;
}

const asObject = (input: unknown): Record<string, unknown> =>
  input && typeof input === 'object' ? (input as Record<string, unknown>) : {};

export const hydrateSourceDefinition = (input: SourceDefinitionHydrateInput): SourceDefinition => {
  const config = input.configJson as Partial<SourceDefinition>;
  const auth = asObject(config.authentication);
  const authType = (auth.type as string | undefined) ?? 'none';

  const authentication: SourceDefinition['authentication'] =
    authType === 'manual-cookie-import'
      ? {
          type: 'manual-cookie-import',
          renewalSeconds: Number(auth.renewalSeconds ?? 3600)
        }
      : authType === 'playwright-form-login'
        ? {
            type: 'playwright-form-login',
            loginUrl: String(auth.loginUrl ?? ''),
            usernameSelector: String(auth.usernameSelector ?? ''),
            passwordSelector: String(auth.passwordSelector ?? ''),
            submitSelector: String(auth.submitSelector ?? ''),
            successSelector: String(auth.successSelector ?? ''),
            usernameSecretRef: String(auth.usernameSecretRef ?? ''),
            passwordSecretRef: String(auth.passwordSecretRef ?? ''),
            renewalSeconds: Number(auth.renewalSeconds ?? 3600)
          }
        : authType === 'header-token-injection'
          ? {
              type: 'header-token-injection',
              headerName: String(auth.headerName ?? 'Authorization'),
              tokenSecretRef: String(auth.tokenSecretRef ?? ''),
              ...(auth.prefix ? { prefix: String(auth.prefix) } : {}),
              renewalSeconds: Number(auth.renewalSeconds ?? 3600)
            }
          : { type: 'none' };

  return {
    id: input.id,
    name: input.name,
    adapterType: input.adapterType,
    baseUrl: String(config.baseUrl ?? ''),
    crawlEntrypoints: (config.crawlEntrypoints ?? []) as string[],
    allowedDomains: (config.allowedDomains ?? []) as string[],
    internalLinkPatterns: (config.internalLinkPatterns ?? []) as string[],
    extractionSelectors: (config.extractionSelectors ?? { listing: [], detail: [] }) as SourceDefinition['extractionSelectors'],
    pagination: (config.pagination ?? { mode: 'none' }) as SourceDefinition['pagination'],
    authentication,
    scheduleInterval: String(config.scheduleInterval ?? 'PT15M'),
    changeDetection: (config.changeDetection ?? {
      ignoredFields: [],
      logicalDeleteAfterMisses: 3
    }) as SourceDefinition['changeDetection'],
    exportPolicy: (config.exportPolicy ?? {
      subject: `kovi.source.${input.id}.changed`,
      includeRawMetadata: false
    }) as SourceDefinition['exportPolicy'],
    maxDepth: Number(config.maxDepth ?? 1),
    fetchMode: (config.fetchMode ?? 'static') as SourceDefinition['fetchMode'],
    aiFallbackEnabled: Boolean(config.aiFallbackEnabled ?? false)
  };
};
