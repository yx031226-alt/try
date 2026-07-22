import type { JsonValue } from '@ai-novelist/contracts';

import type { CharacterStates } from './character-projection.js';

function compareCodePoints(left: string, right: string): number {
  const leftPoints = Array.from(left);
  const rightPoints = Array.from(right);
  const sharedLength = Math.min(leftPoints.length, rightPoints.length);

  for (let index = 0; index < sharedLength; index += 1) {
    const leftPoint = leftPoints[index]!.codePointAt(0)!;
    const rightPoint = rightPoints[index]!.codePointAt(0)!;

    if (leftPoint !== rightPoint) {
      return leftPoint < rightPoint ? -1 : 1;
    }
  }

  return leftPoints.length - rightPoints.length;
}

function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }

  return `{${Object.entries(value)
    .sort(([left], [right]) => compareCodePoints(left, right))
    .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
    .join(',')}}`;
}

function renderValue(value: JsonValue): string {
  if (value !== null && typeof value === 'object') {
    return canonicalJson(value);
  }

  return String(value);
}

export class SnapshotService {
  renderCharacterState(states: CharacterStates): string {
    const characters = Object.keys(states)
      .sort(compareCodePoints)
      .map((characterId) => {
        const state = states[characterId]!;
        const fields = Object.keys(state)
          .sort(compareCodePoints)
          .map((key) => `- ${key}: ${renderValue(state[key]!)}`);

        return [`## ${characterId}`, '', ...fields].join('\n');
      });

    return ['# 人物实时状态', ...characters].join('\n\n') + '\n';
  }
}
