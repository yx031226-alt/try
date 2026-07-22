import type { EventEnvelope, JsonValue } from '@ai-novelist/contracts';

import { cloneCharacterStatePatch } from './character-state-change.js';
import { validateReplayableEventEnvelope } from './replayable-event.js';

export type CharacterState = Record<string, JsonValue>;
export type CharacterStates = Record<string, CharacterState>;

export class CharacterProjection {
  rebuild(events: EventEnvelope[]): CharacterStates {
    const characters: CharacterStates = {};

    for (const input of events) {
      const event = validateReplayableEventEnvelope(input);
      const { characterId, patch } = event.payload;

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
