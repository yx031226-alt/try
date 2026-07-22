import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import type { ChangeProposal } from '@ai-novelist/contracts';
import {
  ApprovalService,
  CharacterProjection,
  SnapshotService,
  SqliteEventStore,
} from '@ai-novelist/core';

describe('M0 acceptance', () => {
  it('commits an approved character proposal and renders the rebuilt state', () => {
    const store = new SqliteEventStore(new Database(':memory:'));
    const proposal: ChangeProposal = {
      proposalId: 'proposal-1',
      schemaVersion: 1,
      workId: 'work-1',
      eventType: 'character.state.changed',
      createdAt: '2026-07-22T12:00:00.000Z',
      createdBy: { kind: 'skill', id: 'prose', version: '0.1.0' },
      payload: { characterId: 'char-1', patch: { location: '临江城' } },
      status: 'pending',
    };

    expect(new CharacterProjection().rebuild(store.readAll('work-1'))).toEqual({});

    new ApprovalService(store, () => 'event-1').approve(proposal, {
      approvedBy: 'local-author',
      approvedAt: '2026-07-22T12:01:00.000Z',
      reason: '确认人物位置变更',
    });

    const states = new CharacterProjection().rebuild(store.readAll('work-1'));

    expect(new SnapshotService().renderCharacterState(states)).toContain('- location: 临江城');
  });
});
