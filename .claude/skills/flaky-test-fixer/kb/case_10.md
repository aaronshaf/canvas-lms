# KB Case 10 — Mixed `fireEvent`/`userEvent` on `CanvasAsyncSelect` (QE-149)

## Context

Two tests in the `CreateCourseModal` suite interact with a `CanvasAsyncSelect`
account picker. Both mixed `fireEvent.click` (no focus events) to open the
dropdown with `user.click` (full pointer/focus/blur simulation) to select an
option — a pattern that is stable locally but flaky in CI.

Affected tests:
- `CreateCourseModal (1) > disables the create button without a subject name
  and account`
  (`ui/shared/create-course-modal/react/__tests__/CreateCourseModal1.test.jsx`)
- `CreateCourseModal (2) > with enhanced_course_creation_picker FF ON >
  homeroom endpoint is called only for accounts in viewableAccountIds`
  (`ui/shared/create-course-modal/react/__tests__/CreateCourseModal2.test.jsx`)

---

## Symptoms

**CreateCourseModal1:** Timeout after 5000ms with:
```
expect(element).not.toBeDisabled()
```
The Create button remained disabled even after selecting an account and typing
a subject name.

**CreateCourseModal2:** Timeout after 20000ms with:
```
expect(received).toBe(expected)
Expected: true
Received: false
```
`homeroomRequestedForAccount4` never flipped to `true` — the homeroom endpoint
was never called.

Both failures are timing/ordering flakes: they pass 100% of the time locally
and fail intermittently in CI (slow workers).

---

## Root causes

### Primary — mixed event simulation creates a focus/blur race

`CanvasAsyncSelect` (from `@instructure/platform-instui-bindings`) is a
controlled component with distinct handlers:

- `re` — fires on `onChange` of the underlying `TextInput`; calls
  `onInputChange` and re-opens the dropdown when the user types.
- `Ee` — fires when an option is selected; sets `isShowingOptions(false)`,
  sets the display announcement, and calls `onOptionSelected`.
- `Se` — fires on `onRequestHideOptions`; sets `isShowingOptions(false)`.
- `be` — fires on blur; clears the input in **uncontrolled** mode only.

`@instructure/ui-select` chains `onBlur` with `onRequestHideOptions`, so when
the input loses focus, `Se` fires and the dropdown is hidden.

The mixed-event sequence:

```
fireEvent.click(input)     // opens dropdown — no pointerdown, no focus event
user.click(option)         // fires full sequence:
                           //   pointerdown → focus(option) → blur(input) → Se()
                           //   → setIsShowingOptions(false)
                           //   → options potentially unmount before pointerup/click
```

In a fast local environment React batches or schedules the unmount after the
full click sequence completes. Under CI load the unmount can race ahead of the
`pointerup` / `click` events, so `Ee` (the option-selected handler) never
fires. The option is never selected, and all downstream state changes that
depend on it are never triggered.

Using `await user.click` consistently for both interactions fires the full
event sequence for the open step too, so focus state is correct before the
option click starts and the race does not arise.

### Secondary — homerooms re-fetch shared `setLoading` (pre-existing, already fixed)

Before commit `0ee736f9ddb`, both `useFetchApi` hooks in
`CreateCourseModal.tsx` (accounts fetch and homerooms fetch) called the same
`setLoading` setter. Selecting an account triggered a homerooms re-fetch which
called `setLoading(true)`, disabling the Create button again until the homerooms
fetch completed. In CI with slow network responses this could keep the button
disabled long enough to exceed the 5000ms timeout.

The component fix (`0ee736f9ddb`) decoupled them:
```ts
// before — both shared setLoading
const [loading, setLoading] = useState(false)

// after — homerooms get their own setter; Create button is only gated on accounts loading
const [loading, setLoading] = useState(false)
const [, setHomeroomsLoading] = useState(false)
// homerooms useFetchApi now passes loading: setHomeroomsLoading
```

The test flakiness surfaced the component bug; the component bug was already
fixed before the test fix was written.

---

## Fix

**In both test files:**
1. Replace `fireEvent.click(input)` with `await user.click(accountSelect)` so
   focus events fire correctly before the option click.
