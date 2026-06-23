# KB Case 14 — CanvasAsyncSelect Whack-a-Mole (QE-149 -> QE-165)

## Context

This case documents a **S-16 Outcome B (whack-a-mole)** recurrence of
Case 10 (mixed `fireEvent`/`userEvent` on `CanvasAsyncSelect`). QE-149
fixed two tests in `CreateCourseModal1.test.jsx` and `CreateCourseModal2`,
but missed a third test in `CreateCourseModal1` that used the identical
mixed-event pattern. QE-165 fixed the third occurrence.

---

## Failure signature

```
waitFor timeout on expect(element).not.toBeDisabled()
  at CreateCourseModal1.test.jsx:259
```

The stack terminates in `wait-for.js` then `setup-vitests.tsx` timeout,
confirming a `waitFor` timeout rather than a bare synchronous assertion.

---

## Root cause

Identical to Case 10 / S-11. The test opened the account
`CanvasAsyncSelect` with `fireEvent.click` (fires no focus events) and
then selected an option with `user.click`. Under CI load the input
blur/unmount races ahead of the option-selected handler, so
`accountSearchTerm` never settles to the chosen account name.

The Create button is gated on
`courseName && !loading && selectedAccount?.name === accountSearchTerm`,
so it stays disabled and the `waitFor` times out.

---

## Fix

Same as Case 10 / S-11:

1. Open the select with `await user.click(accountSelect)` instead of
   `fireEvent.click`
2. Add `await waitFor(() => expect(accountSelect).toHaveValue('CS'))`
   to confirm the selection settled
3. Then type the subject name and assert the Create button

---

## Whack-a-mole lesson

QE-149 fixed two named tests but did not `git grep` the whole file for
remaining instances of the `fireEvent.click`-open + `user.click`-select
pattern. The third test in `CreateCourseModal1` used the identical
sequence and re-flaked.

**Rule (now in S-11):** When fixing this pattern, grep the **whole file
and suite** for every `fireEvent.click`-open + `user.click`-select pair
and fix them all in one pass:

```bash
git grep -n "fireEvent.click" -- '*CreateCourseModal*'
```

This is the same principle as Case 04 Pattern B's whack-a-mole trap
(S-16 Outcome B): a failure backtrace names only one call site, but the
same pattern exists at other positions in the test. Fixing only the
backtraced site shifts the flaky failure to the next unguarded instance.

---

## Files affected (QE-165)

- `ui/shared/create-course-modal/react/__tests__/CreateCourseModal1.test.jsx`
  — "shows an error message if subject creation fails": replaced
  `fireEvent.click` open with `await user.click`; added `waitFor` on
  input value before asserting Create button state.

*Introduced: QE-165*
