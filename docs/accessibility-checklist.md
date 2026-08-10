# Accessibility release checklist

Run this checklist on the same candidate binary recorded in the release evidence. Automated source checks are guardrails; this manual pass is required for release.

## VoiceOver — iOS

- [ ] Launch, sign in, and complete onboarding without touch-only gestures.
- [ ] Every tab announces its label and selected state.
- [ ] Start/resume a workout, choose an exercise, log a set, and finish the workout.
- [ ] Add food and water; selected meal/unit controls announce selection.
- [ ] Save a wellness check-in and body measurement.
- [ ] Open and close every critical modal/sheet; focus enters the modal and does not escape to content behind it.
- [ ] Dismissed modals return focus to a sensible originating control.
- [ ] Error, pending, success, and disabled states have readable text/announcements and are not communicated only by color.

## TalkBack — Android

- [ ] Repeat the same critical flows with TalkBack enabled.
- [ ] All actionable targets are comfortably reachable and at least 44 logical pixels high/wide where applicable.
- [ ] Increment/decrement controls, exercise chips, effort choices, mood choices, and segmented scores have meaningful labels and states.
- [ ] Destructive account deletion controls announce their consequence and disabled state.

## Keyboard — web

- [ ] Navigate sign-in, onboarding, logging, settings, and all critical dialogs using Tab/Shift+Tab/Enter/Space only.
- [ ] Modal focus is trapped while open and restored after close.
- [ ] Focus order follows visual order and no control is unreachable.

Record device/OS, screen reader version, tester, result, and defects in the release evidence file.
