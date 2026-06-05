# KB Case 09 — InstUI SimpleSelect Listbox Never Mounts (QE-145)

## Context

The `TagAsModal` component uses InstUI's `SimpleSelect` to let users pick an
existing tag. Three tests in
`ui/shared/differentiation-tags/react/TagAsModal/__tests__/TagAsModal.test.tsx`
open the dropdown and read or select an option:

- *renders multi-variant categories as grouped options*
- *calls onCreationSuccess with a single tag group ID without an API call*
  (option "Honors")
- *calls onCreationSuccess with a multi-variant group ID without an API call*
  (option "Variant A")

They were intermittently flaky — roughly 5–20% of cold runs — and the same
flake affects **every** test in the suite that opens a `SimpleSelect`.

---

## Symptom

```
TestingLibraryElementError: Unable to find an accessible element with the role "listbox"
```

Thrown by `await screen.findByRole('listbox')` after opening the select.
Failing runs sit at ~3.25s before throwing — exactly the `asyncUtilTimeout`
(3000ms, configured in `ui/setup-vitests.tsx`). The wait polls for the full
timeout and the listbox never appears.

---

## Root cause — the option-list portal mounts on a `requestAnimationFrame` tick

Opening the select always succeeds — `aria-expanded` flips to `"true"`
synchronously (confirmed 200/200 in a diagnostic). The problem is purely that
the option list (`role="listbox"`) is not in the DOM yet. It renders into a
portal:

```
SimpleSelect → Select → Popover (isShowingContent) → Position → Portal → createPortal(listbox)
```

`@instructure/ui-position` mounts and positions that portal on a
**`requestAnimationFrame` tick**. This was pinpointed by checking listbox
presence immediately after the click at each flush point:

| after click | after microtask | after `act()` | after **one rAF** | after `setTimeout(0)` |
|:-:|:-:|:-:|:-:|:-:|
| absent | absent | absent | **present** | present |

jsdom drives `requestAnimationFrame` with an internal frame timer that is
scheduled **separately from ordinary `setTimeout`/`setInterval`** and is far
more easily starved under CI/host CPU load. RTL's `findBy*` polling (a
`setInterval`) keeps running for the full 3s — so the event loop is alive — yet
the rAF callback that mounts the portal does not fire, and the wait times out.
The same code passes ~88% of cold runs and 100% of warm, in-process runs
(150/150): the signature of a timer-starvation flake, not a logic bug.

---

## The fix — back `requestAnimationFrame` with a `setTimeout(0)` (global, async)

Because this affects every `Select`/`Popover`/`Tooltip` test, the fix lives in
the shared setup, `ui/setup-vitests.tsx`. Replace jsdom's starvable frame timer
with a plain `setTimeout(0)` — a normal macrotask that fires as reliably as
RTL's own `findBy` polling. Crucially this keeps rAF **asynchronous**, so
component timing is unchanged:

```ts
const installRafShim = () => {
  window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 0) as unknown as number) as typeof window.requestAnimationFrame
  window.cancelAnimationFrame = ((id: number) =>
    clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof window.cancelAnimationFrame
}
installRafShim() // module load: a callable baseline, before any component captures rAF
beforeEach(() => {
  // Reinstall ONLY when fake timers are inactive — never clobber a
  // vi.useFakeTimers()-controlled rAF.
  if (!vi.isFakeTimers()) installRafShim()
})
```

Notes on the implementation choices — each one is load-bearing; an earlier
version that skipped them broke CI (see "Coexisting with fake timers" below):

- **Use the wrapped `setTimeout`.** `setup-vitests.tsx` already wraps
  `setTimeout`/`clearTimeout` to track pending timers and to skip callbacks
  after jsdom teardown (`document === undefined`). Routing rAF through it means
  every scheduled frame is tracked, cleared on cleanup, and guarded.
- **Install at module load, not only in `beforeEach`.** This guarantees a
  *callable* baseline before any component (or `vi.useFakeTimers()`) captures
  rAF, so fake-timer save/restore can never restore `undefined` →
  `TypeError: window.cancelAnimationFrame is not a function` on a later unmount.
- **Reinstall each test only when `!vi.isFakeTimers()`.** Unconditionally
  overwriting rAF clobbers a fake-timer-controlled rAF: timer-driven callbacks
  never fire (`onSuccess`/flash `vi.fn()` called 0 times) and rAF/cAF desync
  across fake-timer boundaries. Skipping the reinstall while fake timers are
  active leaves those tests fully in control.