2. After `await user.click(option)`, add an explicit
   `await waitFor(() => expect(accountSelect).toHaveValue('ACCOUNT_NAME'))` to
   confirm the selection registered in the controlled input value before
   asserting downstream effects.
3. Remove inflated `{timeout: 5000}` / `{timeout: 20000}` workarounds — these
   masked the underlying race and are no longer needed.
4. Remove unused `getByText` from render destructuring (CreateCourseModal1).

**CreateCourseModal1 — before:**
```js
fireEvent.click(getByLabelText('Which account will this subject be associated with?'))
await user.click(await screen.findByText('Elementary'))
await waitFor(() => expect(createButton).not.toBeDisabled(), {timeout: 5000})
```

**CreateCourseModal1 — after:**
```js
const accountSelect = getByLabelText('Which account will this subject be associated with?')
await user.click(accountSelect)
await user.click(await screen.findByText('Elementary'))
await waitFor(() => expect(accountSelect).toHaveValue('Elementary'))
expect(createButton).not.toBeDisabled()
```

**CreateCourseModal2 — before:**
```js
fireEvent.click(getByLabelText('Which account will this subject be associated with?'))
await user.click(await screen.findByText('CPMS'))
await user.click(getByLabelText('Sync enrollments...'))
await waitFor(() => expect(homeroomRequestedForAccount4).toBe(true), {timeout: 20000})
```

**CreateCourseModal2 — after:**
```js
const accountSelect = getByLabelText('Which account will this subject be associated with?')
await user.click(accountSelect)
await user.click(await screen.findByText('CPMS'))
await waitFor(() => expect(accountSelect).toHaveValue('CPMS'))
await user.click(getByLabelText('Sync enrollments...'))
await waitFor(() => expect(homeroomRequestedForAccount4).toBe(true))
```

---

## Why the explicit `waitFor` for input value

After `user.click(option)`, `Ee` calls `onOptionSelected`, which in the
component calls `setSelectedAccount` and `setAccountSearchTerm`. These are
React state updates — they are batched and applied asynchronously. Without an
explicit wait, the next interaction (clicking the homeroom sync toggle) or the
final assertion may execute before React has re-rendered with the new state.

The `waitFor(() => expect(accountSelect).toHaveValue('ACCOUNT_NAME'))` check
waits for the controlled `inputValue` prop to reflect the selection, which only
happens after the component re-renders with the new `accountSearchTerm` state.
This ensures the selection is fully committed before proceeding.

---

## Core rules

> **Always use `await user.click` consistently** when interacting with
> `CanvasAsyncSelect`. Never mix `fireEvent.click` for the open step with
> `user.click` for the select step — the missing focus events from `fireEvent`
> leave focus state incorrect and create a blur/unmount race when the option
> is clicked.

> **Confirm controlled selection with `waitFor` on the input value** before
> asserting downstream effects (button state, API calls, child interactions).
> `Ee` (the option-selected handler) updates state asynchronously; wait for the
> `inputValue` prop to reflect the selection before proceeding.

> **Remove inflated timeouts** (`{timeout: 5000}`, `{timeout: 20000}`) that
> were masking the race. After fixing the event sequence, the default timeout
> is sufficient.

---

## Approaches that do not work

| Approach | Why it fails |
|---|---|
| `fireEvent.click` to open + `user.click` to select | `fireEvent` fires no focus events; blur on the option click hides options before `Ee` fires in slow CI. |
| Inflated `waitFor` timeout (5s, 20s) | Masks the race; still fails if the mounted options unmount before the click registers. |
| Removing the explicit `waitFor` after selection | Next interaction/assertion may run before React re-renders with new state from `onOptionSelected`. |

---

## Files affected (QE-149)

- `ui/shared/create-course-modal/react/__tests__/CreateCourseModal1.test.jsx`
  — replaced `fireEvent.click` open with `await user.click`; added
  `waitFor` for input value; removed inflated timeout and unused `getByText`.
- `ui/shared/create-course-modal/react/__tests__/CreateCourseModal2.test.jsx`
  — same pattern; also added `waitFor` for input value before homeroom sync
  toggle click.

---

## Validation

Both tests pass 100% on 8+ local runs. Test runtime dropped from relying on
inflated timeouts to ~450–470ms per test.
