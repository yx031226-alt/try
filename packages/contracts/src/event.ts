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

export const ChangeProposalSchema = z.object({
  proposalId: z.string().min(1),
  schemaVersion: z.literal(1),
  workId: z.string().min(1),
  eventType: z.string().min(1),
  createdAt: z.string().datetime(),
  createdBy: ActorSchema,
  payload: z.record(z.string(), JsonValueSchema),
  status: z.enum(['pending', 'rejected', 'approved']),
});

export const ApprovalSchema = z.object({
  approvedBy: z.string().min(1),
  approvedAt: z.string().datetime(),
  reason: z.string().min(1),
});

export const EventEnvelopeSchema = z.object({
  eventId: z.string().min(1),
  schemaVersion: z.literal(1),
  workId: z.string().min(1),
  eventType: z.string().min(1),
  occurredAt: z.string().datetime(),
  actor: ActorSchema,
  proposalId: z.string().min(1),
  approval: ApprovalSchema,
  payload: z.record(z.string(), JsonValueSchema),
});

export type ChangeProposal = z.infer<typeof ChangeProposalSchema>;
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
