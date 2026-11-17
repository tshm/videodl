import { expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const worker = join(import.meta.dir, 'index.ts');

type Video = {
  title: string;
  url?: string;
  watched?: boolean;
  error?: string;
};

async function runQueue(
  rows: Record<string, Video>,
  dryRun: boolean,
  removeFailure = '',
  expectedExitCode = 0,
) {
  const dir = await mkdtemp(join(tmpdir(), 'videodl-queue-'));
  const preload = join(dir, 'firebase.ts');
  const result = join(dir, 'result.json');
  const downloader = join(dir, 'yt-dlp');
  try {
    await writeFile(
      preload,
      `import { mock } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
const rows = JSON.parse(process.env.QUEUE_FIXTURE);
process.on('exit', () => writeFileSync(process.env.QUEUE_RESULT, JSON.stringify(rows)));
mock.module('firebase/app', () => ({ initializeApp: () => ({}) }));
mock.module('firebase/database', () => ({
  getDatabase: () => ({}),
  ref: (_, path = '') => path,
  child: (parent, path) => parent + '/' + path,
  get: async () => ({ val: () => rows }),
  remove: async (path) => {
    if (path.split('/')[2] === process.env.QUEUE_REMOVE_FAILURE) throw 'permission denied';
    // Real asynchronous I/O exposes a worker exiting before cleanup finishes.
    await readFile(import.meta.filename);
    delete rows[path.split('/')[2]];
  },
  set: async (path, value) => {
    const [, , id, field] = path.split('/');
    if (id === process.env.QUEUE_REMOVE_FAILURE) throw 'permission denied';
    rows[id][field] = value;
  },
}));
`,
    );
    await writeFile(downloader, '#!/bin/sh\nprintf \'{}\\n\'\n', { mode: 0o755 });
    const proc = Bun.spawnSync(
      [process.execPath, '--preload', preload, worker, dir],
      {
        env: {
          ...process.env,
          DRY_RUN: dryRun ? 'true' : '',
          LIMIT: '1',
          YTDLP: downloader,
          databaseURL: 'https://videodl-test.invalid',
          QUEUE_REMOVE_FAILURE: removeFailure,
          QUEUE_FIXTURE: JSON.stringify(rows),
          QUEUE_RESULT: result,
        },
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'pipe',
      },
    );
    expect(proc.exitCode, proc.stdout.toString() + proc.stderr.toString()).toBe(expectedExitCode);
    return JSON.parse(await readFile(result, 'utf8')) as Record<string, Video>;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('deletes all watched rows despite errors, missing URLs, and the batch limit', async () => {
  const pending = { title: 'pending', url: 'https://example.com/pending' };
  const failed = { title: 'failed', url: 'https://example.com/failed', error: 'failed' };
  const missingUrl = { title: 'missing URL' };
  const rows = await runQueue(
    {
      failed,
      missingUrl,
      pending,
      watched: { title: 'watched', url: 'https://example.com/watched', watched: true },
      watchedError: { title: 'watched error', watched: true, error: 'old failure' },
      watchedNoUrl: { title: 'watched without URL', watched: true },
    },
    true,
  );
  expect(rows).toEqual({ pending, failed, missingUrl });
});

test('removes successful downloads immediately and still limits pending downloads', async () => {
  const second = { title: 'second', url: 'https://example.com/second' };
  const rows = await runQueue(
    {
      first: { title: 'first', url: 'https://example.com/first' },
      second,
    },
    false,
  );
  expect(rows).toEqual({ second });
});

test('waits for other deletions when deletion and error persistence both fail', async () => {
  const undeletable = { title: 'undeletable', watched: true };
  const rows = await runQueue(
    {
      undeletable,
      removable: { title: 'removable', watched: true },
    },
    true,
    'undeletable',
    1,
  );
  expect(rows).toEqual({
    undeletable,
  });
});
