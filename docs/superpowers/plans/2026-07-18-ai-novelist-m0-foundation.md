# AI 智能小说家 M0 工程底座实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可测试的 TypeScript 工程底座，并打通“变更提案 → 作者批准 → SQLite 事件入账 → 人物状态投影 → 快照导出”的最小纵向闭环。

**Architecture:** 使用 pnpm workspace 管理小型单体仓库；`contracts` 只定义稳定协议，`core` 实现事件账本、审批和投影，`cli` 提供首个可运行入口。事件账本是唯一事实来源，状态投影和快照均可由事件重建。

**Tech Stack:** Node.js 24、TypeScript、pnpm、Zod、better-sqlite3、Vitest、tsx、ESLint、Prettier

---

## 0. 范围说明

完整 PRD 包含创作记忆、关系伏笔、九个 Skill、多模型和桌面后台等多个独立子系统。本计划只实现 M0 基础纵向切片，完成后再分别编写：

1. M1 创作记忆六大台账计划。
2. M2 人物关系与伏笔核心 Skill 计划。
3. M3 八个流程 Skill 与模型适配计划。
4. M4 桌面后台计划。
5. M5 一卷实战与质量加固计划。

本计划不实现 Electron 界面、模型调用或完整人物字段；它先验证后续所有模块依赖的事件、审批、回放和导出机制。

## 1. 文件结构

```text
.
├─ package.json                       # 根命令与开发工具
├─ pnpm-workspace.yaml                # workspace 包范围
├─ tsconfig.base.json                 # 共享 TypeScript 配置
├─ eslint.config.mjs                  # 共享静态检查配置
├─ .prettierrc.json                   # 共享格式规则
├─ .gitignore                         # 忽略依赖、构建、数据库和临时快照
├─ packages/
│  ├─ contracts/
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  ├─ src/event.ts                 # 事件与提案协议
│  │  ├─ src/index.ts                 # 协议出口
│  │  └─ test/event.test.ts           # 协议解析测试
│  ├─ core/
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  ├─ src/event-store.ts           # 事件账本接口
│  │  ├─ src/sqlite-event-store.ts    # SQLite 实现与迁移
│  │  ├─ src/approval-service.ts      # 批准并原子入账
│  │  ├─ src/character-projection.ts  # 最小人物状态投影
│  │  ├─ src/snapshot-service.ts      # Markdown/YAML 快照导出
│  │  ├─ src/index.ts                 # 核心出口
│  │  └─ test/*.test.ts               # 核心测试
│  └─ cli/
│     ├─ package.json
│     ├─ tsconfig.json
│     └─ src/demo.ts                  # 可运行纵向切片
└─ test/acceptance/m0.test.ts         # M0 端到端验收
```

