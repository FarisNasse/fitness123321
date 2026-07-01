# Live Workout UI/UX Research Diagnosis and Required Redesign Plan

**Project:** `fitness123321`
**Area:** `app/workout/session/[id].tsx` / Live Workout logging workflow
**Document type:** Research-grounded UX critique and implementation direction
**Status:** The current patched screen is not acceptable as a usable workout logger. It needs a deeper redesign, not another round of surface-level card rearrangement.

---

## 1. Executive Summary

The previous patch improved a few obvious problems, but it did **not** solve the core usability failure. It renamed the main action, added per-exercise draft state, grouped the active exercise and its logged sets, and collapsed inactive exercises. Those were directionally correct changes, but they were implemented as another layer on top of the same flawed screen architecture.

The result is still too visually heavy, too scroll-dependent, too explanation-driven, and too structurally tangled. It still asks the user to understand a large screen while they are physically active, switching attention, holding a phone, resting between sets, and trying not to lose track of reps and weight.

The real issue is this:

> The Live Workout screen is still being designed as a feature dashboard, not as a fast, low-friction set logging instrument.

The required redesign is not “make the cards prettier.” The required redesign is to rebuild the screen around a narrow repeated task:

```text
Pick active exercise → confirm/adjust reps and weight → log set → rest → repeat or switch exercise
```

Everything not directly supporting that loop should be removed from the primary view, moved behind a sheet, or deferred until workout completion.

---

## 2. Research and Standards Used

This critique is grounded in established human-computer interaction, usability, cognitive load, motor-control, and human-centered design sources. These sources matter because workout logging happens in a constrained context: the user is distracted, physically fatigued, often one-handed, and repeatedly performing the same task under mild time pressure.

### Core sources

| Source | Relevant principle | Why it matters here |
|---|---|---|
| ISO 9241-210:2019, *Human-centred design for interactive systems* | Design must be based on users, tasks, environments, and iterative evaluation. | The previous patch was implementation-led, not context-of-use-led. |
| Nielsen, *10 Usability Heuristics* | Visibility of status, match with real-world mental models, recognition over recall, error prevention. | The screen must make the active exercise, next set, saved sets, and next action obvious. |
| Shneiderman, *Eight Golden Rules of Interface Design* | Consistency, informative feedback, closure, error prevention, user control. | Logging a set should feel complete and reversible, not ambiguous. |
| Sweller, *Cognitive Load During Problem Solving* | Minimize extraneous cognitive load. | The current design still burns attention on labels, cards, metadata, and choices unrelated to logging. |
| Fitts, *The Information Capacity of the Human Motor System* | Acquisition time increases when targets are smaller or farther away. | Gym use requires large, reachable controls, especially for one-handed thumb input. |
| Parhi, Karlson, and Bederson, *Target Size Study for One-Handed Thumb Use on Small Touchscreen Devices* | One-handed mobile targets need substantial physical size; the study reports 9.2 mm for discrete tasks and 7.6 mm for serial tasks. | Reps/weight controls and Log Set must be thumb-safe and near the primary operating zone. |
| Hutchins, Hollan, and Norman, *Direct Manipulation Interfaces* | Users benefit when objects of interest are continuously represented and acted upon directly. | The set being logged should be the visible object of interaction; settings and summaries should not mediate it. |
| Card, Moran, and Newell / GOMS | Skilled repeated tasks should minimize unnecessary operators and decisions. | Logging repeated sets should have fewer cognitive and physical steps than the current card stack creates. |
| Hick-Hyman law | More choices increase decision time and uncertainty. | The screen still exposes too many choices in the primary flow. |
| NASA-TLX | Mental demand, physical demand, temporal demand, effort, performance, and frustration can be measured. | This workflow should be validated with workload measurement, not just string tests. |
| Beyer and Holtzblatt, *Contextual Design / Contextual Inquiry* | Observe users in context instead of relying on abstract assumptions. | A workout screen must be tested while simulating actual workout conditions. |
| Apple HIG / Material Design / WCAG target-size guidance | Touch targets need minimum sizes and spacing. | Buttons and icon controls need measurable touch areas, not just visual affordances. |

### Source links

