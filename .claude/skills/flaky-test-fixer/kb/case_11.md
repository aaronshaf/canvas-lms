# KB Case 11 — Unguarded ref + `isLoading` in observer effect deps (React)

## Context

One test in the `GradingSchemeUsedLocationsModal` suite intermittently fails
while the rest of the suite passes consistently.

Affected test:
- `UsedLocationsModal > show accounts used locations > should load the page of
  account used locations`
  (`ui/shared/grading-scheme/react/components/__tests__/GradingSchemeUsedLocationsModal.test.tsx`)

The modal loads two independent data sets: course used-locations (via an
`IntersectionObserver` sentinel) and account used-locations (via a direct
`useEffect` call). The test waits for the account items to appear.

---

## Symptoms

```
TestingLibraryElementError: Unable to find an element by:
  [data-testid="used-locations-modal-account-1"]
```

The DOM snapshot at failure time shows:
- The modal is open and the search input is rendered.
- A `<Spinner>` is visible — meaning `isLoading` is still `true`.
- No course items and no account items are present.

This is the component's initial loading state, persisting for the full
`findByTestId` timeout of 1000 ms.

---

## Root causes

### Primary — `fetchingAccountLocations.current` not reset on error

`loadAccountLocations` uses a `useRef(false)` guard to prevent concurrent
calls:

```ts
// UsedLocationsModal.tsx — loadAccountLocations
const loadAccountLocations = useCallback(async () => {
  if (itemId == null || fetchingAccountLocations.current) {
    return                         // ← guard: bail if already fetching
  }
  fetchingAccountLocations.current = true
  try {
    const newLocations = await fetchAccountUsedLocations()
    if (newLocations.accountUsedLocations) {
      setAccountUsedLocations(newLocations.accountUsedLocations)
    }
    fetchingAccountLocations.current = false   // ← only reset on success
  } catch (error: any) {
    showFlashError(t('Failed to load account used locations'))(error)
    // ← ref is NOT reset here — permanently stuck at true after any error
  }
}, [fetchAccountUsedLocations, itemId])
```

If the fetch throws for any reason (network hiccup, MSW handler miss due to
URL encoding, etc.), the catch block runs `showFlashError` but leaves
`fetchingAccountLocations.current = true`. The account `useEffect` fires on
every re-render (see secondary cause below); every subsequent call hits the
guard and returns early without retrying. `accountUsedLocations` stays `null`
forever.

The same bug exists in `loadMoreCourseLocations` — its `catch` block also
omits resetting `fetchingLocations.current`.

### Secondary — `isLoading` in the IntersectionObserver `useEffect` deps

```ts
// UsedLocationsModal.tsx
useEffect(() => {
  ...
  const timer = setTimeout(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && moreLocationsLeft.current
          && !fetchingLocations.current) {
        loadMoreCourseLocations()
      }
    }, ...)
    observer.observe(sentinelRef.current)
    return () => { observer.disconnect() }
  }, 0)
  return () => clearTimeout(timer)
}, [isLoading, loadMoreCourseLocations, moreLocationsLeft, isOpen])
//  ^^^^^^^^^ triggers full cancel/reschedule on every fetch start/end
```

`isLoading` is derived from the PENDING/COMPLETED status of both the course
and account hooks. Every time a fetch starts or ends, `isLoading` toggles,
the effect cleanup fires `clearTimeout(timer)`, and a new `setTimeout(fn, 0)`
is scheduled. The test's `IntersectionObserver` mock calls its callback
**synchronously** inside `observe()`, so each new timer immediately triggers
`loadMoreCourseLocations()`, which sets course status to PENDING, which
toggles `isLoading` again.

This churn is harmless when both fetches succeed. But it amplifies the window
for a transient fetch failure: the account fetch may fail during one of the
rapid re-render cycles, leave the ref stuck, and be blocked from retrying by
every subsequent call.

---

## Fix

Three targeted changes in `UsedLocationsModal.tsx`:

### 1. Reset `fetchingLocations.current` in the course fetch catch block

```ts
// before
} catch (error: any) {
  showFlashError(t('Failed to load used locations'))(error)
}

// after
} catch (error: any) {
  fetchingLocations.current = false           // ← allow retry after error
  showFlashError(t('Failed to load used locations'))(error)
}
```

### 2. Reset `fetchingAccountLocations.current` in the account fetch catch block

```ts
// before
} catch (error: any) {
  showFlashError(t('Failed to load account used locations'))(error)
}

// after
} catch (error: any) {
  fetchingAccountLocations.current = false    // ← allow retry after error
  showFlashError(t('Failed to load account used locations'))(error)
}
```

### 3. Remove `isLoading` from the observer effect deps

```ts
// before
}, [isLoading, loadMoreCourseLocations, moreLocationsLeft, isOpen])

// after
}, [loadMoreCourseLocations, moreLocationsLeft, isOpen])
```

`isLoading` is not needed here. The observer's only job is to call
`loadMoreCourseLocations()` when the sentinel enters the viewport; it should
recreate only when the callback itself changes or the modal opens/closes.

---

## Why the fix works

| Problem | Fix |
|---|---|
| Transient fetch error permanently blocks all retries | Guard ref reset in catch; next re-render retries the fetch |
| Rapid cancel/reschedule amplifies transient error window | `isLoading` removed from deps; timer lifecycle is stable |
| Course guard had the same latent bug | Same reset added to `loadMoreCourseLocations` catch |

---

## Core rules

> **Always reset a `useRef` "in-progress" guard in `catch` (or `finally`).**
> A guard ref that is only cleared on the success path becomes a permanent
> lock after any error — all future calls bail out at the guard, and the
> operation is silently never retried.

> **Do not list ephemeral loading flags (`isLoading`, `isPending`) in
> `useEffect` deps when their only purpose is to trigger a side effect that
> depends on something else.** Changing them re-runs the effect, cancels
> timers, and rebuilds observers on every fetch transition — unnecessary churn
> that widens the window for race conditions.

---

## Approaches that do not work

| Approach | Why it fails |
|---|---|
| Increasing `findByTestId` timeout | The account fetch is permanently blocked by the stuck ref; no amount of polling time helps. |
| Awaiting course items first in the test | Makes other tests stable but doesn't unblock the guard ref; account items still never appear after the transient error. |
| Adding the ref reset only in the success path | Already the bug — success path already had the reset. Catch path was the missing case. |

---

## Files affected

- `ui/shared/grading-scheme/react/components/UsedLocationsModal.tsx`
  — `fetchingLocations.current = false` added to `loadMoreCourseLocations`
    catch block.
  — `fetchingAccountLocations.current = false` added to `loadAccountLocations`
    catch block.
  — `isLoading` removed from the `IntersectionObserver` `useEffect` deps array.

---

## Validation

All 13 tests in `GradingSchemeUsedLocationsModal.test.tsx` pass after the fix,
including the previously flaky account test.
