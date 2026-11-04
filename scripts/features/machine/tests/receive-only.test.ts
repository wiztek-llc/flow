/**
 * `features/machine/receive-only.ts`: the projects a machine only receives,
 * read from the machine records, and the words refusing a write into one.
 * The sync's side is in commands/tests/sync.test.ts, the guard's in
 * features/guard/tests/guard-receive-only.test.ts.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { project } from '../../../shared/testing.ts';
import * as receiveOnly from '../receive-only.ts';
import * as repo from '../flow-repo.ts';
import * as store from '../../tickets/store.ts';
import * as groups from '../../tickets/groups.ts';
import { git } from '../../../shared/git.ts';
import { folders } from '../../../shared/paths.ts';

/**
 * A Flow home on machine `name`, holding one record per entry of `records`:
 * `{ laptop: ['shop'], server: null }`, null being a record with no list.
 */
function home(dirName: string, name: string, records: { [machine: string]: string[] | null }) {
  const dir = project(dirName);
  const at = folders(path.join(dir, 'root'));
  fs.mkdirSync(path.join(at.flow, 'machines'), { recursive: true });
  git(at.flow, ['init', '-q', '-b', 'main']);
  git(at.flow, ['config', 'flow.machine', name]);
  for (const [machine, list] of Object.entries(records)) {
    const record = { name: machine, joined: '2026-11-04', ...(list ? { receiveOnly: list } : {}) };
    fs.writeFileSync(path.join(at.flow, 'machines', `${machine}.json`), JSON.stringify(record, null, 2) + '\n');
  }
  return { dir, at };
}

test('each machine reads its own list, and a project\'s writers are the machines whose records omit it', () => {
  const { at } = home('receive-lists', 'laptop', { laptop: ['shop'], phone: ['shop', 'blog'], server: null });
  fs.writeFileSync(path.join(at.flow, 'machines', 'broken.json'), 'not json\n');

  assert.deepStrictEqual(receiveOnly.listed(at), ['shop']);
  assert.deepStrictEqual(receiveOnly.writersOf(at, 'shop'), ['server'], 'the record that does not parse is skipped');
  assert.deepStrictEqual(receiveOnly.writersOf(at, 'blog'), ['laptop', 'server']);
  assert.deepStrictEqual(receiveOnly.listed(home('receive-no-record', 'desk', { laptop: ['shop'] }).at), [],
    'a machine with no record receives nothing only');
});

test('a write into a received project is refused naming its writer, reached directly, through a link, or not made yet', () => {
  const { dir, at } = home('receive-paths', 'laptop', { laptop: ['shop'], server: null });
  const shop = path.join(at.flow, 'projects', 'shop');
  fs.mkdirSync(path.join(shop, 'tickets', '3'), { recursive: true });
  fs.mkdirSync(path.join(at.flow, 'projects', 'shopping'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'app'), { recursive: true });
  fs.symlinkSync(shop, path.join(dir, 'app', '.flow'));
  const words = "shop's tickets are written on server. This machine, laptop, only receives them (machines/laptop.json → receiveOnly).";

  for (const p of [
    shop,
    path.join(shop, 'tickets', '3'),
    path.join(dir, 'app', '.flow'),
    path.join(dir, 'app', '.flow', 'tickets', '3', 'ticket.md'),
    path.join(dir, 'app', '.flow', 'tickets', '9', 'ticket.md'),
  ]) assert.strictEqual(receiveOnly.refusal(at, p), words, p);
  assert.throws(() => receiveOnly.refuse(at, shop), { message: words });

  for (const p of [
    path.join(at.flow, 'projects'),
    path.join(at.flow, 'projects', 'shopping', 'x.md'),
    path.join(at.flow, 'projects', 'blog', 'x.md'),
    path.join(at.flow, 'tickets', '1', 'ticket.md'),
    path.join(dir, 'app', 'src', 'x.js'),
  ]) assert.strictEqual(receiveOnly.refusal(at, p), null, p);
  assert.doesNotThrow(() => receiveOnly.refuse(at, path.join(at.flow, 'tickets', '1')));
});

test('the ticket store and the group cards write nothing into a received project', () => {
  const { dir, at } = home('receive-store', 'laptop', { laptop: ['shop'], server: null });
  const shop = path.join(at.flow, 'projects', 'shop');
  fs.mkdirSync(shop, { recursive: true });
  fs.mkdirSync(path.join(dir, 'app'), { recursive: true });
  fs.symlinkSync(shop, path.join(dir, 'app', '.flow'));
  const words = /^shop's tickets are written on server\. This machine, laptop, only receives them/;
  const had = process.env.FLOW_HOME;
  process.env.FLOW_HOME = at.flow;
  try {
    assert.throws(() => store.createTicket(path.join(dir, 'app'), { title: 'login-page' }), { message: words });
    assert.throws(() => groups.writeGroup(groups.card(shop, 'later', { title: 'later', rank: '', parked: '', group_by: '' })), { message: words });
    assert.deepStrictEqual(fs.readdirSync(shop), [], 'nothing written');
    const own = store.createTicket(at.flow, { title: 'dark-mode' });
    assert.strictEqual(own.id, 'home-1', 'the Flow home\'s own tickets are written as ever');
  } finally {
    if (had === undefined) delete process.env.FLOW_HOME;
    else process.env.FLOW_HOME = had;
  }
});

test('a project every record lists has no writer, and the refusal says so', () => {
  const { at } = home('receive-no-writer', 'laptop', { laptop: ['shop'], server: ['shop'] });
  assert.strictEqual(receiveOnly.refusal(at, path.join(at.flow, 'projects', 'shop')),
    "shop's tickets are written on no machine: every record lists them. This machine, laptop, only receives them (machines/laptop.json → receiveOnly).");
});

test('writing the machine record keeps its list', () => {
  const { at } = home('receive-record', 'laptop', { laptop: ['shop'] });
  repo.writeRecord(at);
  const kept = JSON.parse(fs.readFileSync(path.join(at.flow, 'machines', 'laptop.json'), 'utf8'));
  assert.deepStrictEqual(kept, { name: 'laptop', joined: '2026-11-04', receiveOnly: ['shop'] });
  assert.deepStrictEqual(Object.keys(kept), ['name', 'joined', 'receiveOnly']);
});
