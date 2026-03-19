import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { AuthDashboardAdapter } from './adapters/auth-dashboard.adapter.js';
import { JsListingDetailAdapter } from './adapters/js-listing-detail.adapter.js';
import { StaticCatalogAdapter } from './adapters/static-catalog.adapter.js';
import type { AuthMode, FetchMode, SourceAdapter } from './contracts.js';

export type AdapterLifecycleStatus = 'active' | 'beta' | 'deprecated' | 'internal_only';

export interface AdapterCompatibility {
  koviVersionRange: string;
  authModes: AuthMode[];
  fetchModes: FetchMode[];
}

export interface PackagedAdapterManifest {
  adapterId: string;
  name: string;
  version: string;
  status: AdapterLifecycleStatus;
  description: string;
  supportedAuthModes: AuthMode[];
  supportedFetchMode: FetchMode[];
  entityTypes: string[];
  requiredConfigurationFields: string[];
  optionalConfigurationFields: string[];
  policyDefaults: {
    allowedDomainsRequired: boolean;
    maxDepth: number;
    maxPagesPerRun: number;
    authRequired: boolean;
  };
  retentionDefaults: {
    days: number;
  };
  sampleOutputs: Array<Record<string, unknown>>;
  compatibility: AdapterCompatibility;
  changelog: Array<{
    version: string;
    date: string;
    notes: string;
  }>;
  runtime?: {
    modulePath: string;
    exportName?: string;
  } | undefined;
}

export interface RegisteredAdapterPackage {
  manifest: PackagedAdapterManifest;
  adapter: SourceAdapter;
}

const isStringArray = (input: unknown): input is string[] =>
  Array.isArray(input) && input.every((item) => typeof item === 'string');

const isAuthModeArray = (input: unknown): input is AuthMode[] =>
  Array.isArray(input) && input.every((item) => ['none', 'manual-cookie-import', 'playwright-form-login', 'header-token-injection'].includes(String(item)));

const isFetchModeArray = (input: unknown): input is FetchMode[] =>
  Array.isArray(input) && input.every((item) => item === 'static' || item === 'js');

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

export const validateAdapterManifest = (input: unknown): PackagedAdapterManifest => {
  const raw = asObject(input);
  const requiredStrings = ['adapterId', 'name', 'version', 'status', 'description'];
  for (const field of requiredStrings) {
    if (typeof raw[field] !== 'string' || String(raw[field]).trim().length === 0) {
      throw new Error(`adapter manifest missing required field ${field}`);
    }
  }

  if (!isAuthModeArray(raw.supportedAuthModes)) {
    throw new Error('adapter manifest field supportedAuthModes is invalid');
  }

  if (!isFetchModeArray(raw.supportedFetchMode)) {
    throw new Error('adapter manifest field supportedFetchMode is invalid');
  }

  if (!isStringArray(raw.entityTypes) || !isStringArray(raw.requiredConfigurationFields) || !isStringArray(raw.optionalConfigurationFields)) {
    throw new Error('adapter manifest string-array fields are invalid');
  }

  const policyDefaults = asObject(raw.policyDefaults);
  const retentionDefaults = asObject(raw.retentionDefaults);
  const compatibility = asObject(raw.compatibility);

  if (typeof policyDefaults.allowedDomainsRequired !== 'boolean') {
    throw new Error('adapter manifest policyDefaults.allowedDomainsRequired must be boolean');
  }

  if (typeof policyDefaults.maxDepth !== 'number' || typeof policyDefaults.maxPagesPerRun !== 'number') {
    throw new Error('adapter manifest policyDefaults depth/page defaults must be numeric');
  }

  if (typeof retentionDefaults.days !== 'number' || retentionDefaults.days <= 0) {
    throw new Error('adapter manifest retentionDefaults.days must be positive');
  }

  if (typeof compatibility.koviVersionRange !== 'string' || !isAuthModeArray(compatibility.authModes) || !isFetchModeArray(compatibility.fetchModes)) {
    throw new Error('adapter manifest compatibility is invalid');
  }

  const status = raw.status as AdapterLifecycleStatus;
  if (!['active', 'beta', 'deprecated', 'internal_only'].includes(status)) {
    throw new Error(`invalid adapter status ${raw.status}`);
  }

  const manifest: PackagedAdapterManifest = {
    adapterId: String(raw.adapterId),
    name: String(raw.name),
    version: String(raw.version),
    status,
    description: String(raw.description),
    supportedAuthModes: raw.supportedAuthModes as AuthMode[],
    supportedFetchMode: raw.supportedFetchMode as FetchMode[],
    entityTypes: raw.entityTypes as string[],
    requiredConfigurationFields: raw.requiredConfigurationFields as string[],
    optionalConfigurationFields: raw.optionalConfigurationFields as string[],
    policyDefaults: {
      allowedDomainsRequired: Boolean(policyDefaults.allowedDomainsRequired),
      maxDepth: Number(policyDefaults.maxDepth),
      maxPagesPerRun: Number(policyDefaults.maxPagesPerRun),
      authRequired: Boolean(policyDefaults.authRequired)
    },
    retentionDefaults: {
      days: Number(retentionDefaults.days)
    },
    sampleOutputs: Array.isArray(raw.sampleOutputs) ? (raw.sampleOutputs as Array<Record<string, unknown>>) : [],
    compatibility: {
      koviVersionRange: String(compatibility.koviVersionRange),
      authModes: compatibility.authModes as AuthMode[],
      fetchModes: compatibility.fetchModes as FetchMode[]
    },
    changelog: Array.isArray(raw.changelog)
      ? raw.changelog.map((item) => {
          const row = asObject(item);
          return {
            version: String(row.version ?? ''),
            date: String(row.date ?? ''),
            notes: String(row.notes ?? '')
          };
        })
      : []
  };

  if (raw.runtime && typeof raw.runtime === 'object') {
    const runtimeObj: { modulePath: string; exportName?: string } = {
      modulePath: String(asObject(raw.runtime).modulePath ?? '')
    };
    if (asObject(raw.runtime).exportName) {
      runtimeObj.exportName = String(asObject(raw.runtime).exportName);
    }
    manifest.runtime = runtimeObj;
  }

  return manifest;
};

