import { describe, expect, it } from 'vitest';

import { SnapshotService } from '../src/index.js';

describe('SnapshotService', () => {
  it('renders character states in deterministic Markdown order', () => {
    const states = {
      'char-2': { location: '北境' },
      'char-1': { location: '临江城', alive: true },
    };

    expect(new SnapshotService().renderCharacterState(states)).toBe(
      '# 人物实时状态\n\n## char-1\n\n- alive: true\n- location: 临江城\n\n## char-2\n\n- location: 北境\n',
    );
  });

  it('uses canonical JSON for nested field values', () => {
    const states = {
      'char-1': {
        details: { z: true, a: null },
        items: [{ y: 2, x: 1 }, '盟友'],
      },
    };

    expect(new SnapshotService().renderCharacterState(states)).toBe(
      '# 人物实时状态\n\n## char-1\n\n- details: {"a":null,"z":true}\n- items: [{"x":1,"y":2},"盟友"]\n',
    );
  });

  it('sorts names by Unicode code point instead of locale rules', () => {
    const states = {
      '😀': { state: 'later code point' },
      '￿': { state: 'earlier code point' },
    };

    expect(new SnapshotService().renderCharacterState(states)).toBe(
      '# 人物实时状态\n\n## ￿\n\n- state: earlier code point\n\n## 😀\n\n- state: later code point\n',
    );
  });

  it('keeps string values distinct from matching JSON scalar text', () => {
    const states = {
      'char-1': {
        boolean: true,
        booleanText: 'true',
        null: null,
        nullText: 'null',
        number: 1,
        numberText: '1',
      },
    };

    expect(new SnapshotService().renderCharacterState(states)).toBe(
      '# 人物实时状态\n\n## char-1\n\n- boolean: true\n- booleanText: "true"\n- null: null\n- nullText: "null"\n- number: 1\n- numberText: "1"\n',
    );
  });

  it('encodes unsafe values without allowing forged Markdown or HTML', () => {
    const states = {
      'char-1': { note: 'line one\n## forged <em>' },
    };

    expect(new SnapshotService().renderCharacterState(states)).toBe(
      '# 人物实时状态\n\n## char-1\n\n- note: "line one\\n\\u0023\\u0023 forged \\u003Cem\\u003E"\n',
    );
  });

  it('encodes unsafe character IDs and field names on one Markdown line', () => {
    const states = {
      'hero\n## forged <b>': {
        'role\n- forged <script>': 'guardian',
      },
    };

    expect(new SnapshotService().renderCharacterState(states)).toBe(
      '# 人物实时状态\n\n## "hero\\n\\u0023\\u0023 forged \\u003Cb\\u003E"\n\n- "role\\n- forged \\u003Cscript\\u003E": guardian\n',
    );
  });

  it('renders an empty state collection with only the document heading', () => {
    expect(new SnapshotService().renderCharacterState({})).toBe('# 人物实时状态\n');
  });

  it('renders an empty character state without an empty list item', () => {
    expect(new SnapshotService().renderCharacterState({ 'char-1': {} })).toBe(
      '# 人物实时状态\n\n## char-1\n',
    );
  });

  it('encodes control and format characters in every snapshot text position', () => {
    const states = {
      'hero\u007F': {
        directValue: 'value\u202E',
        'field\u0085': 'guardian',
        nested: {
          array: ['array\u0085', 'format\u202E'],
          object: { secret: 'object\u007F' },
        },
      },
    };

    expect(new SnapshotService().renderCharacterState(states)).toBe(
      '# 人物实时状态\n\n## "hero\\u007F"\n\n- directValue: "value\\u202E"\n- "field\\u0085": guardian\n- nested: {"array":["array\\u0085","format\\u202E"],"object":{"secret":"object\\u007F"}}\n',
    );
  });

  it('encodes non-BMP format characters as UTF-16 surrogate pairs', () => {
    expect(
      new SnapshotService().renderCharacterState({
        'char-1': { note: 'hidden\u{E0001}' },
      }),
    ).toBe('# 人物实时状态\n\n## char-1\n\n- note: "hidden\\uDB40\\uDC01"\n');
  });

  it('quotes boundary and whitespace-only Unicode whitespace in every text position', () => {
    const states = {
      '\u00A0hero ': {
        ' field\u00A0': ' value\u00A0',
        blank: ' \u00A0',
        nested: {
          array: [' leading', 'trailing ', ' \u00A0'],
          object: { ' key ': ' value ' },
        },
      },
    };

    expect(new SnapshotService().renderCharacterState(states)).toBe(
      '# 人物实时状态\n\n## "\u00A0hero "\n\n- " field\u00A0": " value\u00A0"\n- blank: " \u00A0"\n- nested: {"array":[" leading","trailing "," \u00A0"],"object":{" key ":" value "}}\n',
    );
  });

  it('quotes backslashes in labels and values without Markdown escape ambiguity', () => {
    const states = {
      'hero\\': {
        'path\\': 'trail\\',
        nested: {
          array: ['inner\\'],
          object: { 'key\\': 'value\\' },
        },
      },
    };

    expect(new SnapshotService().renderCharacterState(states)).toBe(
      '# 人物实时状态\n\n## "hero\\\\"\n\n- nested: {"array":["inner\\\\"],"object":{"key\\\\":"value\\\\"}}\n- "path\\\\": "trail\\\\"\n',
    );
  });
});
