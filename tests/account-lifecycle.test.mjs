import assert from 'node:assert/strict';
import test from 'node:test';

import { readProjectFile } from './helpers/project.mjs';

test('settings exposes portable export, sign-out, and deliberate permanent deletion', () => {
  const settings = readProjectFile('app/(tabs)/settings.tsx');
  const service = readProjectFile('src/features/account/account-service.ts');
  const edge = readProjectFile('supabase/functions/delete-account/index.ts');
  const db = readProjectFile('src/lib/local-db.ts');

  assert.match(settings, /Export my data/);
  assert.match(settings, /Delete account permanently/);
  assert.match(settings, /Final confirmation/);
  assert.match(service, /getLocalUserDataSnapshot/);
  assert.match(service, /dailyTargets/);
  assert.match(service, /functions\.invoke\('delete-account'/);
  assert.match(service, /clearLocalUserData\(userId\)/);
  assert.match(db, /foods: LocalFoodCache\[\]/);
  assert.match(edge, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(edge, /admin\.deleteUser/);
  assert.match(edge, /confirmation !== 'DELETE'/);
});
