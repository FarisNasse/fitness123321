# Product-completion milestones and issues

This roadmap converts the product audit into seven GitHub milestones and 26 implementation issues. The order deliberately prioritizes build reliability, account isolation, restoration, and correction flows before presentation or new differentiating features.

## Applying the roadmap to GitHub

Preview the exact operations without changing GitHub:

```bash
node scripts/github/apply-product-completion-roadmap.mjs
```

Create or update labels, milestones, and issues after review:

```bash
gh auth login
node scripts/github/apply-product-completion-roadmap.mjs --apply
```

Use `--repo owner/name` to target another repository. The operation is idempotent: stable issue markers are used to update existing roadmap issues rather than duplicate them. Closed issues remain closed when the script is rerun.

## Priority model

- **P0:** release blocker, privacy risk, data-loss risk, or proof required before trusting the app.
- **P1:** required for a complete, supportable consumer product.
- **P2:** differentiation that should begin only after the product fundamentals are complete.

## Milestones

### M0 — Releasable technical baseline

A clean checkout produces a stable installable build with runtime protection before additional product work is accepted.

**Exit conditions**

- Expo dependency checks pass without actionable warnings.
- A linked EAS preview build installs and launches.
- Global failures show a recoverable product experience and useful diagnostics.

| ID | Issue | Priority | Area | Dependencies |
|---|---|---:|---|---|
| P0.1 | Align the project with Expo SDK 56 | P0 | release | — |
| P0.2 | Connect EAS and record a real preview build | P0 | release | P0.1 |
| P0.3 | Add global runtime protection | P0 | runtime | — |

### M1 — Privacy and cloud restoration

Every record belongs to one account, survives reinstall, and converges predictably across devices.

**Exit conditions**

- Two accounts on one device remain fully isolated.
- Workout, nutrition, wellness, and progress data restore into a clean install.
- Offline edits, retries, conflicts, and deletes converge without duplication.

| ID | Issue | Priority | Area | Dependencies |
|---|---|---:|---|---|
| P0.4 | Scope every local query and subscription to the active owner | P0 | data | — |
| P0.5 | Implement two-way workout synchronization | P0 | sync | P0.4, P0.8 |
| P0.6 | Implement two-way nutrition synchronization | P0 | sync | P0.4, P0.8 |
| P0.7 | Implement two-way wellness synchronization | P0 | sync | P0.4, P0.8 |
| P0.8 | Harden migrations and sync contracts | P0 | data | — |

### M2 — Complete core workflows

Anything a user can create can also be resumed, reviewed, corrected, and deleted safely.

**Exit conditions**

- Workout sessions can be resumed and fully managed.
- Nutrition, wellness, and measurements support correction and history.
- No placeholder exercise content remains.

| ID | Issue | Priority | Area | Dependencies |
|---|---|---:|---|---|
| P1.1 | Finish workout lifecycle and history management | P1 | workouts | P0.4, P0.5 |
| P1.2 | Finish nutrition CRUD | P1 | nutrition | P0.6 |
| P1.3 | Finish wellness history | P1 | wellness | P0.7 |
| P1.4 | Finish progress measurement management | P1 | progress | — |
| P1.5 | Finish exercise content quality | P1 | workouts | — |

### M3 — Settings and account controls

Users control targets, units, appearance, profile, export, and account lifecycle without developer intervention.

**Exit conditions**

- No routine user action requires Supabase dashboard access.
- Targets, units, profile, and appearance persist correctly.
- Export and secure account deletion are available.

| ID | Issue | Priority | Area | Dependencies |
|---|---|---:|---|---|
| P1.6 | Build a real Settings and Profile area | P1 | settings | — |
| P1.7 | Improve onboarding and initialize targets | P1 | onboarding | P1.6 |
| P1.8 | Add account deletion and data lifecycle | P1 | account | P1.6, P0.8 |

### M4 — Product polish and accessibility

Every screen uses one coherent visual language, production-safe copy, accessible interaction patterns, and final product identity.

**Exit conditions**

- No prototype, provider-facing, or placeholder copy appears in production routes.
- Primary screens work in light/dark mode and at large text sizes.
- Critical flows are usable with VoiceOver and TalkBack.

| ID | Issue | Priority | Area | Dependencies |
|---|---|---:|---|---|
| P1.9 | Remove developer-facing and placeholder copy | P1 | ux | — |
| P1.10 | Unify the visual and interaction system | P1 | ux | — |
| P1.11 | Complete an accessibility pass | P1 | accessibility | P1.10 |
| P1.12 | Finalize brand and product identity | P1 | brand | P0.2, P1.9, P1.10 |

### M5 — Integrated insights

Turn four separate trackers into one explainable product story using only real saved data.

**Exit conditions**

- Daily readiness is deterministic, transparent, and non-medical.
- Weekly review combines all data domains honestly.
- Progression suggestions are visible, understandable, and user-controlled.

| ID | Issue | Priority | Area | Dependencies |
|---|---|---:|---|---|
| P2.1 | Build an explainable Daily Readiness experience | P2 | insights | P0.5, P0.6, P0.7, P1.3 |
| P2.2 | Build a Weekly Review | P2 | insights | P2.1, P1.4 |
| P2.3 | Surface smart workout progression as a first-class feature | P2 | workouts | P1.1 |

### M6 — Behavioral testing and release operations

Prove the built application and its data contracts with behavioral tests, device-level flows, and explicit release gates.

**Exit conditions**

- Service tests exercise actual ownership and merge behavior.
- A built Android app completes the main clean-install and offline/online flow.
- Release candidates cannot ship without documented evidence and gates.

| ID | Issue | Priority | Area | Dependencies |
|---|---|---:|---|---|
| P0.9 | Add service-level behavioral integration tests | P0 | testing | P0.4, P0.5, P0.6, P0.7, P0.8 |
| P0.10 | Add device-level end-to-end tests | P0 | testing | P0.2, P0.9, P1.1, P1.2, P1.3, P1.4, P1.7 |
| P1.13 | Create release gates | P1 | release | P0.1, P0.2, P0.3, P0.9, P0.10, P1.8, P1.11 |

## Recommended execution sequence

1. **Sprint 1 — Stop the bleeding:** P0.1, P0.2, P0.4, and the highest-impact production-copy cleanup from P1.9.
2. **Sprint 2 — Make cloud sync real:** P0.5, P0.6, P0.7, and P0.8.
3. **Sprint 3 — Complete correction flows:** P1.1, P1.2, P1.3, and P1.4.
4. **Sprint 4 — Consumer controls:** P1.6, P1.7, P1.8, and the remainder of P1.9.
5. **Sprint 5 — Presentation and accessibility:** P1.5, P1.10, P1.11, and P1.12.
6. **Sprint 6 — Differentiation and launch proof:** P2.1, P2.2, P2.3, P0.9, P0.10, and P1.13.

## Scope guardrail

Do not prioritize wearable integrations, social features, generative-AI coaching, marketplaces, complex meal planning, camera food recognition, or broad notification systems until the release gates and integrated insight experience are complete.
