// Generated from the audited product-completion plan. Keep issue IDs stable.

export const repositoryDefault = 'FarisNasse/fitness123321';

export const roadmapLabels = {
  "roadmap": {
    "color": "5319e7",
    "description": "Part of the product-completion roadmap"
  },
  "priority:P0": {
    "color": "b60205",
    "description": "Release blocker or critical trust issue"
  },
  "priority:P1": {
    "color": "d93f0b",
    "description": "Required for a complete consumer product"
  },
  "priority:P2": {
    "color": "1d76db",
    "description": "Differentiation after product fundamentals"
  },
  "area:release": {
    "color": "0052cc",
    "description": "Build, distribution, and release operations"
  },
  "area:runtime": {
    "color": "0e8a16",
    "description": "Runtime resilience and diagnostics"
  },
  "area:data": {
    "color": "006b75",
    "description": "Ownership, schema, migrations, and local persistence"
  },
  "area:sync": {
    "color": "0366d6",
    "description": "Cross-device and cloud synchronization"
  },
  "area:workouts": {
    "color": "c5def5",
    "description": "Workout logging and exercise experience"
  },
  "area:nutrition": {
    "color": "bfdadc",
    "description": "Nutrition and hydration experience"
  },
  "area:wellness": {
    "color": "d4c5f9",
    "description": "Wellness check-ins and trends"
  },
  "area:progress": {
    "color": "f9d0c4",
    "description": "Measurements, strength records, and charts"
  },
  "area:settings": {
    "color": "fbca04",
    "description": "Settings, targets, units, and preferences"
  },
  "area:onboarding": {
    "color": "fef2c0",
    "description": "First-run and target initialization"
  },
  "area:account": {
    "color": "e99695",
    "description": "Account controls and data lifecycle"
  },
  "area:ux": {
    "color": "f7c6c7",
    "description": "Product copy, visual system, and interactions"
  },
  "area:accessibility": {
    "color": "7057ff",
    "description": "Accessibility and assistive technology"
  },
  "area:brand": {
    "color": "bfe5bf",
    "description": "Product identity and store presentation"
  },
  "area:insights": {
    "color": "a2eeef",
    "description": "Integrated readiness and review insights"
  },
  "area:testing": {
    "color": "000000",
    "description": "Behavioral, integration, and E2E testing"
  }
};

