import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function projectPath(file) {
  return join(rootDir, file);
}

export function readProjectFile(file) {
  return readFileSync(projectPath(file), 'utf8');
}

export function readProjectJson(file) {
  return JSON.parse(readProjectFile(file));
}

export function fileExists(file) {
  return existsSync(projectPath(file));
}

export function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

export function runNodeScript(file) {
  return execFileSync(process.execPath, [projectPath(file)], {
    cwd: rootDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      EXPO_PUBLIC_WORKOUT_SYNC_SOURCE: '',
      EXPO_PUBLIC_EXERCISE_SOURCE: '',
    },
  });
}