## Task 1：建立可重复运行的 TypeScript workspace

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `eslint.config.mjs`
- Create: `.prettierrc.json`
- Create: `.gitignore`
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`

- [ ] **Step 1：写根工作区清单**

创建 `package.json`：

```json
{
  "name": "ai-novelist",
  "private": true,
  "packageManager": "pnpm@11.9.0",
  "scripts": {
    "typecheck": "pnpm -r typecheck",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "format:check": "prettier --check .",
    "verify": "pnpm typecheck && pnpm lint && pnpm format:check && pnpm test",
    "demo": "pnpm --filter @ai-novelist/cli demo"
  },
  "devDependencies": {
    "@ai-novelist/contracts": "workspace:*",
    "@ai-novelist/core": "workspace:*",
    "@eslint/js": "latest",
    "@types/better-sqlite3": "latest",
    "@types/node": "latest",
    "better-sqlite3": "latest",
    "eslint": "latest",
    "prettier": "latest",
    "tsx": "latest",
    "typescript": "latest",
    "typescript-eslint": "latest",
    "vitest": "latest"
  }
}
```

- [ ] **Step 2：写 workspace 和 TypeScript 配置**

创建 `pnpm-workspace.yaml`：

```yaml
packages:
  - packages/*
```

创建 `tsconfig.base.json`：

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true
  }
}
```

- [ ] **Step 3：写质量工具配置**

创建 `eslint.config.mjs`：

```js
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/*.db', '**/snapshots/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
);
```

创建 `.prettierrc.json`：

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

创建 `.gitignore`：

```gitignore
node_modules/
dist/
coverage/
*.db
*.db-shm
*.db-wal
snapshots/
.env
.env.*
!.env.example
```

- [ ] **Step 4：写三个包清单**

`packages/contracts/package.json`：

```json
{
  "name": "@ai-novelist/contracts",
  "version": "0.1.0",
  "type": "module",
  "exports": "./src/index.ts",
  "scripts": { "typecheck": "tsc --noEmit -p tsconfig.json" },
  "dependencies": { "zod": "latest" }
}
```

`packages/core/package.json`：

```json
{
  "name": "@ai-novelist/core",
  "version": "0.1.0",
  "type": "module",
  "exports": "./src/index.ts",
  "scripts": { "typecheck": "tsc --noEmit -p tsconfig.json" },
  "dependencies": {
    "@ai-novelist/contracts": "workspace:*",
    "better-sqlite3": "latest"
  },
  "devDependencies": { "@types/better-sqlite3": "latest" }
}
```

`packages/cli/package.json`：

```json
{
  "name": "@ai-novelist/cli",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "demo": "tsx src/demo.ts"
  },
  "dependencies": {
    "@ai-novelist/contracts": "workspace:*",
    "@ai-novelist/core": "workspace:*"
  }
}
```

为三个包分别创建 `tsconfig.json`。`packages/contracts/tsconfig.json`：

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

`packages/core/tsconfig.json`：

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

`packages/cli/tsconfig.json`：

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 5：安装并验证基础环境**

Run: `pnpm install`

Expected: 命令成功，生成 `pnpm-lock.yaml`，三个 workspace 包被识别。

Run: `pnpm exec tsc --version`

Expected: 输出 TypeScript 版本且退出码为 0。

- [ ] **Step 6：提交工程底座**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json eslint.config.mjs .prettierrc.json .gitignore packages
git commit -m "build: initialize TypeScript workspace"
```

## Task 2：定义可版本化的事件与提案协议

**Files:**
- Create: `packages/contracts/src/event.ts`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/test/event.test.ts`

- [ ] **Step 1：先写协议失败测试**

创建 `packages/contracts/test/event.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { ChangeProposalSchema, EventEnvelopeSchema } from '../src/index.js';

describe('event contracts', () => {
  it('rejects an approved event without an approval record', () => {
    const result = EventEnvelopeSchema.safeParse({
      eventId: 'evt-1',
      schemaVersion: 1,
      workId: 'work-1',
      eventType: 'character.state.changed',
      occurredAt: '2026-07-18T12:00:00.000Z',
      actor: { kind: 'author', id: 'local-author' },
      payload: { characterId: 'char-1', patch: { location: '临江城' } },
    });

    expect(result.success).toBe(false);
  });

  it('accepts a pending proposal without mutating official state', () => {
    const result = ChangeProposalSchema.parse({
      proposalId: 'proposal-1',
      schemaVersion: 1,
      workId: 'work-1',
      eventType: 'character.state.changed',
      createdAt: '2026-07-18T12:00:00.000Z',
      createdBy: { kind: 'skill', id: 'prose', version: '0.1.0' },
      payload: { characterId: 'char-1', patch: { location: '临江城' } },
      status: 'pending',
    });

    expect(result.status).toBe('pending');
  });
});
```

- [ ] **Step 2：运行测试并确认失败**

Run: `pnpm test packages/contracts/test/event.test.ts`

Expected: FAIL，提示 `../src/index.js` 或对应导出不存在。

- [ ] **Step 3：实现最小协议**

创建 `packages/contracts/src/event.ts`：

```ts
import { z } from 'zod';

export const ActorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('author'), id: z.string().min(1) }),
  z.object({ kind: z.literal('system'), id: z.string().min(1) }),
  z.object({
    kind: z.literal('skill'),
    id: z.string().min(1),
    version: z.string().min(1),
  }),
]);

export const ChangeProposalSchema = z.object({
  proposalId: z.string().min(1),
  schemaVersion: z.literal(1),
  workId: z.string().min(1),
  eventType: z.string().min(1),
  createdAt: z.string().datetime(),
  createdBy: ActorSchema,
  payload: z.record(z.string(), z.unknown()),
  status: z.enum(['pending', 'rejected', 'approved']),
});

export const ApprovalSchema = z.object({
  approvedBy: z.string().min(1),
  approvedAt: z.string().datetime(),
  reason: z.string().min(1),
});