- ISO 9241-210:2019: <https://www.iso.org/standard/77520.html>
- Nielsen Norman Group, 10 Usability Heuristics: <https://www.nngroup.com/articles/ten-usability-heuristics/>
- Shneiderman, Eight Golden Rules: <https://www.cs.umd.edu/~ben/goldenrules.html>
- Sweller, 1988, Cognitive Load: <https://onlinelibrary.wiley.com/doi/10.1207/s15516709cog1202_4>
- Fitts, 1954, motor system / target acquisition: <https://pubmed.ncbi.nlm.nih.gov/13174710/>
- Parhi, Karlson, Bederson, one-handed thumb target-size study: <https://dl.acm.org/doi/10.1145/1152215.1152260>
- Microsoft-hosted PDF of Parhi et al.: <https://www.microsoft.com/en-us/research/wp-content/uploads/2006/01/parhi-mobileHCI06.pdf>
- Hutchins, Hollan, Norman, Direct Manipulation Interfaces: <https://vis.csail.mit.edu/classes/6.859/readings/pdfs/Hutchins-DirectManipulationInterfaces.pdf>
- Card, Moran, Newell, *The Psychology of Human-Computer Interaction*: <https://books.google.com/books/about/The_Psychology_of_Human_computer_Interac.html?id=JeFQAAAAMAAJ>
- John and Kieras, GOMS family overview: <https://dl.acm.org/doi/pdf/10.1145/235833.236054>
- Proctor and Schneider, Hick's law review: <https://pubmed.ncbi.nlm.nih.gov/28434379/>
- NASA Task Load Index: <https://www.nasa.gov/human-systems-integration-division/nasa-task-load-index-tlx/>
- Contextual Inquiry overview: <https://www.nngroup.com/articles/contextual-inquiry/>
- Contextual Design overview: <https://ixdf.org/literature/book/the-encyclopedia-of-human-computer-interaction-2nd-ed/contextual-design>
- Apple HIG buttons / minimum hit region: <https://developer.apple.com/design/human-interface-guidelines/buttons>
- Material Design touch targets: <https://m3.material.io/foundations/designing/structure>
- WCAG 2.2 target size minimum: <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>

---

## 3. What I Did Wrong in the Previous Patch

### 3.1 I treated the redesign as a code transformation instead of a design problem

The previous patch was too implementation-first. It changed state shape, labels, and component arrangement, but it did not start from observed user behavior or a rigorous task model.

That violates the spirit of ISO 9241-210. The screen should have been evaluated from the user’s actual context:

- standing in a gym,
- sweaty hands,
- one-handed use,
- repeated short interactions,
- divided attention,
- remembering previous set performance,
- switching between exercises,
- needing confidence that data was saved.

Instead, the patch assumed that moving data into an “active exercise card” would automatically create clarity. That assumption was wrong.

### 3.2 I made the screen more conceptually correct but not sufficiently usable

The previous patch solved some structural correctness:

- per-exercise draft state,
- explicit `Log set` action text,
- inactive rows that only resume exercises,
- logged sets shown near the active set editor.

But it failed on usability quality:

- too much explanatory text remains visible,
- too many cards compete for attention,
- the primary interaction is still embedded inside a large vertical scroll,
- the Add Exercise / Finish Workout controls are not actually persistent,
- optional feedback still appears during the workout,
- settings and edit modals are still controlled by the same giant file,
- the interface still feels like a dashboard rather than a tool.

### 3.3 I overvalued static tests

The tests now verify strings and source-code structure, but they do not verify that the screen is understandable, fast, reachable, or calm.

Examples of weak test behavior:

- asserting that `ACTIVE EXERCISE` appears before `Logged sets`,
- asserting that `Log set` exists,
- asserting that inactive rows do not call `logSetForExercise`,
- asserting that specific components exist in one file.

Those tests protect the patch, not the user experience. They can pass while the screen remains bad.

A serious UX test should measure:

- time to log first set,
- time to log subsequent set,
- number of hesitations or wrong taps,
- whether users can identify the active exercise within 2 seconds,
- whether users can identify the value about to be saved,
- whether users can switch exercises without data confusion,
- perceived workload using a NASA-TLX-like instrument,
- completion and error rate under phone-sized layout constraints.

### 3.4 I preserved the giant screen file instead of reducing design risk

The patched live workout screen is still a 1,643-line file. In that file, the screen owns:

- session loading,
- local persistence orchestration,
- exercise selection,
- draft state,
- target settings,
- edit-set state,
- rest timer,
- elapsed timer,
- effort feedback,
- delete confirmation,
- workout completion,
- rendering,
- modal layout,
- input styling,
- helper components,
- formatting helpers.

That is not just an engineering problem. It is a UX problem because it makes every design iteration risky. A screen that is hard to safely change will accumulate compromises.

