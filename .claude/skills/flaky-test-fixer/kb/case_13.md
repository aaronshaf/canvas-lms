# KB Case 13 — Click on Conditionally-Disabled Button Before Enable

*JIRA: QE-154*

## Context

Two tests in `RubricAssignmentContainer.test.tsx` flaked intermittently:

- `should save a new rubric and display the Rubric title, edit, preview, and remove buttons`
- `should call onRubricChange callback when a new rubric is saved`

Both tests clicked `save-rubric-button` immediately after clicking
`rubric-criterion-save`. The save button starts **disabled** (confirmed by
an adjacent test: `expect(getByTestId('save-rubric-button')).toBeDisabled()`)
and only becomes enabled after the component processes the saved criterion
and updates its validation state.

## Symptoms

- Flaky, not consistently failing
- The `waitFor` at the end of the test times out because the save click
  had no effect
- No error about a missing element; the button existed but was disabled
  when clicked

## Root Cause

`fireEvent.click` is synchronous. After clicking `rubric-criterion-save`,
React queues state updates but has not yet flushed them. The button is still
disabled when the next `fireEvent.click(save-rubric-button)` fires.

In React's synthetic event system, click events dispatched on a `disabled`
button do not propagate to the component's `onClick` handler. The save
operation is never triggered, so the final `waitFor` times out.

The flakiness comes from React's update batching: in local runs the flush
often happens fast enough that the button is enabled by the next
`fireEvent.click`; under CI load it does not.

## Fix

Add `await waitFor(() => expect(button).not.toBeDisabled())` between the
action that enables the button and the click that depends on it being enabled:

```tsx
// BEFORE — fires immediately; button may still be disabled
fireEvent.click(getByTestId('rubric-criterion-save'))
fireEvent.click(getByTestId('save-rubric-button'))   // ← no-op if still disabled

// AFTER — waits for React to process the criterion and enable the button
fireEvent.click(getByTestId('rubric-criterion-save'))
await waitFor(() => expect(getByTestId('save-rubric-button')).not.toBeDisabled())
fireEvent.click(getByTestId('save-rubric-button'))
```

## Why other approaches don't work

| Approach | Problem |
|---|---|
| `await act(() => { fireEvent.click(...) })` | `act` flushes the current batch but criterion-save may schedule multiple async rounds before enabling the button |
| Adding a `waitFor` after the click | Waits for the outcome, not the precondition; the click already had no effect |
| Replacing `fireEvent.click` with `userEvent.click` | Fires real pointer events but still doesn't guarantee the button is enabled at click time |
| Increasing `waitFor` timeout at the end | Masks the problem — the button click never triggered the save, so no amount of waiting helps |

## Files affected

- `ui/shared/rubrics/react/RubricAssignment/__tests__/RubricAssignmentContainer.test.tsx`
  (lines 177, 204 — two independent occurrences of the same pattern)

## Validation

Both tests pass consistently after the fix. The adjacent test that asserts
`save-rubric-button` is initially disabled confirms the pre-condition is
real, not hypothetical.

---

## Follow-up: QE-162 — Same error, deeper root cause

After applying the QE-154 fix the tests continued to flake with the **same
error** (`Unable to find an element by: [data-testid="preview-assignment-rubric-button"]`).
This is an S-16 Outcome B: the first fix was correct but incomplete.

### Why QE-154 was insufficient

The `waitFor` guard ensured the save button was enabled before clicking, so
the save mutation now runs reliably. However, the flash message
`"Rubric saved successfully"` appeared (confirming the mutation completed)
while the preview/edit/remove buttons still never rendered.

The real defect is in `RubricForm/index.tsx`. After the mutation succeeds,
`useSaveRubricForm` calls `handleSaveSuccess` (which sets `savedRubricResponse`)
before the mutation transitions to `isSuccess: true`. A second
`useEffect` in `RubricForm` is responsible for calling `onSaveRubric` and
making those buttons appear:

```ts
useEffect(() => {
  if (saveSuccess && savedRubricResponse) {
    onSaveRubric(savedRubricResponse, updatePointsPossible)
  }
}, [saveSuccess, savedRubricResponse, onSaveRubric])   // ← onSaveRubric is unstable
```

`handleSaveRubric` in `RubricAssignmentContainer` is a plain function (not
wrapped in `useCallback`), so every parent re-render produces a new reference.
A parent re-render arriving between the two mutation-state updates fires the
effect with the new callback reference while `saveSuccess` is still `false`
— a no-op. `onSaveRubric` is never called and the buttons never appear.

### Fix (QE-162)

In `RubricForm/index.tsx`, introduce a `useRef` that tracks the latest
callback and call it through the ref inside the effect. Remove `onSaveRubric`
from the dependency array so the effect only re-runs when the data changes:

```ts
// Added just before the effect
const onSaveRubricRef = useRef(onSaveRubric)
onSaveRubricRef.current = onSaveRubric   // kept in sync on every render

// Effect — ref.current call + onSaveRubric removed from deps
useEffect(() => {
  if (saveSuccess && savedRubricResponse) {
    onSaveRubricRef.current(savedRubricResponse, updatePointsPossible)
  }
}, [saveSuccess, savedRubricResponse])   // ← callback no longer in deps
```

This is the **event-handler ref pattern**: the ref is always fresh (updated
during render), but its identity is stable, so the effect's dep list no
longer changes on every parent render. See **S-17** in `style.md` for the
general rule.

### If still insufficient

Wrap `handleSaveRubric` in `useCallback` in `RubricAssignmentContainer` to
stabilise the reference at the source, eliminating the dependency-change
trigger entirely.

### Additional files affected (QE-162)

- `ui/shared/rubrics/react/RubricForm/index.tsx`
  — `onSaveRubricRef` added; `onSaveRubricRef.current(...)` replaces
    `onSaveRubric(...)`; `onSaveRubric` removed from `useEffect` deps.
- Both `it` blocks retagged `// flaky-fix: QE-154, QE-162`.