- **Never restore in `afterEach`.** The baseline shim is always callable, so
  there is nothing unsafe to restore to; restoring a captured original risks
  reintroducing the `undefined` case.
- **No reentrancy guard needed.** InstUI's position-tracking loop
  (`addPositionChangeListener.checkPosition`) re-schedules rAF every frame.
  Because the shim is asynchronous, that is a normal `setTimeout` loop (cleared
  on unmount / by the timer-clearing `afterEach`), not unbounded recursion.

### Coexisting with fake timers (the hard part)

The suite has many `vi.useFakeTimers()` tests. A global rAF override that
ignores them fails in CI in two order-dependent ways that **do not reproduce in
isolation** (each surfaced only in full-shard runs):

1. `window.cancelAnimationFrame is not a function` during
   `Dialog.componentWillUnmount` — the override left cAF non-callable across a
   fake-timer restore boundary. Fixed by the always-callable module-load
   baseline.
2. Timer-driven assertions failing with `vi.fn()` "called 0 times" (e.g.
   `CreateOutcomeModal > Mobile`) — the override clobbered the fake rAF the test
   was advancing. Fixed by the `!vi.isFakeTimers()` guard.

The module-load baseline + the `isFakeTimers` guard together make the global
shim coexist with fake-timer tests.

---

## Do NOT make rAF synchronous

The tempting shortcut — run the callback synchronously
(`cb => { cb(0); return 0 }`) — is wrong as a global fix and was reverted after
it broke CI:

- **It changes timing suite-wide.** Components that legitimately rely on rAF
  running on a *later* tick (focus management, measurement, animations) behave
  differently. Observed CI fallout included `OutcomeView`, `FileUpload`
  (webcam), `DiscussionThreadContainer`, `DashboardCard`, and others — ~30
  tests across many shards that have nothing to do with `SimpleSelect`.
- **Unguarded, it stack-overflows.** InstUI's per-frame position-tracking loop
  recurses infinitely under a synchronous rAF
  (`Maximum call stack size exceeded`).

The asynchronous `setTimeout(0)` shim avoids both: it preserves async timing
(so unrelated tests are unaffected) while still firing reliably.

---

## The option-selection mechanics are not load-bearing

Once the portal mounts deterministically, **how** the option is selected does
not affect stability. With the fix active, all four of these passed 80/80
(selecting "Honors", submitting, asserting `onCreationSuccess(101)`):

| Strategy | Result |
|---|---|
| `fireEvent.click(within(listbox).getByRole('option', {name}))` | 80/80 |
| `user.click(within(listbox).getByRole('option', {name}))` | 80/80 |
| `fireEvent.click(await findByText('Honors'))` | 80/80 |
| `user.click(await findByRole('option', {name}))` | 80/80 |

So `within` + `getByRole('option')` + `fireEvent.click` is **not required** for
correctness or stability. Note in particular that `user.click` on an option
works reliably — an earlier theory that `userEvent.click` triggers an InstUI
`FocusRegion` dismissal of the dropdown does **not** reproduce in the current
codebase.

### Recommended test pattern

```ts
await user.click(screen.getByRole('combobox'))          // open
const listbox = await screen.findByRole('listbox')      // wait for the portal root
await user.click(within(listbox).getByRole('option', {name: 'Honors'}))  // select
```

- `findByRole('listbox')` is the most reliable "dropdown is open" anchor: the
  listbox is the portal root, so if it exists, every option exists. Better than
  `findByText(label)`, which resolves to an innermost text `<span>`.
- `getByRole('option', {name})` targets the `<li role="option">` that owns the
  selection handler, not a nested text span.
- `user.click` and `fireEvent.click` are interchangeable here; `user.click` is
  the more idiomatic choice.

---

## Approaches that do not work

| Approach | Why it fails |
|---|---|
| Synchronous rAF shim (`cb => { cb(0) }`), global | Changes component timing suite-wide; breaks ~30 unrelated tests in CI. |
| Synchronous rAF without a reentrancy guard | Stack overflow on position-tracking popovers (`Maximum call stack size exceeded`). |
| Async shim installed **unconditionally** in `beforeEach` | Clobbers `vi.useFakeTimers()`-controlled rAF → timer-driven tests fail (`vi.fn()` "called 0 times"), and rAF/cAF desync → `cancelAnimationFrame is not a function` on unmount. Guard with `!vi.isFakeTimers()` and a module-load baseline. |
| Restoring rAF to the captured original in `afterEach` | If the original was `undefined`, a leaked update hits a non-callable rAF → `is not a function`. Leave an always-callable shim instead. |
| `getByRole('option')` synchronously after opening | The portal has not mounted yet — use an async `findBy*`. |
| Re-opening the select when the listbox is missing | Does not recover — once a process is rAF-starved it stays starved within that run (validated 3/25 still failed). |
| Raising `asyncUtilTimeout` instead of fixing the mount | Treats a starvation stall as mere slowness; brittle and slows every wait. |

