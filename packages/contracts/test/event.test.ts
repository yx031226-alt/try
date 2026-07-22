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

  it.each([
    ['a null patch', { characterId: 'char-1', patch: null }],
    ['a missing character ID', { patch: { location: '临江城' } }],
  ])('rejects character state event envelopes with %s', (_description, payload) => {
    const result = EventEnvelopeSchema.safeParse({
      eventId: 'evt-invalid',
      schemaVersion: 1,
      workId: 'work-1',
      eventType: 'character.state.changed',
      occurredAt: '2026-07-18T00:00:00.000Z',
      actor: { kind: 'author', id: 'local-author' },
      proposalId: 'proposal-invalid',
      approval: {
        approvedBy: 'local-author',
        approvedAt: '2026-07-18T00:00:00.000Z',
        reason: '确认人物状态变更',
      },
      payload,
    });

    expect(result.success).toBe(false);
  });

  it('rejects unsupported formal event types', () => {
    const result = EventEnvelopeSchema.safeParse({
      eventId: 'evt-unsupported',
      schemaVersion: 1,
      workId: 'work-1',
      eventType: 'chapter.published',
      occurredAt: '2026-07-18T00:00:00.000Z',
      actor: { kind: 'author', id: 'local-author' },
      proposalId: 'proposal-unsupported',
      approval: {
        approvedBy: 'local-author',
        approvedAt: '2026-07-18T00:00:00.000Z',
        reason: '确认章节发布',
      },
      payload: { chapterId: 'chapter-1' },
    });

    expect(result.success).toBe(false);
  });

  it('rejects a malformed character state proposal payload', () => {
    const result = ChangeProposalSchema.safeParse({
      proposalId: 'proposal-invalid',
      schemaVersion: 1,
      workId: 'work-1',
      eventType: 'character.state.changed',
      createdAt: '2026-07-18T00:00:00.000Z',
      createdBy: { kind: 'skill', id: 'prose', version: '0.1.0' },
      payload: { characterId: 'char-1', patch: null },
      status: 'pending',
    });

    expect(result.success).toBe(false);
  });
});
