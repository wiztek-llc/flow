/** `guard` on a project this machine only receives: an Edit or Write there is denied, naming the machine that writes it. */

import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { run } from '../../../shared/testing.ts';
import { world } from '../guard-world.ts';

test('an Edit or Write into a project this machine only receives is denied, naming the machine that writes it', () => {
  const w = world('guard-receive-only');
  const flowHome = path.join(w.home, '.flow');
  const kept = path.join(flowHome, 'projects', 'app');
  fs.mkdirSync(path.join(kept, 'tickets', '1'), { recursive: true });
  fs.writeFileSync(path.join(kept, 'tickets', '1', 'ticket.md'), 'x\n');
  fs.mkdirSync(path.join(flowHome, 'machines'), { recursive: true });
  fs.writeFileSync(path.join(flowHome, 'machines', 'laptop.json'), JSON.stringify({ name: 'laptop', joined: '2026-11-04', receiveOnly: ['app'] }));
  fs.writeFileSync(path.join(flowHome, 'machines', 'server.json'), JSON.stringify({ name: 'server', joined: '2026-11-04' }));
  spawnSync('git', ['init', '-q', flowHome]);
  spawnSync('git', ['-C', flowHome, 'config', 'flow.machine', 'laptop']);
  fs.symlinkSync(kept, path.join(w.dir, '.flow'));
  const words = "app's tickets are written on server. This machine, laptop, only receives them (machines/laptop.json → receiveOnly).";
  const decide = (tool: string, file: string) => {
    const input = JSON.stringify({ tool_name: tool, tool_input: { file_path: file }, cwd: w.dir });
    const env = { ...process.env, HOME: w.home, FLOW_HOME: flowHome, CLAUDE_PROJECT_DIR: w.dir };
    const result = run('hooks/guard.ts', [], { input, env });
    return result.stdout.trim() ? JSON.parse(result.stdout).hookSpecificOutput : null;
  };

  for (const tool of ['Edit', 'Write']) {
    for (const file of [path.join(kept, 'tickets', '1', 'ticket.md'), '.flow/tickets/1/ticket.md', '.flow/tickets/2/ticket.md']) {
      const out = decide(tool, file);
      assert.strictEqual(out?.permissionDecision, 'deny', `${tool} ${file}`);
      assert.strictEqual(out.permissionDecisionReason, words);
    }
    for (const file of [path.join(flowHome, 'projects', 'other', 'x.md'), path.join(flowHome, 'CLAUDE.md'), 'src/clean.js']) {
      assert.strictEqual(decide(tool, file), null, `${tool} ${file}`);
    }
  }
});
