import {
  CharacterStateChangedEventEnvelopeV1Schema,
  EventEnvelopeBaseSchema,
  type EventEnvelope,
  type EventEnvelopeBase,
} from '@ai-novelist/contracts';

type ReplayableEventParser = (event: EventEnvelopeBase) => EventEnvelope;

function parseCharacterStateChangedV1(event: EventEnvelopeBase): EventEnvelope {
  const result = CharacterStateChangedEventEnvelopeV1Schema.safeParse(event);

  if (!result.success) {
    throw new Error('INVALID_CHARACTER_STATE_EVENT');
  }

  return result.data;
}

const replayableEventParsers = new Map<string, ReplayableEventParser>([
  ['1:character.state.changed', parseCharacterStateChangedV1],
]);

export function validateReplayableEventEnvelope(input: unknown): EventEnvelope {
  const event = EventEnvelopeBaseSchema.parse(input);
  const parser = replayableEventParsers.get(`${event.schemaVersion}:${event.eventType}`);

  if (parser === undefined) {
    throw new Error('UNSUPPORTED_EVENT_TYPE');
  }

  return parser(event);
}
