# Brand and product identity release gate

## Current implementation identity

The working product identity is **All-In-One Fitness** with native identifier `com.farisnasse.allinonefitness`, URL scheme `fitnessapp`, and the committed icon/splash asset family under `assets/`. In-app first-run copy describes one product spanning workouts, meals, recovery, and progress.

**Value proposition:** Plan training, log nutrition, check recovery, and track progress in one private-first fitness log.

## Naming gate before store launch

The working name is descriptive and must not be treated as cleared merely because it exists in source code. Before production store submission, record a dated human review of:

- USPTO trademark search and any relevant common-law conflicts.
- Apple App Store and Google Play name conflicts.
- Desired domain and primary social-handle availability.
- Final legal/product decision on whether to retain the working name or rename.

If the final name changes, update the Expo `name`/`slug`, in-app naming, icon/splash text if any, privacy/terms wording, store metadata, and—only if intentionally changing the native app identity before first production release—the package/bundle identifier. Do not change an already-published native identifier as a cosmetic rename.

## Asset and store checklist

- [ ] Verify icon and adaptive/monochrome icon legibility at launcher notification/small sizes.
- [ ] Verify splash rendering on supported Android/iOS aspect ratios.
- [ ] Capture store screenshots from privacy-safe demo data only.
- [ ] Include Today, Train, Eat, Rest, Growth, and a representative logging flow.
- [ ] Remove real emails, names, measurements, barcodes, or account identifiers from marketing captures.
- [ ] Use the value proposition and terminology consistently in store copy and first-run screens.

This document intentionally does **not** claim trademark or store-name clearance. That conclusion requires a dated availability/legal review before launch.