class AdapterPackageRegistry {
  private readonly packages = new Map<string, RegisteredAdapterPackage>();

  public register(manifest: PackagedAdapterManifest, adapter: SourceAdapter): void {
    this.packages.set(manifest.adapterId, { manifest, adapter });
  }

  public getAdapter(adapterId: string): SourceAdapter {
    const found = this.packages.get(adapterId);
    if (!found) {
      throw new Error(`unknown packaged adapter: ${adapterId}`);
    }

    if (found.manifest.status === 'deprecated') {
      // Intentionally warn rather than block to preserve backward compatibility for existing sources.
      process.stderr.write(`[kovi] adapter ${adapterId} is deprecated at version ${found.manifest.version}\n`);
    }

    return found.adapter;
  }

  public listManifests(): PackagedAdapterManifest[] {
    return Array.from(this.packages.values()).map((row) => row.manifest);
  }
}

export const createAdapterPackageRegistry = (): AdapterPackageRegistry => {
  const registry = new AdapterPackageRegistry();

  registry.register(
    {
      adapterId: 'static-catalog',
      name: 'Static Catalog Source',
      version: '1.0.0',
      status: 'active',
      description: 'Selector-driven static HTML catalog extractor.',
      supportedAuthModes: ['none', 'manual-cookie-import', 'header-token-injection'],
      supportedFetchMode: ['static'],
      entityTypes: ['catalog_item'],
      requiredConfigurationFields: ['baseUrl', 'crawlEntrypoints', 'allowedDomains', 'extractionSelectors'],
      optionalConfigurationFields: ['pagination', 'changeDetection', 'exportPolicy', 'internalLinkPatterns'],
      policyDefaults: {
        allowedDomainsRequired: true,
        maxDepth: 2,
        maxPagesPerRun: 250,
        authRequired: false
      },
      retentionDefaults: {
        days: 30
      },
      sampleOutputs: [{ id: 'sku-100', title: 'Sample Catalog Item', price: '99.99' }],
      compatibility: {
        koviVersionRange: '>=0.1.0',
        authModes: ['none', 'manual-cookie-import', 'header-token-injection'],
        fetchModes: ['static']
      },
      changelog: [{ version: '1.0.0', date: '2026-03-19', notes: 'Initial packaged adapter.' }]
    },
    new StaticCatalogAdapter()
  );

  registry.register(
    {
      adapterId: 'js-listing-detail',
      name: 'JS Listing/Detail Source',
      version: '1.0.0',
      status: 'active',
      description: 'Browser-rendered list/detail extractor with selector rules.',
      supportedAuthModes: ['none', 'manual-cookie-import', 'header-token-injection'],
      supportedFetchMode: ['js'],
      entityTypes: ['listing_item'],
      requiredConfigurationFields: ['baseUrl', 'crawlEntrypoints', 'allowedDomains', 'extractionSelectors'],
      optionalConfigurationFields: ['pagination', 'changeDetection', 'exportPolicy', 'internalLinkPatterns'],
      policyDefaults: {
        allowedDomainsRequired: true,
        maxDepth: 3,
        maxPagesPerRun: 300,
        authRequired: false
      },
      retentionDefaults: {
        days: 30
      },
      sampleOutputs: [{ id: 'entry-100', title: 'JS Listing Item', features: ['a', 'b'] }],
      compatibility: {
        koviVersionRange: '>=0.1.0',
        authModes: ['none', 'manual-cookie-import', 'header-token-injection'],
        fetchModes: ['js']
      },
      changelog: [{ version: '1.0.0', date: '2026-03-19', notes: 'Initial packaged adapter.' }]
    },
    new JsListingDetailAdapter()
  );

  registry.register(
    {
      adapterId: 'auth-dashboard',
      name: 'Authenticated Dashboard Source',
      version: '1.0.0',
      status: 'beta',
      description: 'Auth portal extraction with Playwright form login bootstrap.',
      supportedAuthModes: ['playwright-form-login'],
      supportedFetchMode: ['js'],
      entityTypes: ['account_snapshot'],
      requiredConfigurationFields: ['baseUrl', 'crawlEntrypoints', 'allowedDomains', 'extractionSelectors', 'authentication'],
      optionalConfigurationFields: ['pagination', 'changeDetection', 'exportPolicy', 'internalLinkPatterns'],
      policyDefaults: {
        allowedDomainsRequired: true,
        maxDepth: 2,
        maxPagesPerRun: 120,
        authRequired: true
      },
      retentionDefaults: {
        days: 14
      },
      sampleOutputs: [{ account_id: 'acct-100', owner: 'Operator User', balance: '1000.00' }],
      compatibility: {
        koviVersionRange: '>=0.1.0',
        authModes: ['playwright-form-login'],
        fetchModes: ['js']
      },
      changelog: [{ version: '1.0.0', date: '2026-03-19', notes: 'Initial packaged adapter.' }]
    },
    new AuthDashboardAdapter()
  );

  return registry;
};

