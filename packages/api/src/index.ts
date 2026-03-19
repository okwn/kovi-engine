import Fastify, { type FastifyInstance } from 'fastify';
import { registerDestinationRoutes, type DestinationRoutesDeps } from './routes/destinations.js';
import { registerDeliveryRoutes, type DeliveryRoutesDeps } from './routes/deliveries.js';
import { registerAdapterCatalogRoutes, type AdapterCatalogRoutesDeps } from './routes/adapters.js';

export interface KoviApiServer {
  app: FastifyInstance;
  start: (port: number) => Promise<void>;
  stop: () => Promise<void>;
}

export interface KoviApiDeps {
  db: DestinationRoutesDeps['db'];
  destinationRegistry: DestinationRoutesDeps['destinationRegistry'];
  secretProvider: DestinationRoutesDeps['secretProvider'];
}

export const createKoviApiServer = (deps: KoviApiDeps): KoviApiServer => {
  const app = Fastify({ logger: true });

  registerDestinationRoutes(app, deps);
  registerDeliveryRoutes(app, { db: deps.db });
  registerAdapterCatalogRoutes(app, { db: deps.db });

  app.get('/health', async () => ({ status: 'ok', service: 'kovi-api' }));

  return {
    app,
    start: async (port: number): Promise<void> => {
      await app.listen({ port });
    },
    stop: async (): Promise<void> => {
      await app.close();
    }
  };
};

export { registerDestinationRoutes, registerDeliveryRoutes, registerAdapterCatalogRoutes };
export type { DestinationRoutesDeps, DeliveryRoutesDeps, AdapterCatalogRoutesDeps };