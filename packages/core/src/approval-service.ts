import { ApprovalSchema, type ChangeProposal, type EventEnvelope } from '@ai-novelist/contracts';

import type { EventStore } from './event-store.js';
import { validateReplayableEventEnvelope } from './replayable-event.js';

export class ApprovalService {
  constructor(
    private readonly store: EventStore,
    private readonly nextEventId: () => string,
  ) {}

  approve(proposal: ChangeProposal, approvalInput: unknown): EventEnvelope {
    if (proposal.status !== 'pending') {
      throw new Error('PROPOSAL_NOT_PENDING');
    }

    const approval = ApprovalSchema.parse(approvalInput);
    const event: EventEnvelope = validateReplayableEventEnvelope({
      eventId: this.nextEventId(),
      schemaVersion: proposal.schemaVersion,
      workId: proposal.workId,
      eventType: proposal.eventType,
      occurredAt: approval.approvedAt,
      actor: { kind: 'author', id: approval.approvedBy },
      proposalId: proposal.proposalId,
      approval,
      payload: proposal.payload,
    });

    this.store.append(event);

    return event;
  }
}