export const loadPackagedAdapterManifestsFromDir = async (manifestDir: string): Promise<PackagedAdapterManifest[]> => {
  const entries = await readdir(manifestDir, { withFileTypes: true });
  const manifests: PackagedAdapterManifest[] = [];

  for (const entry of entries) {
    const manifestPath = entry.isDirectory()
      ? path.join(manifestDir, entry.name, 'manifest.json')
      : entry.name.endsWith('.json')
        ? path.join(manifestDir, entry.name)
        : null;

    if (!manifestPath) {
      continue;
    }

    const raw = JSON.parse(await readFile(manifestPath, 'utf-8'));
    manifests.push(validateAdapterManifest(raw));
  }

  return manifests;
};

export const registerExternalPackagedAdapter = async (
  registry: AdapterPackageRegistry,
  manifest: PackagedAdapterManifest,
  baseDir: string
): Promise<void> => {
  if (!manifest.runtime?.modulePath) {
    throw new Error(`adapter ${manifest.adapterId} is missing runtime.modulePath`);
  }

  const moduleUrl = pathToFileURL(path.resolve(baseDir, manifest.runtime.modulePath)).href;
  const loaded = (await import(moduleUrl)) as Record<string, unknown>;
  const exportName = manifest.runtime.exportName ?? 'default';
  const factory = loaded[exportName];

  if (typeof factory !== 'function') {
    throw new Error(`adapter runtime export ${exportName} is not a function for ${manifest.adapterId}`);
  }

  const adapter = (factory as () => SourceAdapter)();
  registry.register(manifest, adapter);
};