---

## 4. Evidence From the Current Code

The current uploaded project’s Live Workout screen is not a focused interaction surface.

### 4.1 Size and responsibility

`app/workout/session/[id].tsx` currently has approximately:

```text
1,643 lines
23 useState calls
7 useMemo calls
6 useEffect calls
35 Pressable references
9 Modal references
18 Card references
12 Alert.alert calls
5 TextInput references
```

This is a strong smell that the screen is not organized around a small number of user tasks. It is acting as an entire feature module.

### 4.2 The top of the file mixes domain state, UI state, service calls, formatting, and rendering helpers

The same file imports navigation, haptics, React Native primitives, UI components, exercise services, PR estimation, workout persistence, progression feedback, local DB types, and model types. This indicates that the UI layer is directly coupled to many app concerns.

That coupling makes it harder to design a coherent interaction model because persistence details and UI hierarchy are being edited in the same place.

### 4.3 The primary visible screen is still a vertical stack of large sections

The render output starts with:

```text
LIVE WORKOUT header card
status pills
rest card
active exercise card
other exercises card
optional workout feedback card
add/finish card
```

This is better than the previous duplicated logger, but it is still a stacked dashboard. It does not create the feeling of a fast logging tool.

The user must visually parse multiple equally carded regions before understanding what matters. This violates the practical goal of reducing extraneous cognitive load.

### 4.4 The active exercise card is too verbose

The active card includes:

- `ACTIVE EXERCISE`,
- exercise name,
- target summary,
- metadata badges,
- `NEXT SET`,
- set number,
- source label,
- target rep range,
- weight jump,
- ready badge,
- reps editor,
- weight editor,
- long dynamic log button,
- secondary helper text,
- logged set section,
- empty state or set list,
- instructions affordance.

This is a lot to process during a workout. The design correctly groups data, but it still presents too many visible concepts at once.

### 4.5 Add Exercise and Finish Workout are not actually persistent

The previous plan called for a persistent bottom bar. The implementation placed Add Exercise and Finish Workout inside a normal `Card` at the bottom of the scroll content.

That means the actions can still disappear below the fold. For a workout logger, these should be docked or otherwise consistently reachable.

### 4.6 Optional feedback still appears in the workout flow

The current patch shows a `Workout feedback (optional)` card once any set exists. That is premature. Feedback belongs at workout completion or behind a deliberate action.

In the middle of a workout, feedback creates a choice that is not part of the primary loop. Under Hick-Hyman and cognitive-load reasoning, it adds avoidable decision pressure.

### 4.7 The logger still lacks a strong “last set → current set” comparison model

A lifter usually wants to know:

```text
What did I do last time?
What am I about to save now?
Did this set save?
```

The patched set list exists, but it is rendered as a generic list below the editor. It does not actively support comparison. The next-set editor should show a compact comparison line, such as:

```text
Last set: 8 × 135 lb
Now:      8 × 135 lb
```

or:

```text
Previous: 10 × 115
Current:  8 × 125
```

The previous patch grouped things spatially but did not design the comparison task deeply enough.

### 4.8 Deleting is too visually close to editing

Logged set rows are pressable for editing, while a small `✕` inside the same row deletes the set. Even with `hitSlop`, this is risky. During gym use, destructive actions should be visually and spatially separated or guarded with undo.

A safer model:

- tap row opens edit sheet,
- swipe row exposes delete,
- or long-press row opens actions,
- deletion confirms with undo snackbar.

### 4.9 The documentation is now inconsistent with the interface

Existing docs still mention pressing `Done`, while the code now says `Log set`. That means the UX language system is not governed. Documentation drift is a symptom of ad hoc design changes.

---

## 5. The Core UX Diagnosis

### 5.1 The interface lacks task compression

A workout logger should compress the most repeated task into the fewest possible cognitive and motor operations. The current design spreads the task across a header, active card, editor, log button, set history, rest area, and bottom action section.

Using a GOMS-style lens, the repeated task should be closer to:

```text
Look at active exercise
Confirm or adjust reps
Confirm or adjust weight
Tap Log Set
Observe saved state / rest state
```

The current UI adds unnecessary operators:

```text
Parse header
Ignore status pills
Find active card
Parse target text
Ignore metadata badges
Parse next-set label
Find editable field
Confirm stepper meaning
Find dynamic log label
Ignore helper text
Check saved set list
Ignore optional feedback
Scroll for bottom actions if needed
```

That is why the screen still feels exhausting.

