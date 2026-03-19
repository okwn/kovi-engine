import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  OTEL_ENABLED: z.coerce.boolean().default(true),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default('http://localhost:4318'),
  OTEL_SERVICE_VERSION: z.string().default('0.1.0'),
  DATABASE_URL: z.string().min(1),
  SESSION_ENCRYPTION_KEY: z.string().min(16),
  TEMPORAL_ADDRESS: z.string().default('localhost:7233'),
  TEMPORAL_NAMESPACE: z.string().default('default'),
  NATS_URL: z.string().default('nats://localhost:4222'),
  EVENT_BUS_BACKEND: z.enum(['nats-jetstream', 'redis-streams']).default('nats-jetstream'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_STREAM_KEY: z.string().default('kovi:events')
});

const apiSchema = baseSchema.extend({
  API_PORT: z.coerce.number().int().positive().default(3000),
  API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(200),
  API_RATE_LIMIT_WINDOW: z.string().default('1 minute')
});

const adminSchema = baseSchema.extend({
  ADMIN_PORT: z.coerce.number().int().positive().default(3100),
  ADMIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  ADMIN_RATE_LIMIT_WINDOW: z.string().default('1 minute')
});

const workerSchema = baseSchema.extend({
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5)
});

const orchestratorSchema = workerSchema.extend({
  ORCH_MAX_SOURCES: z.coerce.number().int().positive().default(50),
  ORCH_GLOBAL_PAGE_CONCURRENCY: z.coerce.number().int().positive().default(40),
  ORCH_PER_SOURCE_CONCURRENCY: z.coerce.number().int().positive().default(4),
  ORCH_PER_DOMAIN_CONCURRENCY: z.coerce.number().int().positive().default(3),
  ORCH_STATIC_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(30),
  ORCH_BROWSER_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(10),
  ORCH_CIRCUIT_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(5),
  ORCH_CIRCUIT_OPEN_MINUTES: z.coerce.number().int().positive().default(15),
  ORCH_DEAD_LETTER_THRESHOLD: z.coerce.number().int().positive().default(3),
  ORCH_CONTINUE_AS_NEW_PAGE_THRESHOLD: z.coerce.number().int().positive().default(250),
  ORCH_SCHEDULE_RECONCILE_SECONDS: z.coerce.number().int().positive().default(60)
});

export type BaseConfig = z.infer<typeof baseSchema>;
export type ApiConfig = z.infer<typeof apiSchema>;
export type AdminConfig = z.infer<typeof adminSchema>;
export type WorkerConfig = z.infer<typeof workerSchema>;
export type OrchestratorConfig = z.infer<typeof orchestratorSchema>;

export const loadBaseConfig = (): BaseConfig => baseSchema.parse(process.env);
export const loadApiConfig = (): ApiConfig => apiSchema.parse(process.env);
export const loadAdminConfig = (): AdminConfig => adminSchema.parse(process.env);
export const loadWorkerConfig = (): WorkerConfig => workerSchema.parse(process.env);
export const loadOrchestratorConfig = (): OrchestratorConfig => orchestratorSchema.parse(process.env);
