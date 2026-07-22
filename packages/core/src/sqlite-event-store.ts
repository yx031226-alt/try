import { EventEnvelopeSchema, type EventEnvelope } from '@ai-novelist/contracts';
import type Database from 'better-sqlite3';

import type { EventStore } from './event-store.js';

type StoredBody = { body: string };

export class SqliteEventStore implements EventStore {
  constructor(private readonly database: Database.Database) {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS events (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL UNIQUE,
        proposal_id TEXT NOT NULL UNIQUE,
        work_id TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        body TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_work_sequence ON events (work_id, sequence);
    `);
  }

  append(event: EventEnvelope): 'appended' | 'duplicate' {
    const parsed = EventEnvelopeSchema.parse(event);
    const body = JSON.stringify(parsed);
    const existingEvent = this.database
      .prepare<[string], StoredBody>('SELECT body FROM events WHERE event_id = ?')
      .get(parsed.eventId);

    if (existingEvent !== undefined) {
      if (existingEvent.body !== body) {
        throw new Error('EVENT_ID_CONFLICT');
      }

      return 'duplicate';
    }

    const existingProposal = this.database
      .prepare<[string], StoredBody>('SELECT body FROM events WHERE proposal_id = ?')
      .get(parsed.proposalId);

    if (existingProposal !== undefined) {
      throw new Error('PROPOSAL_ALREADY_COMMITTED');
    }

    this.database
      .prepare(
        'INSERT INTO events (event_id, proposal_id, work_id, occurred_at, body) VALUES (?, ?, ?, ?, ?)',
      )
      .run(parsed.eventId, parsed.proposalId, parsed.workId, parsed.occurredAt, body);

    return 'appended';
  }

  readAll(workId: string): EventEnvelope[] {
    const events = this.database
      .prepare<[string], StoredBody>('SELECT body FROM events WHERE work_id = ? ORDER BY sequence')
      .all(workId);

    return events.map(({ body }) => EventEnvelopeSchema.parse(JSON.parse(body)));
  }
}