### 5.2 The screen is still organized around features, not attention

The current design asks, “What features should be visible?”

A usable workout logger should ask, “What deserves attention in the next five seconds?”

During active logging, only these deserve primary attention:

1. active exercise,
2. last set,
3. current reps,
4. current weight,
5. log button,
6. rest state after logging.

Everything else is secondary.

### 5.3 The screen does not adequately respect the gym environment

A gym is not a calm desk environment. The app should assume:

- the user has limited time between sets,
- the user may be breathing hard,
- the user may be using one hand,
- the user may glance quickly and put the phone down,
- the user may be interrupted,
- the user may need to resume after several minutes,
- the user may not remember whether a set was saved.

This requires a more “instrument-like” UI: fewer choices, stronger state feedback, larger targets, persistent core controls, and obvious recovery from mistakes.

### 5.4 The current visual hierarchy is loud but not disciplined

Large text, heavy cards, bold labels, badges, and filled buttons do not automatically create hierarchy. If many things are bold, then nothing is calm.

The active set should dominate. Header stats, metadata, targets, and feedback should recede.

### 5.5 The screen still has weak closure after logging

Shneiderman’s rule of closure matters here. After tapping Log Set, the user should immediately understand:

```text
Set saved.
This is now set 4.
Rest timer started.
Previous set is visible.
```

The current implementation starts the rest timer and refreshes the list, but it does not create a strong interaction moment. The user may not feel confident enough to stop thinking about it.

A better closure pattern:

```text
Saved set 3: 8 × 135
Rest 01:30
Next set ready
Undo
```

---

## 6. Required Product Direction

The screen should be rebuilt around the concept of a **set logging instrument**.

### 6.1 New design principle

> The primary screen should show only what the user needs to log the next set correctly.

The app should stop trying to expose every workout-related feature on the main screen.

### 6.2 Primary screen structure

Recommended structure:

```text
[Compact sticky header]
Workout name · elapsed time · rest timer

[Exercise switcher]
Bench 3/4   Pulldown 2/3   Shoulder 0/3   +

[Active exercise]
Bench Press
Last: 8 × 135 lb

[Current set editor]
Set 4
Reps:   [-]  8   [+]
Weight: [-5] 135 [+5]

[Sticky primary action]
Log set 4
8 reps @ 135 lb

[Recent sets]
3  8 × 135
2  8 × 125
1 10 × 115

[Secondary menu]
Targets · Instructions · Notes · More
```

### 6.3 What must disappear from the primary flow

Remove from the default active logging path:

- long instructional helper copy,
- multiple status cards,
- best 1RM pill,
- effort feedback card,
- target configuration summary beyond one small line,
- metadata badges unless they solve a real task,
- repeated explanations of how logging works,
- any nonessential cards above the active logger.

### 6.4 What must become persistent

These controls/states must be consistently reachable:

- active exercise identity,
- rest timer if active,
- reps/weight editor,
- Log Set action,
- Add Exercise,
- Finish Workout through a secondary but reachable action.

Add Exercise and Finish Workout do not both need to be equal-weight buttons. Finish Workout can be in the header or overflow until sets exist, then become available through a clear end-workout action.

### 6.5 The main action should be shorter

The current dynamic button text can become too long:

```text
Log set 3 — 8 reps @ 135 lb
```

This is explicit, but not always visually elegant. Better pattern:

```text
Log set 3
8 reps @ 135 lb
```

Use a two-line button: short verb label first, confirmation detail below.

### 6.6 The “last set” should be elevated

The logger should show the previous set directly above or beside the current draft.

Example:

```text
Last set
8 reps @ 135 lb

Current set
[ 8 reps ] [ 135 lb ]
```

This supports recognition instead of recall. The user should not have to scan the set history to know what they did last.

### 6.7 Rest should be a state, not a card

Rest should appear as a compact state in the sticky header or primary action area:

```text
Rest 01:12      Skip
```

It should not create another large card unless the user explicitly opens timer controls.

### 6.8 Exercise switching should be faster

The current “Other Exercises” card is too heavy. Exercise switching should be a compact selector:

```text
Bench 3/4 | Pulldown 2/3 | Shoulder 0/3 | +
```

Inactive exercises should show progress, not paragraphs.

### 6.9 Set history should be recent-first and compact

During active logging, the most relevant set is the most recent one. Show recent sets first by default:

```text
Recent sets
3  8 × 135    Edit
2  8 × 125
1 10 × 115
```

Full history can be expanded if needed.

