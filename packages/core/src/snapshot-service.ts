import type { JsonValue } from '@ai-novelist/contracts';

import type { CharacterStates } from './character-projection.js';

const MARKDOWN_OR_HTML_RISK = new Set([
  '&',
  '<',
  '>',
  '`',
  '*',
  '_',
  '{',
  '}',
  '[',
  ']',
  '(',
  ')',
  '#',
  '+',
  '.',
  '!',
  '|',
  '~',
  '\u2028',
  '\u2029',
]);
const JSON_NUMBER_LITERAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/u;
const CONTROL_OR_LINE_SEPARATOR = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

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

function markdownSafeJsonString(value: string): string {
  return Array.from(JSON.stringify(value), (character) => {
    if (!MARKDOWN_OR_HTML_RISK.has(character)) {
      return character;
    }

    return `\\u${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`;
  }).join('');
}

function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'string') {
    return markdownSafeJsonString(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }

  return `{${Object.entries(value)
    .sort(([left], [right]) => compareCodePoints(left, right))
    .map(([key, child]) => `${markdownSafeJsonString(key)}:${canonicalJson(child)}`)
    .join(',')}}`;
}

function isAmbiguousJsonScalarText(value: string): boolean {
  return (
    value === 'null' ||
    value === 'true' ||
    value === 'false' ||
    (JSON_NUMBER_LITERAL.test(value) && Number.isFinite(Number(value)))
  );
}

function isSafeBareText(value: string): boolean {
  return (
    value.length > 0 &&
    !CONTROL_OR_LINE_SEPARATOR.test(value) &&
    !Array.from(value).some((character) => MARKDOWN_OR_HTML_RISK.has(character))
  );
}

function renderLabel(value: string): string {
  return isSafeBareText(value) ? value : markdownSafeJsonString(value);
}

function renderValue(value: JsonValue): string {
  if (typeof value === 'string') {
    return isSafeBareText(value) && !isAmbiguousJsonScalarText(value)
      ? value
      : markdownSafeJsonString(value);
  }

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
          .map((key) => `- ${renderLabel(key)}: ${renderValue(state[key]!)}`);

        return fields.length === 0
          ? `## ${renderLabel(characterId)}`
          : [`## ${renderLabel(characterId)}`, '', ...fields].join('\n');
      });

    return ['# 人物实时状态', ...characters].join('\n\n') + '\n';
  }
}
