import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { KoviDatabase } from '@kovi/db';
import { createAdapterPackageRegistry } from '@kovi/source-sdk';

export interface AdapterCatalogRoutesDeps {
  db: KoviDatabase;
}

export const registerAdapterCatalogRoutes = (
  app: FastifyInstance,
  deps: AdapterCatalogRoutesDeps
): void => {
  const internalRegistry = createAdapterPackageRegistry();

  app.get('/adapters', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const manifests = internalRegistry.listManifests();
    return manifests.map((m) => ({
      adapterId: m.adapterId,
      name: m.name,
      version: m.version,
      status: m.status,
      description: m.description,
      supportedAuthModes: m.supportedAuthModes,
      supportedFetchMode: m.supportedFetchMode,
      entityTypes: m.entityTypes,
      compatibility: m.compatibility
    }));
  });

  app.get<{ Params: { adapterId: string } }>(
    '/adapters/:adapterId',
    async (request: FastifyRequest<{ Params: { adapterId: string } }>, reply: FastifyReply) => {
      const { adapterId } = request.params;
      const manifests = internalRegistry.listManifests();
      const manifest = manifests.find((m) => m.adapterId === adapterId);
      if (!manifest) {
        return reply.status(404).send({ error: 'Adapter not found' });
      }
      return manifest;
    }
  );

  app.get<{ Params: { adapterId: string }; Querystring: { version?: string } }>(
    '/adapters/:adapterId/versions',
    async (request: FastifyRequest<{ Params: { adapterId: string }; Querystring: { version?: string } }>) => {
      const { adapterId } = request.params;
      const { version } = request.query;
      const packages = await deps.db.listAdapterPackages(version);
      const filtered = packages.filter((p) => p.adapterId === adapterId);
      return filtered.map((p) => ({
        id: p.id,
        adapterId: p.adapterId,
        version: p.version,
        name: p.name,
        status: p.status,
        internalOnly: p.internalOnly,
        changelog: p.changelog,
        sampleOutput: p.sampleOutput,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      }));
    }
  );

  app.get<{ Params: { adapterId: string } }>(
    '/adapters/:adapterId/sample-output',
    async (request: FastifyRequest<{ Params: { adapterId: string } }>, reply: FastifyReply) => {
      const { adapterId } = request.params;
      const manifests = internalRegistry.listManifests();
      const manifest = manifests.find((m) => m.adapterId === adapterId);
      if (!manifest || !manifest.sampleOutputs.length) {
        return reply.status(404).send({ error: 'No sample output available' });
      }
      return manifest.sampleOutputs[0];
    }
  );

  app.get('/adapters/compatible', async (request: FastifyRequest, _reply: FastifyReply) => {
    const versionRange = (request.query as Record<string, string>).koviVersion;
    const authMode = (request.query as Record<string, string>).authMode;
    const fetchMode = (request.query as Record<string, string>).fetchMode;

    const manifests = internalRegistry.listManifests();
    return manifests.filter((m) => {
      if (versionRange && !satisfiesVersionRange(m.compatibility.koviVersionRange, versionRange)) {
        return false;
      }
      if (authMode && !m.compatibility.authModes.includes(authMode as any)) {
        return false;
      }
      if (fetchMode && !m.compatibility.fetchModes.includes(fetchMode as any)) {
        return false;
      }
      return true;
    });
  });
};

const satisfiesVersionRange = (supported: string, requested: string): boolean => {
  if (supported.startsWith('>=')) {
    const minVersion = supported.slice(2);
    return compareVersions(minVersion, requested) <= 0;
  }
  return true;
};

const compareVersions = (a: string, b: string): number => {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const partA = partsA[i] ?? 0;
    const partB = partsB[i] ?? 0;
    if (partA > partB) return 1;
    if (partA < partB) return -1;
  }
  return 0;
};