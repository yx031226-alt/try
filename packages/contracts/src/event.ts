import { z } from 'zod';

export const JsonValueSchema = z.json();

export type JsonValue = z.infer<typeof JsonValueSchema>;

export const ActorSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('author'),
    id: z.string().min(1),
  }),
  z.object({
    kind: z.literal('system'),
    id: z.string().min(1),
  }),
  z.object({
    kind: z.literal('skill'),
    id: z.string().min(1),
    version: z.string().min(1),
  }),
]);

export const CharacterStateChangedPayloadV1Schema = z
  .object({
    characterId: z.string().min(1),
    patch: z.record(z.string(), JsonValueSchema),
  })
  .strict();

const ChangeProposalBaseSchema = z
  .object({
    proposalId: z.string().min(1),
    schemaVersion: z.number().int().positive(),
    workId: z.string().min(1),
    eventType: z.string().min(1),
    createdAt: z.string().datetime(),
    createdBy: ActorSchema,
    payload: z.record(z.string(), JsonValueSchema),
    status: z.enum(['pending', 'rejected', 'approved']),
  })
  .strict();

export const CharacterStateChangedProposalV1Schema = ChangeProposalBaseSchema.extend({
  schemaVersion: z.literal(1),
  eventType: z.literal('character.state.changed'),
  payload: CharacterStateChangedPayloadV1Schema,
});

export const ChangeProposalSchema = CharacterStateChangedProposalV1Schema;

export const ApprovalSchema = z.object({
  approvedBy: z.string().min(1),
  approvedAt: z.string().datetime(),
  reason: z.string().min(1),
});

export const EventEnvelopeBaseSchema = z
  .object({
    eventId: z.string().min(1),
    schemaVersion: z.number().int().positive(),
    workId: z.string().min(1),
    eventType: z.string().min(1),
    occurredAt: z.string().datetime(),
    actor: ActorSchema,
    proposalId: z.string().min(1),
    approval: ApprovalSchema,
    payload: z.record(z.string(), JsonValueSchema),
  })
  .strict();

export const CharacterStateChangedEventEnvelopeV1Schema = EventEnvelopeBaseSchema.extend({
  schemaVersion: z.literal(1),
  eventType: z.literal('character.state.changed'),
  payload: CharacterStateChangedPayloadV1Schema,
});

export const EventEnvelopeSchema = CharacterStateChangedEventEnvelopeV1Schema;

export type CharacterStateChangedPayloadV1 = z.infer<typeof CharacterStateChangedPayloadV1Schema>;
export type ChangeProposal = z.infer<typeof ChangeProposalSchema>;
export type EventEnvelopeBase = z.infer<typeof EventEnvelopeBaseSchema>;
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
