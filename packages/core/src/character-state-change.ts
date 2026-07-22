import type { CharacterStateChangedPayloadV1, JsonValue } from '@ai-novelist/contracts';

export type CharacterStatePatch = CharacterStateChangedPayloadV1['patch'];

function isObject(value: JsonValue): value is Record<string, JsonValue> {
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
