import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { ChangeProposal, EventEnvelope } from '@ai-novelist/contracts';

import { ApprovalService, CharacterProjection, SqliteEventStore } from '../src/index.js';

const proposal: ChangeProposal = {
  proposalId: 'proposal-1',
  schemaVersion: 1,
  workId: 'work-1',
  eventType: 'character.state.changed',
  createdAt: '2026-07-18T12:00:00.000Z',
  createdBy: { kind: 'skill', id: 'prose', version: '0.1.0' },
  payload: {
    characterId: 'char-1',
    patch: { location: '临江城', alive: true },
  },
  status: 'pending',
};

function withInMemoryStore<T>(callback: (store: SqliteEventStore) => T): T {
  const database = new Database(':memory:');

  try {
    return callback(new SqliteEventStore(database));
  } finally {
    database.close();
  }
}

describe('ApprovalService and CharacterProjection', () => {
  it('projects no character state before a pending proposal is approved', () => {
    withInMemoryStore((store) => {
      expect(new CharacterProjection().rebuild(store.readAll(proposal.workId))).toEqual({});
    });
  });

  it('commits an approved proposal and rebuilds its character state', () => {
    withInMemoryStore((store) => {
      const event = new ApprovalService(store, () => 'evt-1').approve(proposal, {
        approvedBy: 'local-author',
        approvedAt: '2026-07-18T12:01:00.000Z',
        reason: '确认人物状态变更',
      });

      expect(event).toEqual({
        eventId: 'evt-1',
        schemaVersion: 1,
        workId: 'work-1',
        eventType: 'character.state.changed',
        occurredAt: '2026-07-18T12:01:00.000Z',
        actor: { kind: 'author', id: 'local-author' },
        proposalId: 'proposal-1',
        approval: {
          approvedBy: 'local-author',
          approvedAt: '2026-07-18T12:01:00.000Z',
          reason: '确认人物状态变更',
        },
        payload: {
          characterId: 'char-1',
          patch: { location: '临江城', alive: true },
        },
      });
      expect(new CharacterProjection().rebuild(store.readAll(proposal.workId))).toEqual({
        'char-1': { location: '临江城', alive: true },
      });
    });
  });

  it('rejects a proposal that is not pending', () => {
    withInMemoryStore((store) => {
      const rejectedProposal: ChangeProposal = { ...proposal, status: 'rejected' };

      expect(() =>
        new ApprovalService(store, () => 'evt-1').approve(rejectedProposal, {
          approvedBy: 'local-author',
          approvedAt: '2026-07-18T12:01:00.000Z',
          reason: '确认人物状态变更',
        }),
      ).toThrow('PROPOSAL_NOT_PENDING');
    });
  });

  it.each([
    ['a null patch', { characterId: 'char-1', patch: null }],
    ['a missing character ID', { patch: { location: '临江城' } }],
  ])('rejects %s before it enters the event store', (_description, payload) => {
    withInMemoryStore((store) => {
      const invalidProposal = {
        ...proposal,
        proposalId: 'proposal-invalid',
        payload,
      } as unknown as ChangeProposal;

      expect(() =>
        new ApprovalService(store, () => 'evt-invalid').approve(invalidProposal, {
          approvedBy: 'local-author',
          approvedAt: '2026-07-18T12:01:00.000Z',
          reason: '确认人物状态变更',
        }),
      ).toThrow('INVALID_CHARACTER_STATE_EVENT');
      expect(store.readAll(proposal.workId)).toEqual([]);
    });
  });

  it('merges character patches in event order', () => {
    const projection = new CharacterProjection();
    const first: EventEnvelope = {
      eventId: 'evt-1',
      schemaVersion: 1,
      workId: 'work-1',
      eventType: 'character.state.changed',
      occurredAt: '2026-07-18T12:01:00.000Z',
      actor: { kind: 'author', id: 'local-author' },
      proposalId: 'proposal-1',
      approval: {
        approvedBy: 'local-author',
        approvedAt: '2026-07-18T12:01:00.000Z',
        reason: '确认人物状态变更',
      },
      payload: { characterId: 'char-1', patch: { location: '临江城', alive: true } },
    };
    const second: EventEnvelope = {
      ...first,
      eventId: 'evt-2',
      proposalId: 'proposal-2',
      payload: { characterId: 'char-1', patch: { location: '云梦泽', level: 3 } },
    };

    expect(projection.rebuild([first, second])).toEqual({
      'char-1': { location: '云梦泽', alive: true, level: 3 },
    });
  });

  it('rejects malformed character state events', () => {
    const invalidEvent = {
      eventId: 'evt-1',
      schemaVersion: 1,
      workId: 'work-1',
      eventType: 'character.state.changed',
      occurredAt: '2026-07-18T12:01:00.000Z',
      actor: { kind: 'author', id: 'local-author' },
      proposalId: 'proposal-1',
      approval: {
        approvedBy: 'local-author',
        approvedAt: '2026-07-18T12:01:00.000Z',
        reason: '确认人物状态变更',
      },
      payload: { characterId: 'char-1', patch: null },
    } as unknown as EventEnvelope;

    expect(() => new CharacterProjection().rebuild([invalidEvent])).toThrow(
      'INVALID_CHARACTER_STATE_EVENT',
    );
  });

  it('stores unsafe character IDs as own state keys without changing the output prototype', () => {
    const event: EventEnvelope = {
      eventId: 'evt-unsafe',
      schemaVersion: 1,
      workId: 'work-1',
      eventType: 'character.state.changed',
      occurredAt: '2026-07-18T12:01:00.000Z',
      actor: { kind: 'author', id: 'local-author' },
      proposalId: 'proposal-unsafe',
      approval: {
        approvedBy: 'local-author',
        approvedAt: '2026-07-18T12:01:00.000Z',
        reason: '确认人物状态变更',
      },
      payload: { characterId: '__proto__', patch: { alive: true } },
    };

    const states = new CharacterProjection().rebuild([event]);

    expect(Object.getPrototypeOf(states)).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(states, '__proto__')?.value).toEqual({ alive: true });
  });

  it('deeply copies nested patch values so projection mutations cannot alter an event', () => {
    const sourcePatch = {
      profile: { rank: 1 },
      aliases: ['江湖客'],
    };
    const event: EventEnvelope = {
      eventId: 'evt-isolated',
      schemaVersion: 1,
      workId: 'work-1',
      eventType: 'character.state.changed',
      occurredAt: '2026-07-18T12:01:00.000Z',
      actor: { kind: 'author', id: 'local-author' },
      proposalId: 'proposal-isolated',
      approval: {
        approvedBy: 'local-author',
        approvedAt: '2026-07-18T12:01:00.000Z',
        reason: '确认人物状态变更',
      },
      payload: { characterId: 'char-1', patch: sourcePatch },
    };

    const state = new CharacterProjection().rebuild([event])['char-1'];

    (state?.['profile'] as { rank: number }).rank = 2;
    (state?.['aliases'] as string[]).push('故人');

    expect(sourcePatch).toEqual({
      profile: { rank: 1 },
      aliases: ['江湖客'],
    });
  });

  it('rebuilds ordered events after reopening the SQLite ledger', () => {
    const directory = mkdtempSync(join(tmpdir(), 'ai-novelist-replay-'));
    const databasePath = join(directory, 'events.db');

    try {
      const firstDatabase = new Database(databasePath);

      try {
        const store = new SqliteEventStore(firstDatabase);
        const approvalService = new ApprovalService(store, () =>
          store.readAll('work-1').length === 0 ? 'evt-replay-1' : 'evt-replay-2',
        );

        approvalService.approve(
          {
            ...proposal,
            proposalId: 'proposal-replay-1',
            payload: { characterId: 'char-1', patch: { location: '临江城', alive: true } },
          },
          {
            approvedBy: 'local-author',
            approvedAt: '2026-07-18T12:01:00.000Z',
            reason: '确认人物位置变更',
          },
        );
        approvalService.approve(
          {
            ...proposal,
            proposalId: 'proposal-replay-2',
            payload: { characterId: 'char-1', patch: { location: '云梦泽', level: 3 } },
          },
          {
            approvedBy: 'local-author',
            approvedAt: '2026-07-18T12:02:00.000Z',
            reason: '确认人物状态变更',
          },
        );

        expect(store.readAll('work-1').map((event) => event.eventId)).toEqual([
          'evt-replay-1',
          'evt-replay-2',
        ]);
      } finally {
        firstDatabase.close();
      }

      const reopenedDatabase = new Database(databasePath);

      try {
        const events = new SqliteEventStore(reopenedDatabase).readAll('work-1');

        expect(events.map((event) => event.eventId)).toEqual(['evt-replay-1', 'evt-replay-2']);
        expect(new CharacterProjection().rebuild(events)).toEqual({
          'char-1': { location: '云梦泽', alive: true, level: 3 },
        });
      } finally {
        reopenedDatabase.close();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
