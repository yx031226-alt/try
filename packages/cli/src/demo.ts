import Database from 'better-sqlite3';

import type { ChangeProposal } from '@ai-novelist/contracts';
import {
  ApprovalService,
  CharacterProjection,
  SnapshotService,
  SqliteEventStore,
} from '@ai-novelist/core';

const store = new SqliteEventStore(new Database(':memory:'));
const proposal: ChangeProposal = {
  proposalId: 'proposal-demo',
  schemaVersion: 1,
  workId: 'work-demo',
  eventType: 'character.state.changed',
  createdAt: '2026-07-22T12:00:00.000Z',
  createdBy: { kind: 'skill', id: 'prose', version: '0.1.0' },
  payload: { characterId: 'hero', patch: { location: '临江城', alive: true } },
  status: 'pending',
};

new ApprovalService(store, () => 'event-demo').approve(proposal, {
  approvedBy: 'local-author',
  approvedAt: '2026-07-22T12:01:00.000Z',
  reason: '确认人物状态变更',
});

const states = new CharacterProjection().rebuild(store.readAll('work-demo'));

process.stdout.write(new SnapshotService().renderCharacterState(states));
