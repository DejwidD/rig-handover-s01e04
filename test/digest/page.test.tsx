import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

const config = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: '',
};

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function runsDir() {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  tempDirs.push(dir);
  return dir;
}

describe('digest page', () => {
  it('renders sorted rows and marks high retries and failures', async () => {
    const dir = runsDir();
    writeFileSync(
      join(dir, '2026-10-28.jsonl'),
      [
        '{"at":"2026-10-28T02:00:00+01:00","job":"z-job","status":"fail","owner":"rook","error":"boom"}',
        '{"at":"2026-10-28T01:00:00+01:00","job":"a-job","status":"retry","owner":null}',
        '{"at":"2026-10-28T01:01:00+01:00","job":"a-job","status":"retry","owner":null}',
        '{"at":"2026-10-28T01:02:00+01:00","job":"a-job","status":"retry","owner":null}',
      ].join('\n'),
    );

    const res = await createApp({ ...config, runsDir: dir }).request('/digest/2026-10-28');
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html.indexOf('a-job')).toBeLessThan(html.indexOf('z-job'));
    expect(html).toContain('high');
    expect(html).toContain('fail');
    expect(html).toContain('—');
    expect(html).not.toContain('<script');
  });

  it('returns 404 when the night is missing', async () => {
    const res = await createApp({ ...config, runsDir: runsDir() }).request('/digest/2026-10-28');

    expect(res.status).toBe(404);
  });

  it('renders nothing ran for an empty night', async () => {
    const dir = runsDir();
    writeFileSync(join(dir, '2026-10-28.jsonl'), '');

    const res = await createApp({ ...config, runsDir: dir }).request('/digest/2026-10-28');

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('renders a night containing a malformed line', async () => {
    const dir = runsDir();
    writeFileSync(
      join(dir, '2026-10-28.jsonl'),
      'not json\n{"at":"2026-10-28T01:00:00+01:00","job":"valid","status":"ok","owner":"rook"}\n',
    );

    const res = await createApp({ ...config, runsDir: dir }).request('/digest/2026-10-28');

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('valid');
  });
});

describe('digest JSON endpoint', () => {
  it('returns the reader rows in sorted order', async () => {
    const dir = runsDir();
    writeFileSync(
      join(dir, '2026-10-28.jsonl'),
      [
        '{"at":"2026-10-28T02:00:00+01:00","job":"z-job","status":"fail","owner":"rook","error":"boom"}',
        '{"at":"2026-10-28T01:00:00+01:00","job":"a-job","status":"retry","owner":null}',
      ].join('\n'),
    );

    const res = await createApp({ ...config, runsDir: dir }).request('/api/digest/2026-10-28');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      {
        job: 'a-job',
        owner: null,
        runs: 1,
        retries: 1,
        status: 'retry',
        error: null,
        firstAt: '2026-10-28T01:00:00+01:00',
        lastAt: '2026-10-28T01:00:00+01:00',
      },
      {
        job: 'z-job',
        owner: 'rook',
        runs: 1,
        retries: 0,
        status: 'fail',
        error: 'boom',
        firstAt: '2026-10-28T02:00:00+01:00',
        lastAt: '2026-10-28T02:00:00+01:00',
      },
    ]);
  });

  it('returns 404 for a missing night and an empty array for an empty night', async () => {
    const dir = runsDir();
    const app = createApp({ ...config, runsDir: dir });

    expect((await app.request('/api/digest/2026-10-28')).status).toBe(404);

    writeFileSync(join(dir, '2026-10-28.jsonl'), '');
    const res = await app.request('/api/digest/2026-10-28');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});