### 6.10 Editing and deleting need a safer interaction model

Required change:

- tapping a set opens edit,
- deletion is not a tiny `✕` on the same row,
- destructive actions require a confirmation or undo,
- undo is preferable for speed.

Recommended pattern:

```text
Tap set row → Edit Set sheet
Sheet actions: Save, Delete Set
After delete → snackbar: Set deleted [Undo]
```

---

## 7. Required Information Architecture

### 7.1 Separate the screen into layers

The current screen mixes too many concerns. The redesigned architecture should separate:

```text
Route shell
  loads session
  wires navigation
  owns top-level error/loading states

Live workout controller hook
  owns session state
  owns active exercise id
  owns drafts
  owns rest timer
  exposes commands

Presentation components
  render active logger
  render exercise switcher
  render set history
  render sheets
```

### 7.2 Required file structure

```text
app/workout/session/[id].tsx
src/features/workouts/live/useLiveWorkoutController.ts
src/features/workouts/live/liveWorkoutState.ts
src/features/workouts/live/liveWorkoutReducer.ts
src/features/workouts/live/liveWorkoutSelectors.ts
src/features/workouts/live/liveWorkoutFormatting.ts
src/features/workouts/live/components/LiveWorkoutScreenView.tsx
src/features/workouts/live/components/LiveWorkoutHeader.tsx
src/features/workouts/live/components/ExerciseSwitcher.tsx
src/features/workouts/live/components/ActiveSetLogger.tsx
src/features/workouts/live/components/SetValueStepper.tsx
src/features/workouts/live/components/RecentSetList.tsx
src/features/workouts/live/components/RestTimerStrip.tsx
src/features/workouts/live/components/WorkoutActionMenu.tsx
src/features/workouts/live/components/TargetSettingsSheet.tsx
src/features/workouts/live/components/EditSetSheet.tsx
src/features/workouts/live/components/ExerciseInstructionsSheet.tsx
src/features/workouts/live/components/FinishWorkoutSheet.tsx
```

### 7.3 Route file target size

`app/workout/session/[id].tsx` should ideally become under 150 lines. It should not contain the full UI, full state model, and all helpers.

Target responsibility:

```tsx
export default function LiveWorkoutRoute() {
  const controller = useLiveWorkoutController(sessionId);

  if (controller.status === 'loading') return <LoadingState />;
  if (controller.status === 'error') return <ErrorState />;

  return <LiveWorkoutScreenView controller={controller} />;
}
```

---

## 8. Required State Model

### 8.1 Use a reducer or state machine

The screen has too many coupled states for loose `useState` calls. It should use either a reducer or explicit state machine.

Current state concerns include:

- session loaded/not loaded/error,
- no exercises added,
- active exercise selected,
- draft editing,
- set saved,
- rest active,
- target sheet open,
- edit sheet open,
- finish confirmation open,
- sync pending/error.

A reducer makes transitions explicit.

Example:

```ts
type LiveWorkoutEvent =
  | { type: 'exercise.added'; exercise: Exercise }
  | { type: 'exercise.activated'; exerciseId: string }
  | { type: 'draft.changed'; exerciseId: string; patch: Partial<SetDraft> }
  | { type: 'set.logged'; exerciseId: string; set: LocalWorkoutSetRow }
  | { type: 'set.edited'; set: LocalWorkoutSetRow }
  | { type: 'set.deleted'; setId: string }
  | { type: 'rest.started'; seconds: number }
  | { type: 'rest.skipped' }
  | { type: 'sheet.opened'; sheet: LiveWorkoutSheet }
  | { type: 'sheet.closed' };
```

### 8.2 Drafts should remain per exercise

The previous patch correctly moved toward per-exercise draft state. That should remain. But drafts should be managed in the controller, not inside the route component.

Required behavior:

- switching exercises never mutates another exercise’s draft,
- logging uses only the active exercise’s draft,
- after logging, the next draft inherits from the logged set or progression suggestion,
- if a user typed unsaved values, switching away and back preserves them,
- if a suggested progression updates, it does not unexpectedly overwrite a manually typed draft.

### 8.3 Do not overwrite drafts silently

A major risk in the current patch is the relationship between smart defaults and user-entered values. The app must never silently replace manually edited reps/weight after async defaults return.

Each draft should track provenance:

```ts
type SetDraft = {
  reps: string;
  weight: string;
  source: 'suggested' | 'last-set' | 'manual';
  dirty: boolean;
};
```

Rules:

