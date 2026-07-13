# Preview release evidence

Each file in this directory represents one real EAS binary installed and tested
on a named device or emulator. Do not add speculative, placeholder, queued, or
failed builds as successful release evidence.

Create a record from a completed EAS build:

```bash
npx eas-cli@latest build:view BUILD_ID_FROM_EAS --json > .eas-preview-build.json
npm run record:preview -- --build-json .eas-preview-build.json --device "DEVICE_OR_EMULATOR" --os "OS_AND_VERSION" --tester "TESTER_NAME" --result pass
```

Review the generated checklist before committing it. Use
`docs/release-evidence-template.md` only when the CLI JSON is unavailable.
