import type { JsonValue } from '@ai-novelist/contracts';

export type CharacterStatePatch = Record<string, JsonValue>;

export interface CharacterStateChangePayload {
  characterId: string;
  patch: CharacterStatePatch;
}

function isObject(value: JsonValue | undefined): value is CharacterStatePatch {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneObject(value: Record<string, JsonValue>): Record<string, JsonValue> {
  const copy: Record<string, JsonValue> = {};

  for (const [key, child] of Object.entries(value)) {
    Object.defineProperty(copy, key, {
      value: cloneJsonValue(child),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }

  return copy;
}

export function validateCharacterStateChangePayload(
  payload: Record<string, JsonValue>,
): CharacterStateChangePayload {
  const characterId = payload['characterId'];
  const patch = payload['patch'];

  if (typeof characterId !== 'string' || !isObject(patch)) {
    throw new Error('INVALID_CHARACTER_STATE_EVENT');
  }

  return { characterId, patch };
}

export function cloneJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(cloneJsonValue);
  }

  if (isObject(value)) {
    return cloneObject(value);
  }

  return value;
}

export function cloneCharacterStatePatch(patch: CharacterStatePatch): CharacterStatePatch {
  return cloneObject(patch);
}