- defaults may initialize a clean draft,
- user input makes the draft dirty,
- async defaults must not overwrite dirty drafts,
- target changes may offer to update the current draft but should not assume permission.

---

## 9. Required Interaction Design

### 9.1 No-exercise state

Current no-exercise state is still text-heavy. It should be direct:

```text
Start logging
Add your first exercise
[+ Add exercise]
```

No long explanation. The user understands what a workout is.

### 9.2 Exercise-added state

Once an exercise is added:

```text
Bench Press
Set 1
Reps [8]
Weight [0]
[Log set 1]
```

The exercise library should close and the logger should be immediately ready.

### 9.3 Normal repeated set logging

After logging:

```text
Saved set 1: 8 × 135
Rest 01:30  Skip
Set 2 ready
```

The user should receive closure without an alert. Alerts should not be used for normal success.

### 9.4 Switching exercises

Exercise switching should not require scanning a separate card. Use a compact switcher at the top of the active workspace.

Example:

```text
[Bench 3] [Pulldown 2] [Shoulder 0] [+]
```

Tap changes the active exercise. No logging happens from inactive selectors.

### 9.5 Editing logged sets

Tap a set row:

```text
Edit set 3
Reps [8]
Weight [135]
[Save]
[Delete set]
```

Deletion should be in the edit sheet, not a small row-level target.

### 9.6 Finish workout

Finish should be separate from Log Set. It should not be visually equal to the main logging action.

Recommended:

- Header overflow: `Finish workout`, or
- bottom secondary action after the workout has at least one set, or
- long-press / confirmation if no sets exist.

Before finishing:

- if no sets: confirm discard/finish empty workout,
- if active draft is dirty: offer `Log set first`, `Discard draft`, `Cancel`,
- if rest active: allow finish without forcing rest completion.

### 9.7 Feedback timing

Effort feedback should appear in the finish flow:

```text
Finish workout
How did this workout feel?
Easy / Good / Max
[Complete workout]
```

It should not be a card in the middle of the live logging screen.

---

## 10. Required Visual Design Direction

### 10.1 Reduce card count

The main screen should not look like a stack of unrelated panels. Use one primary workspace with smaller embedded elements.

Current pattern:

```text
Card
Card
Card
Card
Card
```

Required pattern:

```text
Sticky compact header
Single active logger area
Compact recent history
Docked primary action
Sheets for secondary work
```

### 10.2 Use one dominant action

The only dominant filled action during workout logging should be:

```text
Log set
```

Add Exercise, Finish Workout, Edit Targets, Instructions, and Feedback are secondary actions.

### 10.3 Make touch targets measurable

Required minimums:

- Primary Log Set: full-width or near full-width, at least 48 dp high.
- Reps/weight steppers: at least 48 × 48 dp touch region.
- Exercise switcher chips: at least 44 pt / 48 dp equivalent height.
- Delete controls: not small inline targets next to edit targets.

### 10.4 Use visual contrast sparingly

Bold text should be reserved for:

- exercise name,
- current set number,
- reps value,
- weight value,
- Log Set.

Secondary details should use quiet text, not competing badges.

### 10.5 Prefer short labels

Bad primary surface:

```text
Pick an exercise, edit the next set, log it, then move to the next exercise.
```

Better default screen:

```text
Bench Press
Set 3
```

Help text can exist in empty states or onboarding, not every time.

---

## 11. Required Technical Design

### 11.1 Component extraction is not optional

This should not stay in one file. Component extraction is necessary because the UI needs repeated iteration.

Suggested ownership:

| Component | Owns | Must not own |
|---|---|---|
| `LiveWorkoutRoute` | route params, loading/error routing | render details |
| `useLiveWorkoutController` | persistence commands, state transitions | JSX layout |
| `LiveWorkoutScreenView` | screen composition | DB calls |
| `ActiveSetLogger` | active exercise, last/current set, log action | async default loading |
| `SetValueStepper` | reps/weight input pair | set persistence |
| `ExerciseSwitcher` | exercise activation | set logging |
| `RecentSetList` | compact set history | delete confirmation logic |
| `EditSetSheet` | editing one set | screen-level routing |
| `FinishWorkoutSheet` | finish confirmation and feedback | primary logging |

### 11.2 Inline style objects should be reduced

The current file uses many inline style objects. This makes hierarchy hard to reason about and hard to standardize.

Create semantic styles or reusable primitives:

```text
ScreenSection
PrimaryPanel
SecondaryAction
TouchTarget
ValueStepper
Sheet
```

