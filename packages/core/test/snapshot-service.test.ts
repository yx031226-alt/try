import { describe, expect, it } from 'vitest';

import { SnapshotService } from '../src/index.js';

describe('SnapshotService', () => {
  it('renders character states in deterministic Markdown order', () => {
    const states = {
      'char-2': { location: '北境' },
      'char-1': { location: '临江城', alive: true },
    };

    expect(SnapshotService.render(states)).toBe(
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

    expect(SnapshotService.render(states)).toBe(
      '# 人物实时状态\n\n## char-1\n\n- details: {"a":null,"z":true}\n- items: [{"x":1,"y":2},"盟友"]\n',
    );
  });

  it('sorts names by Unicode code point instead of locale rules', () => {
    const states = {
      '😀': { state: 'later code point' },
      '￿': { state: 'earlier code point' },
    };

    expect(SnapshotService.render(states)).toBe(
      '# 人物实时状态\n\n## ￿\n\n- state: earlier code point\n\n## 😀\n\n- state: later code point\n',
    );
  });
});
