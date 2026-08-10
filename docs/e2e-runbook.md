# Device E2E runbook

The Android release smoke path is defined in `.maestro/critical-smoke.yaml`. It covers clean-state authentication, optional onboarding, workout logging and restart persistence, an Android airplane-mode offline/online replay, nutrition and water logging, wellness, body measurement, sign-out/sign-in restoration, and failure evidence in Maestro Cloud.

## Android automation

1. Create an `auth-preview` APK from the exact commit being evaluated.
2. Configure repository secrets `MAESTRO_CLOUD_API_KEY`, `MAESTRO_CLOUD_PROJECT_ID`, `E2E_USER_EMAIL`, and `E2E_USER_PASSWORD`. Use a dedicated disposable test account, never a personal account.
3. Run the **Android E2E smoke** workflow with the APK's direct download URL.
4. Preserve the workflow URL and Maestro Cloud console URL in release evidence. Maestro Cloud is expected to retain the run log and supported screenshots/video for a failed journey.
5. Reset/delete the dedicated test account if the environment is not disposable.

## iOS manual smoke

Run on a simulator or device using the same commit and an authenticated preview build. iOS does not provide the Android airplane-mode control used by the automated flow, so perform the offline/reconnect step manually.

- [ ] Clean install and sign in/register.
- [ ] Complete onboarding if shown.
- [ ] Log and complete a workout.
- [ ] Log a food and water entry.
- [ ] Save wellness and body measurement data.
- [ ] Force-close/relaunch and verify local persistence.
- [ ] Disconnect networking, make one supported local-first change, reconnect, and verify synchronization.
- [ ] Sign out/in and verify remote restoration without duplicate rows.
- [ ] Record screenshots/logs for any failure and attach them to release evidence.