---

## Core rules

> **Portal mount timing:** InstUI portals (Select/Popover/Tooltip) mount on a
> `requestAnimationFrame` tick, and jsdom's rAF is starved under load far more
> than ordinary timers. The global `setTimeout(0)`-backed rAF shim in
> `ui/setup-vitests.tsx` makes the tick reliable suite-wide while keeping it
> asynchronous. Do not re-add per-file rAF overrides, and never make rAF
> synchronous.

> **Selecting a `SimpleSelect` option:** open with
> `user.click(getByRole('combobox'))`, wait for the portal with
> `findByRole('listbox')`, then
> `user.click(within(listbox).getByRole('option', {name}))`. The click mechanics
> are not the source of flakiness; the portal mount timing (above) is.

---

## Dictionary of terms

**`SimpleSelect`** — InstUI controlled combobox that renders its option list in
a React portal. The trigger is an `<input role="combobox">`; the open list is a
`<ul role="listbox">` portalled to `document.body`.

**`Position` / `addPositionChangeListener`** — `@instructure/ui-position`
mounts and positions popover content, and tracks the trigger's position with a
`requestAnimationFrame` loop (`checkPosition` re-schedules itself every frame).

**`Portal`** — `@instructure/ui-portal`; renders children into a detached node
via `createPortal`. Reached through `Position`, so its content appears only
after the mounting rAF runs.

**jsdom `requestAnimationFrame`** — Driven by an internal frame timer scheduled
separately from `setTimeout`/`setInterval`, and more easily starved under load.
Replacing it with a `setTimeout(0)`-backed shim removes that fragility.

**`findByRole('listbox')`** — Async query that polls until the
`<ul role="listbox">` portal root appears. The stable "dropdown fully rendered"
gate.

**`asyncUtilTimeout`** — RTL's `findBy*`/`waitFor` timeout, set to 3000ms in
`ui/setup-vitests.tsx`. A starved mounting rAF that exceeds this is what
surfaces as "Unable to find role=listbox".

---

## Files affected (QE-145)

- `ui/setup-vitests.tsx` — global `setTimeout(0)`-backed `requestAnimationFrame`
  / `cancelAnimationFrame` shim in `beforeEach`. The actual fix; resolves
  portal-mount flakes suite-wide.
- `ui/shared/differentiation-tags/react/TagAsModal/__tests__/TagAsModal.test.tsx`
  — the originally-reported flaky suite; passes on the global shim.
- `ui/shared/context-modules/differentiated-modules/react/Item/__tests__/ItemAssignToCard.4.test.tsx`
  — removed its per-file sync-rAF override (redundant; the global shim covers it,
  verified passing without it).
- `ui/shared/context-modules/differentiated-modules/react/Item/peer-review/__tests__/PeerReviewSelector.test.tsx`
  — removed its per-file sync-rAF override (same).

**Intentionally left with their own rAF handling** (the global `ui` setup does
not apply to them):

- `packages/canvas-rce/.../WordCountModal.test.tsx` — `canvas-rce` has its own
  Vitest config and setup, so `ui/setup-vitests.tsx` does not run for it.
- `ui/features/discussion_topics_post/.../ScrollToHighlight.test.js` — uses a
  `MockWindow` whose `requestAnimationFrame` deliberately captures the callback
  for manual invocation; a test harness, not the starvation workaround.

---

## Validation

- Mechanistic: the listbox mount is gated on a rAF tick (flush-step table); the
  shim makes that tick a reliable macrotask instead of a starvable frame timer.
- The originally-flaky `TagAsModal` suite and the two de-overridden files pass
  without per-file overrides.
- The synchronous-global attempt was confirmed to break unrelated suites in CI
  (`OutcomeView`, `FileUpload`, `TopNavigationTools`, …); after switching to the
  async shim those suites pass again (~400 tests across ~15 previously-failing
  suites verified, plus a 1031-test sweep across 134 InstUI-heavy files green).
  Pre-existing failures unrelated to this change (e.g. `TopNavigationTools`,
  which fails on a clean tree due to its own `useFakeTimers` handling) remain
  out of scope.
- A suite-wide rAF change is infrastructure; gate it on a full `yarn test` run.
</content>
