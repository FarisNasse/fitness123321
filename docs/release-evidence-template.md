# Preview release evidence — YYYY-MM-DD

Copy this file to `docs/releases/YYYY-MM-DD-PLATFORM-BUILD_ID.md`, replace every
required value, and commit it only after installing and testing the binary. The
`npm run record:preview` command creates the same structure from EAS build JSON.

## Build

| Field | Value |
| --- | --- |
| EAS build ID | `<required>` |
| Build details URL | `<required>` |
| Artifact URL | `<required when available>` |
| Commit SHA | `<required>` |
| Platform | `android` or `ios` |
| Build profile | `preview` |
| EAS status | `finished` |
| App version | `<required>` |
| Native build version | `<required>` |
| Expo owner | `<required>` |
| EAS project ID | `<required>` |
| Native identifier | `com.farisnasse.allinonefitness` |
| Signing credentials | `Remote EAS-managed credentials` |

## Installation target

| Field | Value |
| --- | --- |
| Device or emulator | `<required>` |
| OS and version | `<required>` |
| Tester | `<required>` |
| Test date | `<required>` |

## Binary smoke verification

- [ ] APK/IPA installed without Metro or Expo Go.
- [ ] App icon is correct on the launcher or home screen.
- [ ] Branded splash screen appears on a cold launch.
- [ ] Bundled fonts render correctly.
- [ ] Every tab opens and navigation remains responsive.
- [ ] Representative modals/sheets open, close, and accept input.
- [ ] A SQLite-backed record can be created.
- [ ] The record survives force-close and relaunch.

## Result

**PASS / FAIL / BLOCKED**

Notes, defects, and follow-up issue links:

## Cross-device and account lifecycle

- [ ] Fresh Supabase migration/integration workflow passed for this commit.
- [ ] Android Maestro critical smoke passed; workflow and Maestro Cloud URLs recorded.
- [ ] Offline-to-online replay completed without duplicates.
- [ ] Sign-out/sign-in restored cloud-backed workout, nutrition/water, wellness, and measurement data.
- [ ] Portable data export reviewed for every supported user-data domain.
- [ ] Permanent account deletion removed authentication and owned cloud rows and cleared local account data.

## Accessibility

- [ ] TalkBack critical-flow checklist passed.
- [ ] VoiceOver critical-flow checklist passed.
- [ ] Web keyboard/modal-focus checklist passed.
- [ ] Status and selection remain understandable without color alone.

## Release operations

- [ ] No open P0/P1 issue labeled `release-blocker`.
- [ ] Final privacy policy URL/location recorded.
- [ ] Final terms URL/location recorded.
- [ ] Final public support URL/location recorded.
- [ ] Dated final brand/trademark/store/domain availability review recorded.
- [ ] Release notes attached.
- [ ] Rollback plan attached.
