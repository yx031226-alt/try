import { spawn } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { runDemo } from '../../packages/cli/src/demo.js';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

function resolvePnpmEntrypoint(): string {
  const npmExecPath = process.env['npm_execpath'];

  if (npmExecPath !== undefined) {
    return npmExecPath;
  }

  const commandName = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const pathEntries = (process.env['PATH'] ?? '').split(delimiter);

  for (const pathEntry of pathEntries) {
    const commandPath = join(pathEntry, commandName);

    if (!existsSync(commandPath)) {
      continue;
    }

    if (process.platform !== 'win32') {
      return realpathSync(commandPath);
    }

    const commandBody = readFileSync(commandPath, 'utf8');
    const entrypoint = commandBody.match(/"([^"]*pnpm\.(?:cjs|mjs))"/u)?.[1];

    if (entrypoint !== undefined) {
      return resolve(dirname(commandPath), entrypoint.replace('%~dp0', ''));
    }
  }

  throw new Error('PNPM_ENTRYPOINT_NOT_FOUND');
}

function executeDemo(): Promise<{ exitCode: number | null; stderr: string; stdout: string }> {
  const child = spawn(process.execPath, [resolvePnpmEntrypoint(), '--silent', 'demo'], {
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

  it('runs the packaged root demo script without stderr', async () => {
    const result = await executeDemo();

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toBe(runDemo());
  });
});
