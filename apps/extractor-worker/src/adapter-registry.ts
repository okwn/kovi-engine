import {
  createAdapterPackageRegistry,
  loadPackagedAdapterManifestsFromDir,
  registerExternalPackagedAdapter,
  type SourceAdapter
} from '@kovi/source-sdk';

const registry = createAdapterPackageRegistry();
let externalLoaded = false;

const loadExternalRegistry = async (): Promise<void> => {
  if (externalLoaded) {
    return;
  }

  const manifestDir = process.env.KOVI_ADAPTER_MANIFEST_DIR;
  if (!manifestDir) {
    externalLoaded = true;
    return;
  }

  try {
    const manifests = await loadPackagedAdapterManifestsFromDir(manifestDir);
    for (const manifest of manifests) {
      await registerExternalPackagedAdapter(registry, manifest, manifestDir);
    }
  } finally {
    externalLoaded = true;
  }
};

export const getAdapter = async (adapterType: string): Promise<SourceAdapter> => {
  await loadExternalRegistry();
  return registry.getAdapter(adapterType);
};

export const listPackagedAdapters = async () => {
  await loadExternalRegistry();
  return registry.listManifests();
};
