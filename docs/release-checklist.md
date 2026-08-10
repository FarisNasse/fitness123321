# Release candidate checklist

A candidate is not releasable because a build exists. It must satisfy the automated gates and have committed evidence for the manual gates.

## Automated gates

- [ ] Immutable `npm ci` using the pinned Node/npm pair.
- [ ] Lockfile portability, unit/source tests, TypeScript, ESLint, exercise checks, and local-runtime checks (`npm run test:all`).
- [ ] Expo dependency validation and doctor (`npm run check:expo`).
- [ ] Public Expo config and EAS-link validation (`npm run check:preview` and `npm run check:eas-link`).
- [ ] Android and iOS JS export/bundle checks (`npm run bundle:android`, `npm run bundle:ios`).
- [ ] Fresh Supabase migration rebuild and behavioral integration test (`.github/workflows/supabase-integration.yml`).
- [ ] Android device E2E smoke against an auth-preview APK (`.github/workflows/e2e-android.yml`).

## Manual gates captured in evidence

- [ ] Preview installed/tested on a real Android device.
- [ ] Preview installed/tested on an iOS simulator or device.
- [ ] VoiceOver and TalkBack critical-flow checklist passed.
- [ ] Crash-free critical smoke pass recorded.
- [ ] Data export and account deletion verified against the release backend.
- [ ] No open issue explicitly classified as a P0/P1 `release-blocker` remains.
- [ ] Final privacy policy, terms, and support locations are recorded.
- [ ] Final naming/store/trademark review is recorded.
- [ ] Release notes and rollback plan are attached.

Use `docs/release-candidate.example.json` as the machine-checkable evidence shape. The **Release candidate gate** workflow rejects omitted/failed fields.
