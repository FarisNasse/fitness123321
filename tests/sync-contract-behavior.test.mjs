import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

import { latestSyncTimestamp, shouldApplyRemoteRow } from '../src/lib/sync-conflict.mjs';

test('pending and failed local rows win over remote hydration', () => {
  const remote = '2026-08-09T20:00:00.000Z';
  assert.equal(shouldApplyRemoteRow(null, remote), true);
  assert.equal(shouldApplyRemoteRow({ sync_status: 'pending', updated_at: '2026-01-01T00:00:00Z' }, remote), false);
  assert.equal(shouldApplyRemoteRow({ sync_status: 'failed', updated_at: '2026-01-01T00:00:00Z' }, remote), false);
  assert.equal(shouldApplyRemoteRow({ sync_status: 'synced', updated_at: '2026-08-09T19:00:00Z' }, remote), true);
  assert.equal(shouldApplyRemoteRow({ sync_status: 'synced', updated_at: '2026-08-09T21:00:00Z' }, remote), false);
});

test('recency comparison selects the latest meaningful server timestamp', () => {
  assert.equal(
    latestSyncTimestamp('2026-08-01T00:00:00Z', '2026-08-09T00:00:00Z', null),
    '2026-08-09T00:00:00Z'
  );
});

test('the real v3 local migration deduplicates wellness and enforces user/date uniqueness', () => {
  const source = readFileSync(new URL('../src/lib/local-db.ts', import.meta.url), 'utf8');
  const body = source.match(/function migrateLocalDbV3\(\) \{[\s\S]*?db\.execSync\(`([\s\S]*?)`\);\n\}/)?.[1];
  assert.ok(body, 'migrateLocalDbV3 SQL must remain extractable for behavior testing');

  const db = new DatabaseSync(':memory:');
  db.exec(`
    create table workout_sessions_local(local_id text primary key, user_id text, started_at text, is_deleted integer default 0, deleted_at text, updated_at text);
    create table workout_sets_local(local_id text primary key, is_deleted integer default 0, deleted_at text);
    create table exercise_targets_local(local_id text primary key, user_id text, exercise_id text);
    create table meal_logs_local(local_id text primary key, user_id text, updated_at text);
    create table water_logs_local(local_id text primary key, user_id text, updated_at text);
    create table mood_logs_local(local_id text primary key, user_id text, check_in_date text, updated_at text);
    insert into mood_logs_local values ('old', 'u1', '2026-08-09', '2026-08-09T01:00:00Z');
    insert into mood_logs_local values ('new', 'u1', '2026-08-09', '2026-08-09T02:00:00Z');
    insert into workout_sessions_local values ('s1', 'u1', '2026-08-09T02:30:00Z', 0, '2026-08-09T03:00:00Z', '2026-08-09T03:00:00Z');
  `);
  db.exec(body);

  assert.equal(db.prepare('select count(*) as count from mood_logs_local where user_id = ? and check_in_date = ?').get('u1', '2026-08-09').count, 1);
  assert.equal(db.prepare('select is_deleted from workout_sessions_local where local_id = ?').get('s1').is_deleted, 1);
  assert.throws(() => db.prepare('insert into mood_logs_local values (?, ?, ?, ?)').run('dup', 'u1', '2026-08-09', '2026-08-10T00:00:00Z'));
  db.close();
});
