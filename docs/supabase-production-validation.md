# Supabase production validation

This runbook validates the app against a clean, production-like Supabase project. It covers every checked-in migration, public email/password auth, persisted sessions, owner-only RLS, all four sync domains, and password recovery. Do not mark the issue manually verified until both the automated live-project check and the device checklist pass.

## 1. Create or select the validation project

Create a new Supabase project, or select a non-production project whose data can be discarded. Record its project ref and URL. In **Project Settings > API Keys**, collect:

- the publishable or legacy `anon` key for the app;
- the server-only secret or legacy `service_role` key for the CLI validation script.

Never expose the server-only key through an `EXPO_PUBLIC_*` variable, EAS client environment, commit, build log, screenshot, or pull request.

In **Authentication > Sign In / Providers > Email**:

- keep Email enabled;
- choose whether Confirm email is enabled and record the choice in the pull request;
- configure working SMTP before relying on production email delivery.

The app supports either confirmation setting. When confirmation is enabled, sign-up shows a confirmation message and the `0005` trigger creates the profile before the user first signs in.

In **Authentication > URL Configuration**:

- set Site URL to the real deployed web origin if one exists;
- add the exact production mobile redirect `fitnessapp://reset-password`;
- for Expo Go-only development, add the current `exp://.../--/reset-password` URL emitted by the dev server, or a temporary `exp://**/--/reset-password` wildcard. Do not use a wildcard for the production mobile redirect.

If the recovery email template was customized, ensure its link uses `{{ .RedirectTo }}` so the `redirectTo` supplied by the app is honored.

## 2. Apply every migration to the clean project

Use the repository-pinned Node 22.23.1 and npm 10.9.8 toolchain from the
repository root. Log in, link this checkout, preview the pending migration list,
push it, and confirm that migrations `0001` through `0005` are remote:

```bash
npx supabase@latest login
export SUPABASE_PROJECT_REF=your-project-ref
npx supabase@latest link --project-ref "$SUPABASE_PROJECT_REF"
npx supabase@latest migration list
npx supabase@latest db push --include-all
npx supabase@latest migration list
```

For a genuinely clean project the first list shows every local migration as pending. The final list must pair every local migration with a remote migration. Do not use `db reset --linked` against a shared or production project.

## 3. Run the live auth, sync, RLS, and recovery check

Export credentials only in the local shell or a gitignored `.env`. The service-role value is intentionally not read by the Expo app.

```bash
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_ANON_KEY=your-publishable-or-anon-key
export SUPABASE_SERVICE_ROLE_KEY=your-server-only-key
export SUPABASE_TEST_EMAIL_DOMAIN=an-email-domain-you-control.example
export EXPO_PUBLIC_AUTH_REDIRECT_URL=fitnessapp://reset-password
npm run check:supabase
```

The script creates two temporary users and deletes them in `finally`. It verifies:

- public sign-up with Confirm email either on or off;
- sign-in, sign-out, sign-in again, and session restoration through persisted client storage;
- automatic profile creation and the onboarding profile update;
- owner inserts and reads for workout sessions/sets, meals/items/water, mood/sleep/steps, and body measurements;
- empty reads and updates when user B targets user A rows;
- a rejected cross-user insert;
- recovery-token exchange, password update, and sign-in with the new password.

The script needs the server-only key solely to confirm test users, generate a deterministic recovery token without reading an inbox, and clean up. Every RLS assertion is performed by clients using only the public key plus a real user session.

## 4. Run a Supabase-backed app build

For local Expo validation, copy `.env.example` to the gitignored `.env`, set the real public URL/key, and use these values:

```dotenv
EXPO_PUBLIC_AUTH_MODE=supabase
EXPO_PUBLIC_AUTH_REDIRECT_URL=fitnessapp://reset-password
EXPO_PUBLIC_WORKOUT_SYNC_SOURCE=supabase
EXPO_PUBLIC_NUTRITION_SYNC_SOURCE=supabase
EXPO_PUBLIC_WELLNESS_SYNC_SOURCE=supabase
EXPO_PUBLIC_BODY_MEASUREMENT_SYNC_SOURCE=supabase
EXPO_PUBLIC_EXERCISE_SOURCE=supabase
EXPO_PUBLIC_FOOD_SOURCE=supabase
```

Run:

```bash
npm ci
npm run test:all
npx expo start -c
```

For an installable Android build, store only the public project values in the EAS `preview` environment, then build the committed `auth-preview` profile:

```bash
npx eas-cli@latest login
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://your-project.supabase.co --visibility plaintext
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value your-publishable-or-anon-key --visibility sensitive
npx eas-cli@latest build --platform android --profile auth-preview
npx eas-cli@latest build:run --platform android --latest
```

Repeat the two `env:create` commands with `--environment production` before a production build. The service-role key must never be created in EAS.

## 5. Physical-device or emulator checklist

Record device/emulator, OS, build ID, Supabase project ref, confirmation setting, tester initials, and date in the pull request.

1. Install the `auth-preview` build and create user A through `/register`.
2. If Confirm email is enabled, confirm the email, return to the app, and sign in.
3. Complete onboarding. Confirm the app opens `/dashboard`, not `/onboarding` again.
4. Add and sync one workout with a set, one meal and water log, one wellness check-in, and one body measurement. Confirm each row in Supabase belongs to user A.
5. Force-stop the app, reopen it, and confirm the session restores directly to the dashboard.
6. Sign out with the dashboard Account action, confirm protected tabs redirect to sign-in, then sign in again.
7. Tap **Forgot password?**, submit user A's email, and open the received link on the device. Set a new password and confirm the app shows the success state. Sign out and sign in with the new password.
8. Reopen that already-used recovery link (or an expired link). Confirm the app shows **Link unavailable** and offers **Request a new link** and **Back to sign in**.
9. Create user B. Re-run `npm run check:supabase` for the automated cross-user proof; optionally confirm in the dashboard table editor that user A and B rows have different `user_id` values.

## Evidence template

```text
Supabase project ref:
Migration list result (0001-0005):
Email confirmation enabled:
Live verifier result:
EAS build ID/URL:
Device or emulator / OS:
Sign-up + onboarding:
Session restoration:
Owner sync (workout/nutrition/wellness/progress):
Cross-user RLS:
Password recovery:
Used/invalid recovery link error path:
Tester / date:
```