This makes the UI language consistent.

### 11.3 Alerts should be reserved for exceptional cases

`Alert.alert` is currently used for validation, success, instructions, delete confirmation, and completion. Alerts are modal interruptions. In a live workout, they should be rare.

Recommended:

- validation: inline field error,
- saved set: toast/snackbar,
- instructions: sheet,
- delete: sheet + undo,
- finish: finish sheet,
- critical error: alert or error state.

### 11.4 Support phone-size layout explicitly

The tests should inspect layout concepts for phone use:

- main log button remains reachable,
- exercise switcher remains compact,
- no required action is hidden below scroll after adding one exercise,
- recent set list does not push logger out of reach,
- touch targets meet minimum dimensions.

Static source tests alone cannot prove this, but they can enforce component boundaries and required props.

---

## 12. Required Testing Strategy

### 12.1 Replace string-only UX tests with task tests

Existing tests should not merely check whether strings exist. They should model the task.

Required task tests:

1. Add first exercise.
2. Active logger appears without scrolling.
3. Default draft is visible.
4. User edits reps.
5. User edits weight.
6. User logs set.
7. Set appears as most recent set.
8. Last set summary updates.
9. Rest state appears.
10. Next draft is ready.
11. Add second exercise.
12. Switch away and back.
13. Drafts are preserved.
14. Finish workout detects unsaved dirty draft.

### 12.2 Add reducer/state tests

If a reducer is introduced, test it directly:

- `exercise.activated` preserves all drafts,
- `draft.changed` marks draft dirty,
- async defaults do not overwrite dirty drafts,
- `set.logged` clears dirty state only for that exercise,
- `rest.started` and `rest.skipped` are deterministic,
- `set.deleted` updates recent set summary.

### 12.3 Add design regression tests

Static tests should enforce architectural boundaries:

- route file under target line count,
- no DB calls inside presentational components,
- no `Alert.alert` in normal success flow,
- no row-level destructive `✕` delete in set list,
- no `Workout feedback` card in live logging view,
- `FinishWorkoutSheet` owns effort feedback.

### 12.4 Manual usability test protocol

Conduct at least five short tests with representative users or simulated lifters.

Scenario:

1. Start a workout.
2. Add Bench Press.
3. Log 8 reps at 135 lb.
4. Add Lat Pulldown.
5. Enter 10 reps at 100 lb but do not log.
6. Switch back to Bench Press.
7. Confirm Bench Press values are preserved.
8. Log another Bench Press set.
9. Edit the first Bench Press set.
10. Delete a set and undo.
11. Finish the workout.

Metrics:

- time to first logged set,
- wrong taps,
- backtracks,
- questions asked aloud,
- user confidence after logging,
- NASA-TLX short-form workload,
- 1-7 rating for “I always knew what would happen if I tapped the main button.”

Success threshold:

```text
90%+ task completion
0 accidental logs
0 accidental deletes
Median first-set logging under 20 seconds after exercise selection
Median repeat-set logging under 5 seconds
Average confidence rating >= 6/7
NASA-TLX frustration and mental demand visibly lower than current screen
```

---

## 13. Required Implementation Phases

### Phase 0: Stop expanding the current file

No more feature additions should be made inside `app/workout/session/[id].tsx` until the screen is split.

Deliverables:

- create live workout feature folder,
- move formatting helpers,
- move draft helpers,
- create controller hook,
- keep behavior unchanged during extraction.

Acceptance criteria:

- route file is under 300 lines after extraction,
- tests still pass,
- no UX behavior has changed yet.

### Phase 1: Build the real active set logger

Deliverables:

- `ActiveSetLogger`,
- `SetValueStepper`,
- `LastSetSummary`,
- two-line `Log set` button,
- inline validation.

Acceptance criteria:

- active logger fits on a phone screen without needing to scroll when one exercise exists,
- current set and last set are visible together,
- no helper paragraph is visible in normal logging mode,
- log button is always visible in the active logger region.

### Phase 2: Replace “Other Exercises” card with exercise switcher

Deliverables:

- compact exercise switcher,
- exercise progress chips,
- add exercise chip/button.

Acceptance criteria:

- switching exercises takes one tap,
- inactive exercises never log sets,
- active exercise is visually obvious,
- no large “Other Exercises” card remains.

### Phase 3: Move secondary features to sheets

Deliverables:

- Target settings sheet,
- Instructions sheet,
- Edit set sheet,
- Finish workout sheet,
- More menu if needed.

