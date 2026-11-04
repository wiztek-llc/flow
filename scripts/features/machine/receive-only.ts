/**
 * The projects a machine only receives, listed in its record:
 *
 *   machines/macbook-pro.json   { "name": "macbook-pro", "joined": "2026-10-18", "receiveOnly": ["shop"] }
 *
 * Each entry names a folder under the Flow home's `projects/`. On that machine
 * `flow sync` brings the folder down and never sends it (flow-repo.ts), and
 * every Flow write into it is refused: the ticket store's (tickets/store.ts,
 * tickets/groups.ts), and Claude's Edit and Write (hooks/guard.ts). The
 * records travel, so the refusal names the machines that write the project:
 * each one whose record omits it.
 *
 * The records are read from disk, where the last sync left them as the
 * remote had them.
 */

import fs from 'node:fs';
import path from 'node:path';
import { FlowError } from '../../shared/error.ts';
import { nameOf } from './flow-repo.ts';

const KEY = 'receiveOnly';

type MachineRecord = { name: string; receiveOnly: string[] };

/**
 * Every record on disk, as `{ name, receiveOnly }`. A record that does not
 * parse is skipped, as flow-repo.ts's `records()` skips it: a hand edit should
 * never stop a write on its own.
 */
function records(at): MachineRecord[] {
  let files: string[];
  try {
    files = fs.readdirSync(path.join(at.flow, 'machines')).filter((f) => f.endsWith('.json')).sort();
  } catch {
    return [];
  }
  const found: MachineRecord[] = [];
  for (const file of files) {
    try {
      const record = JSON.parse(fs.readFileSync(path.join(at.flow, 'machines', file), 'utf8'));
      const list = Array.isArray(record[KEY]) ? record[KEY].filter((p) => typeof p === 'string' && p) : [];
      found.push({ name: record.name || file.slice(0, -5), receiveOnly: list });
    } catch {
      // Not a record Flow wrote.
    }
  }
  return found;
}

/** The projects this machine's record lists. */
function listed(at): string[] {
  const name = nameOf(at);
  const mine = records(at).find((r) => r.name === name);
  return mine ? mine.receiveOnly : [];
}

/** The machines that write `project`: every one whose record omits it. */
const writersOf = (at, project: string) => records(at).filter((r) => !r.receiveOnly.includes(project)).map((r) => r.name);

/**
 * `p`'s real path, links resolved, where the part not made yet is kept as
 * written: a new ticket's `app/.flow/tickets/9/ticket.md` resolves through the
 * `.flow` link to the Flow home.
 */
function real(p: string) {
  let at = path.resolve(p);
  const tail: string[] = [];
  for (;;) {
    try {
      return path.join(fs.realpathSync(at), ...tail);
    } catch {
      const up = path.dirname(at);
      if (up === at) return path.resolve(p);
      tail.unshift(path.basename(at));
      at = up;
    }
  }
}

/**
 * The project under `projects/` that `dir` sits in, reached directly or
 * through a project's `.flow` link, where this machine only receives it.
 * Null otherwise. The machine's name is read only when some record lists the
 * project, so a write on a machine that lists none costs no `git` call.
 */
function receivedAt(at, dir: string) {
  const rel = path.relative(path.join(real(at.flow), 'projects'), real(dir));
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  const project = rel.split(path.sep)[0];
  if (!records(at).some((r) => r.receiveOnly.includes(project))) return null;
  return listed(at).includes(project) ? project : null;
}

/** Why a write into `dir` is refused, or null where this machine writes there. */
function refusal(at, dir: string) {
  const project = receivedAt(at, dir);
  if (!project) return null;
  const name = nameOf(at);
  const writers = writersOf(at, project);
  const where = writers.length ? `written on ${writers.join(', ')}` : 'written on no machine: every record lists them';
  return `${project}'s tickets are ${where}. This machine, ${name}, only receives them (machines/${name}.json → ${KEY}).`;
}

/** Throws the refusal where `dir` sits in a project this machine only receives. */
function refuse(at, dir: string) {
  const why = refusal(at, dir);
  if (why) throw new FlowError(why);
}

export { KEY, records, listed, writersOf, receivedAt, refusal, refuse };
