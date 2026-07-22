import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import type { EventEnvelope } from '@ai-novelist/contracts';

import { SqliteEventStore } from '../src/index.js';

const event: EventEnvelope = {
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
  payload: {
    characterId: 'char-1',
    patch: { location: '临江城' },
  },
};

describe('SqliteEventStore', () => {
  it('appends an event once and returns it in sequence order', () => {
    const store = new SqliteEventStore(new Database(':memory:'));

    expect(store.append(event)).toBe('appended');
    expect(store.append(event)).toBe('duplicate');
    expect(store.readAll('work-1')).toEqual([event]);
  });

  it('rejects a reused event ID with a different body', () => {
    const store = new SqliteEventStore(new Database(':memory:'));
    const changedEvent: EventEnvelope = {
      ...event,
      payload: {
        characterId: 'char-2',
        patch: { location: '临江城' },
      },
    };

    store.append(event);

    expect(() => store.append(changedEvent)).toThrow('EVENT_ID_CONFLICT');
  });

  it('rejects a proposal that has already been committed', () => {
    const store = new SqliteEventStore(new Database(':memory:'));
    const committedProposalAgain: EventEnvelope = {
      ...event,
      eventId: 'evt-2',
    };

    store.append(event);

    expect(() => store.append(committedProposalAgain)).toThrow('PROPOSAL_ALREADY_COMMITTED');
  });
});
