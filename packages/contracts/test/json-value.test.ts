import { describe, expect, it } from 'vitest';

import { ChangeProposalSchema, EventEnvelopeSchema } from '../src/index.js';

const invalidPayloadValues: readonly [string, unknown][] = [
  ['undefined', undefined],
  ['NaN', Number.NaN],
  ['Infinity', Number.POSITIVE_INFINITY],
  ['BigInt', BigInt(1)],
];

describe('JSON payload contracts', () => {
  it.each(invalidPayloadValues)('rejects %s in proposal and event payloads', (_name, value) => {
    expect(
      ChangeProposalSchema.safeParse({
        proposalId: 'proposal-1',
        schemaVersion: 1,
        workId: 'work-1',
        eventType: 'character.state.changed',
        createdAt: '2026-07-18T12:00:00.000Z',
        createdBy: { kind: 'author', id: 'local-author' },
        payload: { value },
        status: 'pending',
      }).success,
    ).toBe(false);

    expect(
      EventEnvelopeSchema.safeParse({
        eventId: 'evt-1',
        schemaVersion: 1,
        workId: 'work-1',
        eventType: 'character.state.changed',
        occurredAt: '2026-07-18T12:00:00.000Z',
        actor: { kind: 'author', id: 'local-author' },
        proposalId: 'proposal-1',
        approval: {
          approvedBy: 'local-author',
          approvedAt: '2026-07-18T12:00:00.000Z',
          reason: '确认章节变化',
        },
        payload: { value },
      }).success,
    ).toBe(false);
  });
});