export const EventEnvelopeSchema = z.object({
  eventId: z.string().min(1),
  schemaVersion: z.literal(1),
  workId: z.string().min(1),
  eventType: z.string().min(1),
  occurredAt: z.string().datetime(),
  actor: ActorSchema,
  proposalId: z.string().min(1),
  approval: ApprovalSchema,
  payload: z.record(z.string(), z.unknown()),
});

export type ChangeProposal = z.infer<typeof ChangeProposalSchema>;
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
```

创建 `packages/contracts/src/index.ts`：

```ts
export * from './event.js';
```

- [ ] **Step 4：运行协议测试**

Run: `pnpm test packages/contracts/test/event.test.ts`

Expected: 2 tests PASS。

- [ ] **Step 5：提交协议**

```bash
git add packages/contracts
git commit -m "feat: define versioned proposal and event contracts"
```

## Task 3：实现幂等、只追加的 SQLite 事件账本

**Files:**
- Create: `packages/core/src/event-store.ts`
- Create: `packages/core/src/sqlite-event-store.ts`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/test/sqlite-event-store.test.ts`

- [ ] **Step 1：写失败测试**

创建 `packages/core/test/sqlite-event-store.test.ts`：

```ts
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import type { EventEnvelope } from '@ai-novelist/contracts';
import { SqliteEventStore } from '../src/index.js';

const event: EventEnvelope = {
  eventId: 'evt-1',
  schemaVersion: 1,
  workId: 'work-1',
  eventType: 'character.state.changed',
  occurredAt: '2026-07-18T12:00:00.000Z',
  actor: { kind: 'author', id: 'local-author' },
  proposalId: 'proposal-1',
  approval: {
    approvedBy: 'local-author',
    approvedAt: '2026-07-18T12:00:00.000Z',
    reason: '确认章节变化',
  },
  payload: { characterId: 'char-1', patch: { location: '临江城' } },
};

describe('SqliteEventStore', () => {
  it('appends once and treats a repeated event id as idempotent', () => {
    const store = new SqliteEventStore(new Database(':memory:'));
    expect(store.append(event)).toBe('appended');
    expect(store.append(event)).toBe('duplicate');
    expect(store.readAll('work-1')).toEqual([event]);
  });

  it('rejects reuse of an event id with different content', () => {
    const store = new SqliteEventStore(new Database(':memory:'));
    store.append(event);
    expect(() =>
      store.append({ ...event, payload: { characterId: 'char-2' } }),
    ).toThrow('EVENT_ID_CONFLICT');
  });

  it('rejects committing the same proposal under a new event id', () => {
    const store = new SqliteEventStore(new Database(':memory:'));
    store.append(event);
    expect(() => store.append({ ...event, eventId: 'evt-2' })).toThrow(
      'PROPOSAL_ALREADY_COMMITTED',
    );
  });
});
```

- [ ] **Step 2：运行测试并确认失败**

Run: `pnpm test packages/core/test/sqlite-event-store.test.ts`

Expected: FAIL，提示 `SqliteEventStore` 不存在。

- [ ] **Step 3：定义事件账本接口**

创建 `packages/core/src/event-store.ts`：

```ts
import type { EventEnvelope } from '@ai-novelist/contracts';

export interface EventStore {
  append(event: EventEnvelope): 'appended' | 'duplicate';
  readAll(workId: string): EventEnvelope[];
}
```

- [ ] **Step 4：实现 SQLite 账本**

创建 `packages/core/src/sqlite-event-store.ts`：

