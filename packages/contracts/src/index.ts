import { z } from 'zod';

export const contractTypeSchema = z.enum([
  'entity.snapshot',
  'entity.change',
  'source.run.summary',
  'source.health'
]);

export const contractVersionSchema = z.literal('1.0');

export const eventEnvelopeSchema = z.object({
  schemaVersion: z.literal('1.0'),
  contractType: contractTypeSchema,
  contractVersion: contractVersionSchema,
  eventType: z.string().min(1),
  eventId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  occurredAt: z.string().min(1),
  tenantId: z.string().min(1),
  sourceId: z.string().min(1),
  entityId: z.string().optional(),
  recordKey: z.string().optional(),
  versionNo: z.number().int().positive().optional(),
  changeScopes: z.array(z.enum(['page', 'entity', 'field'])),
  changes: z.object({
    pageChanged: z.boolean(),
    entityChanged: z.boolean(),
    fieldChanges: z.array(
      z.object({
        field: z.string(),
        before: z.unknown(),
        after: z.unknown()
      })
    )
  }),
  payload: z.record(z.unknown())
});

export type ContractType = z.infer<typeof contractTypeSchema>;

export const validateEventEnvelope = (input: unknown): void => {
  eventEnvelopeSchema.parse(input);
};

export const negotiateContractVersion = (requested: string | undefined): '1.0' => {
  if (!requested || requested === '1.0') {
    return '1.0';
  }

  throw new Error(`unsupported contract version requested: ${requested}`);
};
