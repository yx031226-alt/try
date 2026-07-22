import type { EventEnvelope } from '@ai-novelist/contracts';

export interface EventStore {
  append(event: EventEnvelope): 'appended' | 'duplicate';
  readAll(workId: string): EventEnvelope[];
}
