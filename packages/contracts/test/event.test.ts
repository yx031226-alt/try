import { describe, expect, it } from 'vitest';

import { ChangeProposalSchema, EventEnvelopeSchema } from '../src/index.js';

describe('event contracts', () => {
  it('rejects events without proposal approval metadata', () => {
    const result = EventEnvelopeSchema.safeParse({
      eventId: 'evt-1',
      schemaVersion: 1,
      workId: 'work-1',
      eventType: 'character.state.changed',
      occurredAt: '2026-07-18T00:00:00.000Z',
      actor: { kind: 'author', id: 'local-author' },
      payload: {
        characterId: 'char-1',
        patch: { location: '临江城' },
      },
    });

    expect(result.success).toBe(false);
  });

  it('parses a pending change proposal', () => {
    const proposal = ChangeProposalSchema.parse({
      proposalId: 'proposal-1',
      schemaVersion: 1,
      workId: 'work-1',
      eventType: 'character.state.changed',
      createdAt: '2026-07-18T00:00:00.000Z',
      createdBy: { kind: 'skill', id: 'prose', version: '0.1.0' },
      payload: {
        characterId: 'char-1',
        patch: { location: '临江城' },
      },
      status: 'pending',
    });

    expect(proposal.status).toBe('pending');
  });
});
