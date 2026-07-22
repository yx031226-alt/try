import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { EventEnvelope } from '@ai-novelist/contracts';

import { SqliteEventStore } from '../src/index.js';

let databases: Database.Database[] = [];
let temporaryDirectory: string | undefined;

afterEach(() => {
  for (const database of databases) {
    database.close();
  }
  databases = [];

  if (temporaryDirectory !== undefined) {
    rmSync(temporaryDirectory, { recursive: true, force: true });
    temporaryDirectory = undefined;
  }
});

function createFileStores(): [SqliteEventStore, SqliteEventStore] {
  temporaryDirectory = mkdtempSync(join(tmpdir(), 'ai-novelist-event-store-'));
  const databaseFile = join(temporaryDirectory, 'events.sqlite');
  const firstDatabase = new Database(databaseFile);
  const secondDatabase = new Database(databaseFile);
  databases.push(firstDatabase, secondDatabase);

  return [new SqliteEventStore(firstDatabase), new SqliteEventStore(secondDatabase)];
}

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

  it.each([
    ['undefined', undefined],
    ['NaN', Number.NaN],
    ['BigInt', BigInt(1)],
  ])('rejects %s before persisting an event', (_name, value) => {
    const store = new SqliteEventStore(new Database(':memory:'));
    const invalidEvent: unknown = {
      ...event,
      payload: { value },
    };

    expect(() => store.append(invalidEvent as EventEnvelope)).toThrow();
    expect(store.readAll('work-1')).toEqual([]);
  });

  it.each([
    ['a null patch', { characterId: 'char-1', patch: null }],
    ['a missing character ID', { patch: { location: '临江城' } }],
  ])('rejects character state events with %s before persisting', (_description, payload) => {
    const store = new SqliteEventStore(new Database(':memory:'));
    const malformedEvent = { ...event, payload } as unknown as EventEnvelope;

    expect(() => store.append(malformedEvent)).toThrow('INVALID_CHARACTER_STATE_EVENT');
    expect(store.readAll('work-1')).toEqual([]);
  });

  it('rejects unsupported formal event types before persisting', () => {
    const store = new SqliteEventStore(new Database(':memory:'));
    const unsupportedEvent = {
      ...event,
      eventType: 'chapter.published',
      payload: { chapterId: 'chapter-1' },
    } as unknown as EventEnvelope;

    expect(() => store.append(unsupportedEvent)).toThrow('UNSUPPORTED_EVENT_TYPE');
    expect(store.readAll('work-1')).toEqual([]);
  });

  it('treats negative zero and its JSON-roundtripped zero as an idempotent duplicate', () => {
    const store = new SqliteEventStore(new Database(':memory:'));
    const negativeZeroEvent: EventEnvelope = {
      ...event,
      eventId: 'evt-negative-zero',
      proposalId: 'proposal-negative-zero',
      payload: { characterId: 'char-1', patch: { reputation: -0 } },
    };
    const roundtrippedEvent = JSON.parse(JSON.stringify(negativeZeroEvent)) as EventEnvelope;

    expect(store.append(negativeZeroEvent)).toBe('appended');
    expect(store.append(roundtrippedEvent)).toBe('duplicate');
  });

  it('treats reordered JSON object keys as an idempotent duplicate', () => {
    const store = new SqliteEventStore(new Database(':memory:'));
    const canonicalEvent: EventEnvelope = {
      ...event,
      eventId: 'evt-canonical',
      proposalId: 'proposal-canonical',
      payload: {
        characterId: 'char-1',
        patch: {
          attributes: { alpha: 'first', beta: 'second' },
          location: '临江城',
        },
      },
    };
    const reorderedEvent: EventEnvelope = {
      ...canonicalEvent,
      payload: {
        patch: {
          location: '临江城',
          attributes: { beta: 'second', alpha: 'first' },
        },
        characterId: 'char-1',
      },
    };

    expect(store.append(canonicalEvent)).toBe('appended');
    expect(store.append(reorderedEvent)).toBe('duplicate');
    expect(JSON.stringify(store.readAll('work-1'))).toBe(JSON.stringify([canonicalEvent]));
  });

  it("returns only one work's events in append sequence", () => {
    const store = new SqliteEventStore(new Database(':memory:'));
    const secondWorkOneEvent: EventEnvelope = {
      ...event,
      eventId: 'evt-2',
      proposalId: 'proposal-2',
    };
    const otherWorkEvent: EventEnvelope = {
      ...event,
      eventId: 'evt-3',
      proposalId: 'proposal-3',
      workId: 'work-2',
    };

    store.append(event);
    store.append(otherWorkEvent);
    store.append(secondWorkOneEvent);

    expect(store.readAll('work-1')).toEqual([event, secondWorkOneEvent]);
  });

  it('returns duplicate for a repeated event across file-backed connections', () => {
    const [firstStore, secondStore] = createFileStores();

    expect(firstStore.append(event)).toBe('appended');
    expect(secondStore.append(event)).toBe('duplicate');
  });

  it('rejects a repeated proposal across file-backed connections', () => {
    const [firstStore, secondStore] = createFileStores();
    const repeatedProposal: EventEnvelope = {
      ...event,
      eventId: 'evt-2',
    };

    expect(firstStore.append(event)).toBe('appended');
    expect(() => secondStore.append(repeatedProposal)).toThrow('PROPOSAL_ALREADY_COMMITTED');
  });
});