```ts
import type Database from 'better-sqlite3';
import { EventEnvelopeSchema, type EventEnvelope } from '@ai-novelist/contracts';
import type { EventStore } from './event-store.js';

export class SqliteEventStore implements EventStore {
  constructor(private readonly db: Database.Database) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL UNIQUE,
        proposal_id TEXT NOT NULL UNIQUE,
        work_id TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        body TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_work_sequence
      ON events(work_id, sequence);
    `);
  }

  append(event: EventEnvelope): 'appended' | 'duplicate' {
    const parsed = EventEnvelopeSchema.parse(event);
    const body = JSON.stringify(parsed);
    const existing = this.db
      .prepare('SELECT body FROM events WHERE event_id = ?')
      .get(parsed.eventId) as { body: string } | undefined;

    if (existing) {
      if (existing.body !== body) throw new Error('EVENT_ID_CONFLICT');
      return 'duplicate';
    }

    const committedProposal = this.db
      .prepare('SELECT event_id FROM events WHERE proposal_id = ?')
      .get(parsed.proposalId) as { event_id: string } | undefined;
    if (committedProposal) throw new Error('PROPOSAL_ALREADY_COMMITTED');

    this.db
      .prepare(
        'INSERT INTO events(event_id, proposal_id, work_id, occurred_at, body) VALUES (?, ?, ?, ?, ?)',
      )
      .run(parsed.eventId, parsed.proposalId, parsed.workId, parsed.occurredAt, body);
    return 'appended';
  }

  readAll(workId: string): EventEnvelope[] {
    const rows = this.db
      .prepare('SELECT body FROM events WHERE work_id = ? ORDER BY sequence')
      .all(workId) as Array<{ body: string }>;
    return rows.map((row) => EventEnvelopeSchema.parse(JSON.parse(row.body)));
  }
}
```

创建 `packages/core/src/index.ts`：

```ts
export * from './event-store.js';
export * from './sqlite-event-store.js';
```

- [ ] **Step 5：运行测试并提交**

Run: `pnpm test packages/core/test/sqlite-event-store.test.ts`

Expected: 3 tests PASS。

```bash
git add packages/core
git commit -m "feat: add idempotent SQLite event store"
```

## Task 4：实现批准入账和人物状态投影

**Files:**
- Create: `packages/core/src/approval-service.ts`
- Create: `packages/core/src/character-projection.ts`
- Modify: `packages/core/src/index.ts`
- Create: `packages/core/test/approval-projection.test.ts`

- [ ] **Step 1：写失败测试**

创建 `packages/core/test/approval-projection.test.ts`：

```ts
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import type { ChangeProposal } from '@ai-novelist/contracts';
import {
  ApprovalService,
  CharacterProjection,
  SqliteEventStore,
} from '../src/index.js';

const proposal: ChangeProposal = {
  proposalId: 'proposal-1',
  schemaVersion: 1,
  workId: 'work-1',
  eventType: 'character.state.changed',
  createdAt: '2026-07-18T12:00:00.000Z',
  createdBy: { kind: 'skill', id: 'prose', version: '0.1.0' },
  payload: { characterId: 'char-1', patch: { location: '临江城', alive: true } },
  status: 'pending',
};

describe('approval and projection', () => {
  it('does not change official state before approval', () => {
    const store = new SqliteEventStore(new Database(':memory:'));
    expect(new CharacterProjection().rebuild(store.readAll('work-1'))).toEqual({});
  });

  it('creates one official event and rebuilds character state', () => {
    const store = new SqliteEventStore(new Database(':memory:'));
    const service = new ApprovalService(store, () => 'evt-1');
    service.approve(proposal, {
      approvedBy: 'local-author',
      approvedAt: '2026-07-18T12:01:00.000Z',
      reason: '确认第一章状态',
    });

    expect(new CharacterProjection().rebuild(store.readAll('work-1'))).toEqual({
      'char-1': { location: '临江城', alive: true },
    });
  });
});
```

- [ ] **Step 2：运行测试并确认失败**

Run: `pnpm test packages/core/test/approval-projection.test.ts`

Expected: FAIL，提示 `ApprovalService` 或 `CharacterProjection` 不存在。

- [ ] **Step 3：实现批准服务**

创建 `packages/core/src/approval-service.ts`：

```ts
import {
  ApprovalSchema,
  type ChangeProposal,
  type EventEnvelope,
} from '@ai-novelist/contracts';
import type { EventStore } from './event-store.js';

type Approval = EventEnvelope['approval'];

export class ApprovalService {
  constructor(
    private readonly events: EventStore,
    private readonly nextEventId: () => string,
  ) {}

  approve(proposal: ChangeProposal, approvalInput: Approval): EventEnvelope {
    if (proposal.status !== 'pending') throw new Error('PROPOSAL_NOT_PENDING');
    const approval = ApprovalSchema.parse(approvalInput);
    const event: EventEnvelope = {
      eventId: this.nextEventId(),
      schemaVersion: 1,
      workId: proposal.workId,
      eventType: proposal.eventType,
      occurredAt: approval.approvedAt,
      actor: { kind: 'author', id: approval.approvedBy },
      proposalId: proposal.proposalId,
      approval,
      payload: proposal.payload,
    };
    this.events.append(event);
    return event;
  }
}
```

- [ ] **Step 4：实现可重建的人物状态投影**

创建 `packages/core/src/character-projection.ts`：

```ts
import type { EventEnvelope } from '@ai-novelist/contracts';

