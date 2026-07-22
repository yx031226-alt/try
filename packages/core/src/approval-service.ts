import { ApprovalSchema, type ChangeProposal, type EventEnvelope } from '@ai-novelist/contracts';

import { validateCharacterStateChangePayload } from './character-state-change.js';
import type { EventStore } from './event-store.js';

const proposalPayloadValidators = new Map<string, (payload: ChangeProposal['payload']) => void>([
  ['character.state.changed', validateCharacterStateChangePayload],
]);

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
    proposalPayloadValidators.get(proposal.eventType)?.(proposal.payload);
    const event: EventEnvelope = {
      eventId: this.nextEventId(),
      schemaVersion: proposal.schemaVersion,
      workId: proposal.workId,
      eventType: proposal.eventType,
      occurredAt: approval.approvedAt,
      actor: { kind: 'author', id: approval.approvedBy },
      proposalId: proposal.proposalId,
      approval,
      payload: proposal.payload,
    };

    this.store.append(event);

    return event;
  }
}
