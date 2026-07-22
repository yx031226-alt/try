import type { EventEnvelope, JsonValue } from '@ai-novelist/contracts';

export type CharacterState = Record<string, JsonValue>;
export type CharacterStates = Record<string, CharacterState>;

function isObject(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class CharacterProjection {
  rebuild(events: EventEnvelope[]): CharacterStates {
    const characters: CharacterStates = {};

    for (const event of events) {
      if (event.eventType !== 'character.state.changed') {
        continue;
      }

      const characterId = event.payload['characterId'];
      const patch = event.payload['patch'];

      if (typeof characterId !== 'string' || !isObject(patch)) {
        throw new Error('INVALID_CHARACTER_STATE_EVENT');
      }

      const currentState = Object.getOwnPropertyDescriptor(characters, characterId)?.value;
      const nextState: CharacterState = { ...currentState, ...patch };

      Object.defineProperty(characters, characterId, {
        value: nextState,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }

    return characters;
  }
}