export type CharacterState = Record<string, unknown>;
export type CharacterStates = Record<string, CharacterState>;

export class CharacterProjection {
  rebuild(events: EventEnvelope[]): CharacterStates {
    return events.reduce<CharacterStates>((states, event) => {
      if (event.eventType !== 'character.state.changed') return states;
      const characterId = event.payload.characterId;
      const patch = event.payload.patch;
      if (typeof characterId !== 'string' || typeof patch !== 'object' || patch === null) {
        throw new Error('INVALID_CHARACTER_STATE_EVENT');
      }
      states[characterId] = { ...states[characterId], ...patch };
      return states;
    }, {});
  }
}
```

将 `packages/core/src/index.ts` 改为：

```ts
export * from './approval-service.js';
export * from './character-projection.js';
export * from './event-store.js';
export * from './sqlite-event-store.js';
```

- [ ] **Step 5：运行测试并提交**

Run: `pnpm test packages/core/test/approval-projection.test.ts`

Expected: 2 tests PASS。

```bash
git add packages/core
git commit -m "feat: approve proposals and rebuild character state"
```

## Task 5：实现可重复生成的项目快照

**Files:**
- Create: `packages/core/src/snapshot-service.ts`
- Modify: `packages/core/src/index.ts`
- Create: `packages/core/test/snapshot-service.test.ts`

- [ ] **Step 1：写失败测试**

创建 `packages/core/test/snapshot-service.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { SnapshotService } from '../src/index.js';

describe('SnapshotService', () => {
  it('sorts character ids so the same state has stable output', () => {
    const snapshot = new SnapshotService().renderCharacterState({
      'char-2': { location: '北境' },
      'char-1': { location: '临江城', alive: true },
    });

    expect(snapshot).toBe(
      '# 人物实时状态\n\n' +
        '## char-1\n\n' +
        '- alive: true\n' +
        '- location: 临江城\n\n' +
        '## char-2\n\n' +
        '- location: 北境\n',
    );
  });
});
```

- [ ] **Step 2：运行测试并确认失败**

Run: `pnpm test packages/core/test/snapshot-service.test.ts`

Expected: FAIL，提示 `SnapshotService` 不存在。

- [ ] **Step 3：实现稳定快照渲染**

创建 `packages/core/src/snapshot-service.ts`：

```ts
import type { CharacterStates } from './character-projection.js';

export class SnapshotService {
  renderCharacterState(states: CharacterStates): string {
    const sections = Object.keys(states)
      .sort()
      .map((characterId) => {
        const fields = Object.entries(states[characterId] ?? {})
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, value]) => `- ${key}: ${String(value)}`)
          .join('\n');
        return `## ${characterId}\n\n${fields}`;
      });
    return `# 人物实时状态\n\n${sections.join('\n\n')}\n`;
  }
}
```

将 `packages/core/src/index.ts` 增加：

```ts
export * from './snapshot-service.js';
```

- [ ] **Step 4：运行测试并提交**

Run: `pnpm test packages/core/test/snapshot-service.test.ts`

Expected: 1 test PASS。

```bash
git add packages/core
git commit -m "feat: render deterministic character snapshots"
```

## Task 6：打通 CLI 演示与 M0 端到端验收

**Files:**
- Create: `packages/cli/src/demo.ts`
- Create: `test/acceptance/m0.test.ts`

- [ ] **Step 1：写端到端失败测试**

创建 `test/acceptance/m0.test.ts`：

```ts
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import type { ChangeProposal } from '@ai-novelist/contracts';
import {
  ApprovalService,
  CharacterProjection,
  SnapshotService,
  SqliteEventStore,
} from '@ai-novelist/core';

