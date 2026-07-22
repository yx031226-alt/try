import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { runDemo } from '../../packages/cli/src/demo.js';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const demoPath = fileURLToPath(new URL('../../packages/cli/src/demo.ts', import.meta.url));
const tsxCliPath = fileURLToPath(
  new URL('../../packages/cli/node_modules/tsx/dist/cli.mjs', import.meta.url),
);

function executeDemo(): Promise<{ exitCode: number | null; stderr: string; stdout: string }> {
  const child = spawn(process.execPath, [tsxCliPath, demoPath], {
    cwd: repositoryRoot,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk: string) => {
    stderr += chunk;
  });

  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (exitCode) => {
      resolve({ exitCode, stderr, stdout });
    });
  });
}

describe('M0 CLI acceptance', () => {
  it('returns a deterministic snapshot through the reusable CLI entrypoint', () => {
    expect(runDemo()).toBe('# 人物实时状态\n\n## hero\n\n- alive: true\n- location: 临江城\n');
  });

  it('runs the CLI demo script without stderr', async () => {
    const result = await executeDemo();

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('# 人物实时状态');
    expect(result.stdout).toContain('## hero');
    expect(result.stdout).toContain('- alive: true');
    expect(result.stdout).toContain('- location: 临江城');
  });
});
