# Runtime protection and production diagnostics

The app is local-first. Connectivity and remote-provider failures may delay synchronization, but they must not prevent workout, nutrition, wellness, or body-measurement records from being written to the on-device database.

## Root recovery

`AppErrorBoundary` wraps the complete Expo Router runtime. A render failure displays the branded recovery screen instead of a blank view. **Restart app** calls Expo's cross-platform `reloadAppAsync`; runtimes that cannot perform a native reload fall back to resetting the boundary.

To verify manually in a development build, temporarily throw an error from a rendered route, confirm the recovery screen appears, press **Restart app**, and then remove the deliberate throw.

## Error reporting

Production diagnostics use `@sentry/react-native` when `EXPO_PUBLIC_SENTRY_DSN` is configured. Reports include:

- `EXPO_PUBLIC_APP_ENV` as the environment;
- `EXPO_PUBLIC_APP_RELEASE` or the Expo slug/version as the release;
- `EXPO_PUBLIC_APP_DIST` or the native build number as the distribution;
- source, operation, and domain tags supplied by the call site.

Provider and configuration details are written to structured diagnostic logs and Sentry. User interfaces receive stable product copy instead of raw Supabase or configuration messages. Personally identifying information is not enabled by default.

Configure the following in the EAS environment used for production builds:

```text
EXPO_PUBLIC_SENTRY_DSN
EXPO_PUBLIC_APP_ENV=production
EXPO_PUBLIC_APP_RELEASE=all-in-one-fitness@<version>
EXPO_PUBLIC_APP_DIST=<build-number>
SENTRY_ORG
SENTRY_PROJECT
SENTRY_AUTH_TOKEN
```

`SENTRY_AUTH_TOKEN` is build-only and must be stored as a sensitive EAS secret. It must not use the `EXPO_PUBLIC_` prefix. The Sentry Metro and Expo config plugins generate Debug IDs and enable source-map upload during configured release builds.

Without a DSN, diagnostics still produce structured local console records and the app remains fully usable.

## Network and synchronization state

`NetworkStateProvider` is the shared source of connectivity state. `SyncStateProvider` coordinates the four data domains:

- workouts;
- nutrition;
- wellness;
- progress/body measurements.

Local write services publish a domain-level pending event after saving. When the device is online and an authenticated remote source is enabled, the coordinator syncs the affected domain. Failed rows remain on-device and can be retried from the global status banner. Returning to the foreground or regaining connectivity also retries pending work.

When offline, the banner states that logging remains available and that changes will synchronize later. No local save path checks connectivity before writing.

## Verification

Run:

```bash
npm run test:all
npm run check:expo
npm run bundle:android
npm run bundle:ios
```

For production diagnostics, verify a deliberate render error and a captured non-render exception in a release build with the expected environment, release, and distribution tags.
