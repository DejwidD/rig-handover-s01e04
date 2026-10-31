import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, DigestStatus } from './types.js';

type RunRecord = {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error?: string;
};

type MutableRow = DigestRow;

export type NightRead = {
  rows: DigestRow[];
  malformed: number;
};

function isRunRecord(value: unknown): value is RunRecord {
  if (typeof value !== 'object' || value === null) return false;

  const record = value as Record<string, unknown>;
  return (
    typeof record.at === 'string' &&
    typeof record.job === 'string' &&
    (record.status === 'ok' || record.status === 'retry' || record.status === 'fail') &&
    (typeof record.owner === 'string' || record.owner === null) &&
    (record.error === undefined || typeof record.error === 'string')
  );
}

function rowFrom(record: RunRecord): MutableRow {
  return {
    job: record.job,
    owner: record.owner,
    runs: 1,
    retries: record.status === 'retry' ? 1 : 0,
    status: record.status,
    error: record.error ?? null,
    firstAt: record.at,
    lastAt: record.at,
  };
}

export function readNightWithStats(runsDir: string, night: string): NightRead {
  const contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  const rows = new Map<string, MutableRow>();
  let malformed = 0;

  for (const line of contents.split(/\r?\n/)) {
    if (line.trim() === '') continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch {
      malformed += 1;
      continue;
    }

    if (!isRunRecord(parsed)) {
      malformed += 1;
      continue;
    }

    const existing = rows.get(parsed.job);
    if (existing === undefined) {
      rows.set(parsed.job, rowFrom(parsed));
      continue;
    }

    existing.runs += 1;
    if (parsed.status === 'retry') existing.retries += 1;
    existing.status = parsed.status;
    if (parsed.error !== undefined) existing.error = parsed.error;
    existing.lastAt = parsed.at;
    if (existing.owner !== parsed.owner) existing.owner = parsed.owner;
  }

  return { rows: [...rows.values()].sort((a, b) => a.job.localeCompare(b.job)), malformed };
}

export function readNight(runsDir: string, night: string): DigestRow[] {
  return readNightWithStats(runsDir, night).rows;
}