export const productCompletionRoadmap = [
  {
    "key": "M0",
    "title": "M0 \u2014 Releasable technical baseline",
    "description": "A clean checkout produces a stable installable build with runtime protection before additional product work is accepted.",
    "exit": [
      "Expo dependency checks pass without actionable warnings.",
      "A linked EAS preview build installs and launches.",
      "Global failures show a recoverable product experience and useful diagnostics."
    ],
    "issues": [
      {
        "id": "P0.1",
        "priority": "P0",
        "area": "release",
        "title": "P0.1 \u2014 Align the project with Expo SDK 56",
        "goal": "Eliminate Expo/native dependency drift so development clients and preview builds use a supported, predictable native stack.",
        "tasks": [
          "Remove the redundant app.json or deliberately merge every required value into app.config.js.",
          "Add required direct peer dependencies, including expo-font, expo-constants, and react-native-worklets when required by the installed SDK packages.",
          "Use expo install to replace mismatched packages with Expo SDK 56-compatible versions.",
          "Verify Babel, Reanimated/Worklets, Gesture Handler, Router, fonts, SQLite, and native screens in a built development client.",
          "Add expo-doctor and expo install --check to the documented release checklist."
        ],
        "acceptance": [
          "All locally executable expo-doctor checks pass.",
          "expo install --check reports no unsupported version drift.",
          "Android and iOS bundles compile.",
          "The app opens in a development client and preview build without a native-module crash."
        ]
      },
      {
        "id": "P0.2",
        "priority": "P0",
        "area": "release",
        "title": "P0.2 \u2014 Connect EAS and record a real preview build",
        "goal": "Link the repository to its final Expo project and produce reproducible installable preview evidence.",
        "tasks": [
          "Select the final Expo account and project.",
          "Commit owner and extra.eas.projectId in the Expo configuration.",
          "Confirm final Android package and iOS bundle identifiers.",
          "Generate or select signing credentials.",
          "Produce an Android preview APK and, when available, an iOS internal build.",
          "Add a release-evidence template containing build ID, URL, commit SHA, device, OS, tester, and result."
        ],
        "acceptance": [
          "eas build --platform android --profile preview succeeds from a clean checkout.",
          "The APK installs and launches on a clean device or emulator.",
          "App icon, splash, fonts, tabs, modals, and SQLite function in the binary."
        ],
        "dependsOn": [
          "P0.1"
        ]
      },
      {
        "id": "P0.3",
        "priority": "P0",
        "area": "runtime",
        "title": "P0.3 \u2014 Add global runtime protection",
        "goal": "Prevent blank-screen failures and provide production-safe diagnostics without blocking offline use.",
        "tasks": [
          "Add a root error boundary with a branded recovery screen and restart path.",
          "Add structured production error and crash reporting with environment and release metadata.",
          "Replace raw provider and configuration errors with user-safe copy while retaining diagnostic context in logs.",
          "Add shared network-state and sync-state primitives for all data domains."
        ],
        "acceptance": [
          "A deliberately thrown render error shows a recoverable product screen instead of a blank view.",
          "Unhandled errors are captured with environment and release metadata.",
          "Offline state is visible and does not block local logging."
        ]
      }
    ]
  },
  {
    "key": "M1",
    "title": "M1 \u2014 Privacy and cloud restoration",
    "description": "Every record belongs to one account, survives reinstall, and converges predictably across devices.",
    "exit": [
      "Two accounts on one device remain fully isolated.",
      "Workout, nutrition, wellness, and progress data restore into a clean install.",
      "Offline edits, retries, conflicts, and deletes converge without duplication."
    ],
    "issues": [
      {
        "id": "P0.4",
        "priority": "P0",
        "area": "data",
        "title": "P0.4 \u2014 Scope every local query and subscription to the active owner",
        "goal": "Make local storage isolation consistent across all domains and derived dashboard values.",
        "tasks": [
          "Require an owner ID for recent and completed workout queries.",
          "Require an owner ID for daily nutrition summaries, meal records, water totals, and subscriptions.",
          "Audit every local read, write, notification, aggregate, PR calculation, repeat-workout query, and dashboard query.",
          "Clear account-specific in-memory state on sign-out.",
          "Choose and document whether local preview data is isolated, claimed by a new account, or discarded."
        ],
        "acceptance": [
          "Account B cannot see any workout, nutrition, wellness, measurement, target, or derived metric from Account A on the same device.",
          "Automated tests switch between two users against one local database and verify isolation."
        ]
      },
      {
        "id": "P0.5",
        "priority": "P0",
        "area": "sync",
        "title": "P0.5 \u2014 Implement two-way workout synchronization",
        "goal": "Hydrate remote workout history into the local mirror while preserving pending offline changes.",
        "tasks": [
          "Download the authenticated user's active and completed sessions and sets.",
          "Upsert remote rows locally without overwriting pending local edits.",
          "Restore exercise ordering where possible.",
          "Define deterministic conflict resolution using updated_at, tombstones, and local pending status.",
          "Add pagination or a bounded initial history fetch.",
          "Resume an unfinished workout after restart or remote restoration."
        ],
        "acceptance": [
          "A workout created on Device A appears on Device B after sign-in or refresh.",
          "Offline edits survive and reconcile after reconnecting.",
          "Remote and local deletes converge.",
          "Repeated refreshes do not create duplicate sessions or sets."
        ],
        "dependsOn": [
          "P0.4",
          "P0.8"
        ]
      },
      {
        "id": "P0.6",
        "priority": "P0",
        "area": "sync",
        "title": "P0.6 \u2014 Implement two-way nutrition synchronization",
        "goal": "Restore meals, items, and water logs into an empty local database and converge edits and deletes across devices.",
        "tasks": [
          "Download meal logs, meal items, and water logs for the signed-in user.",
          "Rebuild local parent-child relationships deterministically.",
          "Preserve unsynced local entries during refresh.",
          "Add update/delete tombstones or an equivalent deterministic model before exposing full edit/delete UI."
        ],
        "acceptance": [
          "Meals and water logged on one device appear on another.",
          "Corrected or deleted entries converge across devices.",
          "Dashboard totals match restored records."
        ],
        "dependsOn": [
          "P0.4",
          "P0.8"
        ]
      },
      {
        "id": "P0.7",
        "priority": "P0",
        "area": "sync",
        "title": "P0.7 \u2014 Implement two-way wellness synchronization",
        "goal": "Restore and merge daily wellness records without duplicating one user's date-level check-in.",
        "tasks": [
          "Download mood and sleep rows and merge them into one daily local check-in.",
          "Add stable uniqueness for one check-in per user and date or define deterministic merge behavior.",
          "Prevent duplicate remote mood and sleep rows during repeated updates.",
          "Preserve local pending edits during refresh."
        ],
        "acceptance": [
          "A check-in saved on Device A appears on Device B.",
          "Updating the same date does not create duplicate daily records.",
          "Steps, sleep, mood, stress, and energy remain consistent after refresh."
        ],
        "dependsOn": [
          "P0.4",
          "P0.8"
        ]
      },
      {
        "id": "P0.8",
        "priority": "P0",
        "area": "data",
        "title": "P0.8 \u2014 Harden migrations and sync contracts",
        "goal": "Give all synchronized domains explicit schema, recency, uniqueness, deletion, and upgrade contracts.",
        "tasks": [
          "Add unique constraints and indexes for user/date targets and daily wellness records.",
          "Add updated_at fields and update triggers wherever conflict resolution depends on recency.",
          "Version and test local database migrations instead of relying only on tolerant ALTER TABLE calls.",
          "Validate every migration against a newly created Supabase project in CI or a protected integration workflow."
        ],
        "acceptance": [
          "Every migration applies in order to a clean database.",
          "The latest app migrates an older local database without data loss.",
          "Sync tests cover stale rows, deletion, retry, duplicate replay, and concurrent updates."
        ]
      }
    ]
  },
  {
    "key": "M2",
    "title": "M2 \u2014 Complete core workflows",
    "description": "Anything a user can create can also be resumed, reviewed, corrected, and deleted safely.",
    "exit": [
      "Workout sessions can be resumed and fully managed.",
      "Nutrition, wellness, and measurements support correction and history.",
      "No placeholder exercise content remains."
    ],
    "issues": [
      {
        "id": "P1.1",
        "priority": "P1",
        "area": "workouts",
        "title": "P1.1 \u2014 Finish workout lifecycle and history management",
        "goal": "Complete the workout lifecycle from active-session recovery through history management.",
        "tasks": [
          "Detect and prominently resume an active workout.",
          "Prevent accidental multiple active sessions or present an explicit choice.",
          "Let users name and rename workouts.",
          "Add completed-workout delete with confirmation and undo.",
          "Add notes at workout completion.",
          "Improve history details with volume, exercise count, duration, PRs, and progression outcome.",
          "Use the shared design system across history and detail screens."
        ],
        "acceptance": [
          "A user can start, leave, restart, resume, finish, rename, review, repeat, and delete a workout.",
          "Every destructive action has confirmation or undo."
        ],
        "dependsOn": [
          "P0.4",
          "P0.5"
        ]
      },
      {
        "id": "P1.2",
        "priority": "P1",
        "area": "nutrition",
        "title": "P1.2 \u2014 Finish nutrition CRUD",
        "goal": "Let users correct every food and water record that contributes to daily totals.",
        "tasks": [
          "Edit quantity, serving unit, meal type, and time.",
          "Delete a food entry.",
          "Correct or delete water entries and provide immediate undo for quick-add.",
          "Allow personal custom foods to be edited or clearly distinguish immutable shared foods.",
          "Add date navigation for reviewing and correcting previous days."
        ],
        "acceptance": [
          "Daily totals update immediately after create, edit, or delete.",
          "Changes persist across restart and synchronize across devices."
        ],
        "dependsOn": [
          "P0.6"
        ]
      },
      {
        "id": "P1.3",
        "priority": "P1",
        "area": "wellness",
        "title": "P1.3 \u2014 Finish wellness history",
        "goal": "Turn the daily check-in into an honest, correctable history and trend experience.",
        "tasks": [
          "Add date navigation or a calendar/history list.",
          "Show 7-day and 30-day trends for sleep, mood, energy, stress, and steps.",
          "Allow editing past check-ins.",
          "Add optional notes without cluttering the daily flow."
        ],
        "acceptance": [
          "Users can review and correct prior days.",
          "Trend values are derived from saved records rather than fabricated samples."
        ],
        "dependsOn": [
          "P0.7"
        ]
      },
      {
        "id": "P1.4",
        "priority": "P1",
        "area": "progress",
        "title": "P1.4 \u2014 Finish progress measurement management",
        "goal": "Make body measurements and progress charts accurate, editable, and useful over selectable periods.",
        "tasks": [
          "Add edit and delete actions for measurements.",
          "Add selectable chart ranges and clearer axes and tooltips.",
          "Separate strength records from body measurements visually.",
          "Show useful deltas over selected periods rather than only the immediately previous row."
        ],
        "acceptance": [
          "A mistaken measurement can be corrected or removed.",
          "Charts and metric cards update immediately and remain accurate after sync."
        ]
      },
      {
        "id": "P1.5",
        "priority": "P1",
        "area": "workouts",
        "title": "P1.5 \u2014 Finish exercise content quality",
        "goal": "Remove placeholders and make the exercise library consistently useful and fast to navigate.",
        "tasks": [
          "Remove the muscle-diagram placeholder.",
          "Ship licensed or owned diagrams, or remove the diagram surface entirely.",
          "Audit exercise names, duplicates, instructions, equipment labels, and muscle metadata.",
          "Add favorites and recent exercises for fast selection."
        ],
        "acceptance": [
          "No placeholder content is visible.",
          "Exercise details consistently contain useful content.",
          "Frequently used exercises are reachable quickly."
        ]
      }
    ]
  },
  {
    "key": "M3",
    "title": "M3 \u2014 Settings and account controls",
    "description": "Users control targets, units, appearance, profile, export, and account lifecycle without developer intervention.",
    "exit": [
      "No routine user action requires Supabase dashboard access.",
      "Targets, units, profile, and appearance persist correctly.",
      "Export and secure account deletion are available."
    ],
    "issues": [
      {
        "id": "P1.6",
        "priority": "P1",
        "area": "settings",
        "title": "P1.6 \u2014 Build a real Settings and Profile area",
        "goal": "Provide one consumer-facing place for profile, targets, units, appearance, account, data, and help controls.",
        "tasks": [
          "Add profile controls for display name, primary goal, and fitness level.",
          "Add daily targets for calories, protein, carbs, fat, water, and steps.",
          "Add lb/kg and in/cm unit preferences.",
          "Add system, light, and dark appearance preferences.",
          "Add email, change password, and sign-out account controls.",
          "Add data export and account deletion entry points.",
          "Add support/contact, privacy, terms, app version, and build information."
        ],
        "acceptance": [
          "No user-facing instruction requires a Supabase dashboard or database row.",
          "Settings persist locally and remotely where appropriate.",
          "Unit changes apply consistently without changing stored canonical values."
        ]
      },
      {
        "id": "P1.7",
        "priority": "P1",
        "area": "onboarding",
        "title": "P1.7 \u2014 Improve onboarding and initialize targets",
        "goal": "Reach a personalized dashboard quickly while collecting units and enough information to create editable defaults.",
        "tasks": [
          "Keep onboarding short while collecting units and minimum target inputs.",
          "Derive initial daily targets automatically.",
          "Explain that all values can be changed later.",
          "Provide skip and safe-default paths."
        ],
        "acceptance": [
          "A new user reaches a personalized dashboard in under three minutes.",
          "The dashboard never explains missing database configuration."
        ],
        "dependsOn": [
          "P1.6"
        ]
      },
      {
        "id": "P1.8",
        "priority": "P1",
        "area": "account",
        "title": "P1.8 \u2014 Add account deletion and data lifecycle",
        "goal": "Let users export their information and permanently delete their account through a trusted server-side path.",
        "tasks": [
          "Implement secure account deletion through a server-side function or trusted backend.",
          "Delete or anonymize all owned records according to the documented policy.",
          "Clear local data and authentication state.",
          "Add confirmation, recent-auth requirements when needed, and a final clear warning.",
          "Export workouts, nutrition, wellness, measurements, and targets in a portable format."
        ],
        "acceptance": [
          "Users can delete their account without developer intervention.",
          "Deleted accounts can no longer authenticate and owned cloud rows are removed as documented.",
          "Export includes every supported user-data domain."
        ],
        "dependsOn": [
          "P1.6",
          "P0.8"
        ]
      }
    ]
  },
  {
    "key": "M4",
    "title": "M4 \u2014 Product polish and accessibility",
    "description": "Every screen uses one coherent visual language, production-safe copy, accessible interaction patterns, and final product identity.",
    "exit": [
      "No prototype, provider-facing, or placeholder copy appears in production routes.",
      "Primary screens work in light/dark mode and at large text sizes.",
      "Critical flows are usable with VoiceOver and TalkBack."
    ],
    "issues": [
      {
        "id": "P1.9",
        "priority": "P1",
        "area": "ux",
        "title": "P1.9 \u2014 Remove developer-facing and placeholder copy",
        "goal": "Make production routes read like a consumer product rather than an internal demo.",
        "tasks": [
          "Remove the dashboard implementation checklist and database-row instructions.",
          "Hide local-development badges and buttons from consumer builds.",
          "Remove Supabase and provider names from user-facing errors.",
          "Replace scaffold, ship, source, internal sync, and placeholder terminology.",
          "Move useful diagnostics into an explicit internal or debug surface."
        ],
        "acceptance": [
          "A text scan of production routes finds no developer setup instructions or placeholder language.",
          "All empty and error states explain what the user can do next."
        ]
      },
      {
        "id": "P1.10",
        "priority": "P1",
        "area": "ux",
        "title": "P1.10 \u2014 Unify the visual and interaction system",
        "goal": "Make all screens share theme-aware colors, components, feedback patterns, and responsive behavior.",
        "tasks": [
          "Replace hard-coded dark and light colors with theme tokens.",
          "Add a theme hook for icons, charts, headers, modals, and placeholders.",
          "Standardize spacing, typography, cards, sheets, alerts, destructive actions, loading states, and feedback banners.",
          "Review small and large phones, Android font scaling, and tablet widths.",
          "Use real icons rather than text glyphs for interactive controls."
        ],
        "acceptance": [
          "Every route works in light and dark modes.",
          "No screen uses an obviously different visual language.",
          "Layouts remain usable at 200% text scaling where practical."
        ]
      },
      {
        "id": "P1.11",
        "priority": "P1",
        "area": "accessibility",
        "title": "P1.11 \u2014 Complete an accessibility pass",
        "goal": "Make critical logging and account workflows operable with assistive technology and without color-only meaning.",
        "tasks": [
          "Add accessible labels, roles, hints, selected states, and minimum target sizes.",
          "Ensure modals trap focus on web and announce correctly on native screen readers.",
          "Do not encode status only through color.",
          "Test VoiceOver and TalkBack on critical flows."
        ],
        "acceptance": [
          "Critical workflows can be completed with a screen reader.",
          "Automated accessibility checks and a manual checklist are included in release evidence."
        ],
        "dependsOn": [
          "P1.10"
        ]
      },
      {
        "id": "P1.12",
        "priority": "P1",
        "area": "brand",
        "title": "P1.12 \u2014 Finalize brand and product identity",
        "goal": "Replace category-style naming with a consistent final identity across configuration, first run, and store assets.",
        "tasks": [
          "Choose the final product name and confirm trademark, domain, and store-name availability before launch.",
          "Refine icon and splash usage at small sizes.",
          "Add a concise value proposition and consistent product voice.",
          "Prepare store screenshots and privacy-safe preview/demo data."
        ],
        "acceptance": [
          "App name, icon, splash, package IDs, store metadata, and in-app naming match.",
          "The first-run experience clearly communicates the product's value."
        ],
        "dependsOn": [
          "P0.2",
          "P1.9",
          "P1.10"
        ]
      }
    ]
  },
  {
    "key": "M5",
    "title": "M5 \u2014 Integrated insights",
    "description": "Turn four separate trackers into one explainable product story using only real saved data.",
    "exit": [
      "Daily readiness is deterministic, transparent, and non-medical.",
      "Weekly review combines all data domains honestly.",
      "Progression suggestions are visible, understandable, and user-controlled."
    ],
    "issues": [
      {
        "id": "P2.1",
        "priority": "P2",
        "area": "insights",
        "title": "P2.1 \u2014 Build an explainable Daily Readiness experience",
        "goal": "Provide an offline, deterministic readiness result based on saved recovery, activity, nutrition, and hydration data.",
        "tasks": [
          "Use sleep duration and quality, mood, energy, stress, recent workout load, rest days, nutrition, and hydration completion.",
          "Show contributing factors and never present the result as a medical diagnosis.",
          "Work without AI or a network request.",
          "Explain missing data and confidence.",
          "Link each factor to the action that improves it."
        ],
        "acceptance": [
          "The result is deterministic, testable, and based only on real saved data.",
          "Every recommendation has a visible reason."
        ],
        "dependsOn": [
          "P0.5",
          "P0.6",
          "P0.7",
          "P1.3"
        ]
      },
      {
        "id": "P2.2",
        "priority": "P2",
        "area": "insights",
        "title": "P2.2 \u2014 Build a Weekly Review",
        "goal": "Combine workouts, nutrition, wellness, and body trends into one honest weekly summary with focused next steps.",
        "tasks": [
          "Summarize workouts completed, training volume, consistency, and PRs.",
          "Summarize average calories, protein, and water versus targets.",
          "Summarize sleep and recovery trends.",
          "Summarize weight and body trends.",
          "Generate two or three concrete priorities for the next week."
        ],
        "acceptance": [
          "The review uses a complete calendar week and handles missing data honestly.",
          "Sharing or export is added only after the core screen is correct and privacy-safe."
        ],
        "dependsOn": [
          "P2.1",
          "P1.4"
        ]
      },
      {
        "id": "P2.3",
        "priority": "P2",
        "area": "workouts",
        "title": "P2.3 \u2014 Surface smart workout progression as a first-class feature",
        "goal": "Expose the existing progression engine before, during, and after workouts without silently changing user input.",
        "tasks": [
          "Show last-time and today values before the first set.",
          "Show the progression reason at completion.",
          "Prebuild the next repeated workout with suggested values.",
          "Let the user accept, adjust, or dismiss every suggestion."
        ],
        "acceptance": [
          "Suggestions never silently overwrite manual values.",
          "Users can understand why a weight or repetition change was suggested."
        ],
        "dependsOn": [
          "P1.1"
        ]
      }
    ]
  },
  {
    "key": "M6",
    "title": "M6 \u2014 Behavioral testing and release operations",
    "description": "Prove the built application and its data contracts with behavioral tests, device-level flows, and explicit release gates.",
    "exit": [
      "Service tests exercise actual ownership and merge behavior.",
      "A built Android app completes the main clean-install and offline/online flow.",
      "Release candidates cannot ship without documented evidence and gates."
    ],
    "issues": [
      {
        "id": "P0.9",
        "priority": "P0",
        "area": "testing",
        "title": "P0.9 \u2014 Add service-level behavioral integration tests",
        "goal": "Replace false confidence from source-pattern assertions with executable data, ownership, migration, and synchronization behavior.",
        "tasks": [
          "Create test harnesses using temporary local databases and a test Supabase project.",
          "Test two local users and strict data isolation.",
          "Test create, edit, delete, and retry for each domain.",
          "Test offline queue replay, duplicate replay, remote hydration, pending-local versus newer-remote conflicts, and tombstone propagation.",
          "Test local schema upgrades from at least the previous released version.",
          "Reduce static source-pattern tests to narrow architecture guardrails."
        ],
        "acceptance": [
          "Tests fail when an actual query, ownership rule, migration, or merge behavior is wrong.",
          "The integration suite is repeatable and documented."
        ],
        "dependsOn": [
          "P0.4",
          "P0.5",
          "P0.6",
          "P0.7",
          "P0.8"
        ]
      },
      {
        "id": "P0.10",
        "priority": "P0",
        "area": "testing",
        "title": "P0.10 \u2014 Add device-level end-to-end tests",
        "goal": "Automate the main product scenario against a built Android application and preserve useful failure artifacts.",
        "tasks": [
          "Launch a clean install and register or sign in.",
          "Complete onboarding.",
          "Log a workout, nutrition, water, wellness, and measurement data.",
          "Restart and verify persistence.",
          "Sign out and in and verify restoration.",
          "Exercise one offline-to-online synchronization path.",
          "Retain screenshots, logs, and video where supported."
        ],
        "acceptance": [
          "The E2E smoke suite runs against a built app.",
          "A smaller manual iOS pass is documented.",
          "Failures retain enough evidence to diagnose the broken step."
        ],
        "dependsOn": [
          "P0.2",
          "P0.9",
          "P1.1",
          "P1.2",
          "P1.3",
          "P1.4",
          "P1.7"
        ]
      },
      {
        "id": "P1.13",
        "priority": "P1",
        "area": "release",
        "title": "P1.13 \u2014 Create release gates",
        "goal": "Make release readiness an explicit, reproducible decision rather than an informal manual judgment.",
        "tasks": [
          "Require locked installation, typecheck, lint, unit, integration, and E2E checks.",
          "Require Expo dependency checks and clean Supabase migration validation.",
          "Require preview installation on a real Android device and an iOS simulator or device.",
          "Require no open P0 or P1 release-blocking defects.",
          "Require privacy policy, terms, support, account deletion, and data export.",
          "Require a crash-free manual smoke test, release notes, evidence, and rollback plan."
        ],
        "acceptance": [
          "A release candidate cannot pass without every required automated and manual artifact.",
          "The release checklist is versioned in the repository and linked from release documentation."
        ],
        "dependsOn": [
          "P0.1",
          "P0.2",
          "P0.3",
          "P0.9",
          "P0.10",
          "P1.8",
          "P1.11"
        ]
      }
    ]
  }
];

export const definitionOfDone = [
  'Implementation is merged into the default branch.',
  'Relevant automated tests and verification steps pass.',
  'User-facing behavior is manually verified on the supported target.',
  'Documentation is updated when setup or behavior changes.',
];