describe('M0 acceptance', () => {
  it('approves, stores, replays, and exports one change', () => {
    const store = new SqliteEventStore(new Database(':memory:'));
    const proposal: ChangeProposal = {
      proposalId: 'proposal-1',
      schemaVersion: 1,
      workId: 'work-1',
      eventType: 'character.state.changed',
      createdAt: '2026-07-18T12:00:00.000Z',
      createdBy: { kind: 'skill', id: 'prose', version: '0.1.0' },
      payload: { characterId: 'char-1', patch: { location: '临江城' } },
      status: 'pending',
    };

    new ApprovalService(store, () => 'evt-1').approve(proposal, {
      approvedBy: 'local-author',
      approvedAt: '2026-07-18T12:01:00.000Z',
      reason: '验收纵向闭环',
    });

    const state = new CharacterProjection().rebuild(store.readAll('work-1'));
    expect(new SnapshotService().renderCharacterState(state)).toContain(
      '- location: 临江城',
    );
  });
});
```

- [ ] **Step 2：运行验收测试并确认当前失败原因**

Run: `pnpm test test/acceptance/m0.test.ts`

Expected: 如果 workspace 测试别名尚未被 Vitest 正确解析，测试 FAIL 并指出无法解析包；若前序包已经可由 workspace 解析，则测试 PASS，可直接进入 Step 3。不得通过复制核心代码到测试目录规避解析问题。

- [ ] **Step 3：实现可运行演示入口**

创建 `packages/cli/src/demo.ts`：

```ts
import Database from 'better-sqlite3';
import type { ChangeProposal } from '@ai-novelist/contracts';
import {
  ApprovalService,
  CharacterProjection,
  SnapshotService,
  SqliteEventStore,
} from '@ai-novelist/core';

const store = new SqliteEventStore(new Database(':memory:'));
const proposal: ChangeProposal = {
  proposalId: 'proposal-demo',
  schemaVersion: 1,
  workId: 'work-demo',
  eventType: 'character.state.changed',
  createdAt: new Date().toISOString(),
  createdBy: { kind: 'skill', id: 'prose', version: '0.1.0' },
  payload: { characterId: 'hero', patch: { location: '临江城', alive: true } },
  status: 'pending',
};

new ApprovalService(store, () => 'evt-demo').approve(proposal, {
  approvedBy: 'local-author',
  approvedAt: new Date().toISOString(),
  reason: '运行 M0 演示',
});

const states = new CharacterProjection().rebuild(store.readAll('work-demo'));
process.stdout.write(new SnapshotService().renderCharacterState(states));
```

- [ ] **Step 4：运行完整质量门禁**

Run: `pnpm verify`

Expected: typecheck、lint、format check 和全部测试均退出码 0。

Run: `pnpm demo`

Expected: 输出包含 `# 人物实时状态`、`## hero`、`- alive: true` 和 `- location: 临江城`。

- [ ] **Step 5：执行事件回放验证**

在 `packages/core/test/approval-projection.test.ts` 增加以下测试：

```ts
it('rebuilds the same state when events are replayed again', () => {
  const store = new SqliteEventStore(new Database(':memory:'));
  const service = new ApprovalService(store, () => 'evt-1');
  service.approve(proposal, {
    approvedBy: 'local-author',
    approvedAt: '2026-07-18T12:01:00.000Z',
    reason: '验证重复回放',
  });
  const events = store.readAll('work-1');
  const projection = new CharacterProjection();
  expect(projection.rebuild(events)).toEqual(projection.rebuild(events));
});
```

Run: `pnpm test packages/core/test/approval-projection.test.ts`

Expected: 3 tests PASS。

- [ ] **Step 6：提交 M0 纵向切片**

```bash
git add packages/cli test packages/core/test
git commit -m "feat: complete M0 event ledger vertical slice"
```

## 2. M0 完成定义

只有同时满足以下条件，M0 才可标记完成：

- `pnpm verify` 全部通过。
- 提案在批准前不改变正式状态。
- 批准后产生且只产生一个正式事件。
- 相同事件重复提交是幂等的，不同内容复用编号会被拒绝。
- 人物状态能够仅由事件账本重建。
- 相同状态总能生成字节稳定的 Markdown 快照。
- `pnpm demo` 可展示完整纵向闭环。
- 代码和测试按任务形成独立 Git 提交。

## 3. 后续计划触发条件

M0 通过后，再编写 M1 创作记忆计划。M1 必须复用本计划的事件协议，并在新增事件类型时提供 Schema 版本、迁移、回放、幂等和快照测试，不得绕过 `EventStore` 直接修改正式状态。
