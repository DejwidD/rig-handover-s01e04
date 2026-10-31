import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNightWithStats } from './digest/reader.js';
import type { DigestStatus } from './digest/types.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type NightCounts = Record<DigestStatus, number>;

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: string[];
  nightCounts: Record<string, NightCounts>;
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  const nights = nightsOnDisk(config.runsDir);

  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights,
    nightCounts: Object.fromEntries(nights.map((night) => [night, countsFor(config.runsDir, night)])),
  };
}

function countsFor(runsDir: string, night: string): NightCounts {
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  for (const row of readNightWithStats(runsDir, night).rows) counts[row.status] += 1;
  return counts;
}
