# Workout recommendation logic, in plain language

The recommendation system is meant to save taps during a workout. It does not try to be a full coaching AI. It uses recent local history and optional targets to fill in sensible defaults, then gives a small next-time suggestion when the workout is finished.

## Smart defaults before a set

When an exercise is selected, `getSmartExerciseDefaults(exerciseId)` chooses defaults in this order:

1. **Recent history**: if the exercise has completed local sets from the most recent finished workout, reuse those reps and weights as the next suggested sets.
2. **Saved target**: if there is no history but the user saved optional targets, use the saved target set count, rep range, increment, and deload percentage.
3. **Starter default**: if there is no history and no saved target, use 3 sets, 8-12 reps, 5 lb jumps, and a 10% deload value.

The live screen shows the source as `Recent history`, `Saved target`, or `Starter default` so a reviewer can understand why a value appeared.

## One-tap logging

The current-set card displays the values that will be saved. The quick buttons mutate the same `reps` and `weight` state used by the parser, so pressing **Done** logs exactly what is on the screen.

The manual input fields are still present as a fallback. They use the same state and the same `addSet()` path as the one-tap button.

## Optional targets

Targets are per exercise and intentionally optional:

- target set count
- rep min
- rep max
- weight increment
- deload percentage

Saving targets changes future suggestions for that exercise only. Logging still works when the reviewer never opens or edits this card.

## Finish-workout guidance

When the workout is completed, the app groups the current local sets by exercise and compares each exercise against the latest completed local history for that same movement.

The pure rule engine in `progression-service.ts` returns one of three decisions:

| Decision | Plain-language rule |
| --- | --- |
| `increase` | If all target sets hit the top of the rep range and the user did not mark the effort as max, add the configured weight increment next time and start near the low end of the rep range. |
| `repeat` | If the exercise is progressing but has not earned a bump yet, keep the same weight and keep working inside the rep range. This is also used when max-effort feedback says not to force a jump. |
| `deload` | If reps fall below the rep floor at max effort, or performance drops compared with recent history, reduce weight by the configured deload percentage and rebuild clean sets. |

Estimated one-rep max is shown only as a secondary clue. The main rule remains the rep range plus effort feedback because that is easier to explain and safer to demo.

## Reviewer-friendly examples

- First time bench press: starter default suggests 3 sets of 8 reps at 0 lb so the reviewer can enter a real weight.
- After a completed bench workout: selecting bench again starts from the previous set values.
- If every target set reaches the high end of the rep range: the completion alert recommends increasing next time.
- If the reviewer marks the workout as `Max`: the engine avoids forcing an increase and may recommend repeating or deloading.
