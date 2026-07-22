import type { EventEnvelope, JsonValue } from '@ai-novelist/contracts';

import {
  cloneCharacterStatePatch,
  validateCharacterStateChangePayload,
} from './character-state-change.js';

export type CharacterState = Record<string, JsonValue>;
export type CharacterStates = Record<string, CharacterState>;

export class CharacterProjection {
  rebuild(events: EventEnvelope[]): CharacterStates {
    const characters: CharacterStates = {};

    for (const event of events) {
      if (event.eventType !== 'character.state.changed') {
        continue;
      }

      const { characterId, patch } = validateCharacterStateChangePayload(event.payload);

      const currentState = Object.getOwnPropertyDescriptor(characters, characterId)?.value;
      const nextState: CharacterState = { ...currentState, ...cloneCharacterStatePatch(patch) };

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