Acceptance criteria:

- target settings are not on the main screen,
- feedback is only in finish flow,
- delete is not a tiny inline row control,
- normal logging does not trigger modal alerts.

### Phase 4: Introduce reducer/state-machine behavior

Deliverables:

- reducer or explicit state machine,
- dirty draft tracking,
- async default overwrite protection,
- rest state transitions.

Acceptance criteria:

- defaults never overwrite manual draft input,
- switching exercises preserves draft state,
- logging updates only the active exercise,
- finish detects dirty unsaved draft.

### Phase 5: Replace weak tests

Deliverables:

- reducer tests,
- task-flow tests,
- architecture tests,
- updated docs and demo script.

Acceptance criteria:

- docs no longer mention obsolete `Done`,
- tests prove task behavior rather than string placement,
- static tests enforce screen/component boundaries.

### Phase 6: Conduct usability validation

Deliverables:

- 5-user usability test notes,
- task-completion table,
- wrong-tap log,
- workload rating,
- prioritized fixes.

Acceptance criteria:

- repeat-set logging feels immediate,
- users can explain what will be saved before tapping Log Set,
- users can switch exercises without confusion,
- users do not describe the screen as cluttered, confusing, or hard to scan.

---

## 14. Recommended Target Wireframe

```text
┌──────────────────────────────────────┐
│ Quick Workout        12:43      ⋯    │
│ Rest 01:12                       Skip│
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ Bench 3  │ Pulldown 2 │ Shoulder 0 │ +│
└──────────────────────────────────────┘

Bench Press
Target: 3 sets · 8-12 reps

Last set
8 reps @ 135 lb

Set 4

Reps
┌──────┐   ┌──────────────┐   ┌──────┐
│  −   │   │      8       │   │  +   │
└──────┘   └──────────────┘   └──────┘

Weight
┌──────┐   ┌──────────────┐   ┌──────┐
│ −5   │   │     135      │   │ +5   │
└──────┘   └──────────────┘   └──────┘

┌──────────────────────────────────────┐
│ Log set 4                            │
│ 8 reps @ 135 lb                      │
└──────────────────────────────────────┘

Recent sets
3   8 × 135
2   8 × 125
1  10 × 115

Targets · Instructions · Notes
```

This wireframe is intentionally less “designed” and more task-focused. The hierarchy is clearer because fewer objects compete.

---

## 15. Specific Things to Remove From the Current Patch

Remove or replace:

- the large `LIVE WORKOUT` explanatory card,
- `WorkoutStatusPill` for `Sets` and `Best 1RM` in the primary view,
- the large rest card; replace with compact strip,
- metadata badges in the active logger unless proven useful,
- `Workout feedback (optional)` card from the live view,
- bottom Add/Finish card from scroll content,
- inline row-level `✕` delete control,
- normal success alerts,
- instruction alert; use a sheet,
- string-based tests that only validate labels and order,
- docs that still mention `Done`.

---

## 16. Definition of Done

The redesign is not done when the tests pass. It is done when the screen satisfies these user-centered criteria:

1. A user can understand the active exercise and next set in under 2 seconds.
2. A user can identify exactly what the Log Set button will save without reading surrounding explanation.
3. Reps and weight are directly editable and reachable with one hand.
4. Logging a repeat set requires minimal attention and no scrolling.
5. The last set and current draft are visible together.
6. Rest state appears after logging without interrupting the user.
7. Switching exercises is one tap and never risks accidental logging.
8. Add Exercise is easy to find but does not compete with Log Set.
9. Finish Workout is available but not equal to Log Set in visual priority.
10. Settings, instructions, feedback, and analytics are not in the primary logging path.
11. Deleting a set is safe, reversible, and not adjacent to normal edit taps.
12. The route file is small enough that future UX iteration is safe.
13. Task-based tests verify the workout loop.
14. At least five usability sessions show reduced confusion and reduced workload compared with the current patch.

---

## 17. Final Assessment

The previous patch was not good enough because it tried to improve the screen from inside the existing structure. The result is still a long, high-density screen that behaves more like a dashboard than a workout logger.

The deeper required change is to stop treating Live Workout as a page of features and rebuild it as a focused interaction instrument.

The next implementation should not start by editing card styles. It should start by extracting the screen architecture, defining a reducer/state model, and implementing a compact active-set logger that keeps the user’s attention on one thing:

```text
This exercise. This set. These values. Log it.
```

Everything else is secondary.
