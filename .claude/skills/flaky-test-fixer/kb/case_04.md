# KB Case 04 — Three Non-Timeout Flaky Patterns (QE-141)

## Context

This case documents three failure patterns encountered in QE-141 that are
unrelated to `SpecTimeLimit::Error`. All three produce consistent-looking
errors that are easy to misdiagnose.

---

## Pattern A — Chrome CDP Session Artifact in Browser Console

### Failure signature

```
RuntimeError: javascript 662:14571 Uncaught Object: Session with given id not found.
```

Raised by Canvas's post-test `check_for_js_errors` hook
(`spec/selenium/common.rb`), not by a test assertion. The test body passes;
only the post-test JS error check fails.

**Stats signature:** moderate `build_fails`, high `flaky_fails`
(ratio ~5:1 to 20:1).

### Root cause

Chrome DevTools Protocol (CDP) logs `Session with given id not found` when a
WebDriver command targets a CDP session that has been invalidated. This
happens when `type_in_tiny(…, clear: true)` calls `switch_editor_views` on
Linux, which removes the TinyMCE iframe from the DOM and replaces it with a
`<textarea>`. The iframe removal invalidates any in-flight CDP session
reference. Chrome logs the error at SEVERE level; Canvas's error checker
raises it as a `RuntimeError`.

The error string does not appear in any Canvas source file. "Uncaught Object"
(not "Uncaught Error") is Chrome's CDP error format. It is identical in
nature to the existing `"NoSuchFrameException"` suppression.

### Fix

Add the string to `browser_errors_we_dont_care_about` in
`spec/selenium/common.rb`:

```ruby
"Session with given id not found" # flaky-fix: QE-141 — Chrome CDP artifact
# from type_in_tiny/switch_editor_views iframe detach. Not a Canvas
# application error.
```

Also add any missing `wait_for_ajaximations` between the tab/section click
that loads the edit form and the first interaction with it — this reduces
the window during which competing browser activity can perturb CDP state.

### Risk of suppression

The suppression is global (all tests). If Canvas application code ever
produces exactly this string through the browser console, it would be
silently swallowed. The string is not in any Canvas source today, making
this unlikely but not impossible. Couple the entry with a JIRA reference
and a note about the long-term fix (redesign `edit_announcement` to use the
TinyMCE JS API — `tinymce.get(id).setContent(…)` — instead of
`switch_editor_views`, eliminating the iframe detach entirely).

### Files affected (QE-141)

- `spec/selenium/common.rb` — suppression entry
- `spec/selenium/admin/admin_settings_announcements_spec.rb:101` and `:128`

---

## Pattern B — Deferred AJAX Miss After `refresh_page`

### Failure signature

```
Selenium::WebDriver::Error::NoSuchElementError:
Unable to locate element: :css, ".fc-content .fc-title"
```

The element fails to appear after `refresh_page`, despite the 5-second
implicit finder timeout.

**Stats signature:** moderate `build_fails`, moderate `flaky_fails` (ratio
~5:1 to 10:1).

### Root cause

`refresh_page` calls `wait_for_new_page_load { driver.navigate.refresh }`,
which ends with a single `wait_for_ajaximations`. FullCalendar (and other
SPA-style widgets) fires its event-fetch AJAX **after** the page initializers
return — the check sees `$.active === 0` and exits before FullCalendar has
started. FullCalendar then fetches and renders events asynchronously; by the
time the next WebDriver command runs, the event tile may not yet be in the
DOM.

The 5-second finder timeout is sometimes insufficient on a loaded CI worker.

### Fix

Add a second `wait_for_ajaximations` immediately after `refresh_page`:

```ruby
refresh_page
wait_for_ajaximations # catches SPA/FullCalendar deferred event-fetch AJAX
element_to_interact_with.click
```

### When to recognise it

Any `refresh_page` or `get` followed directly by an element lookup (no
explicit wait) where the element is rendered by a JavaScript widget that
fetches its own data (FullCalendar, React async components, etc.).

**`ff()` vs `f()` trap (QE-147):** `f()` (find_element) has an implicit
wait up to the finder timeout (5 s) and will wait for the element to
appear. `ff()` (find_elements) returns an **empty array immediately** if
no elements match — it does not wait. A test that uses
`ff(".fc-title").length` after a page load will get 0 if FullCalendar
hasn't rendered yet, even though `f(".fc-title")` would have waited. The
fix is the same: add `wait_for_ajaximations` before the `ff()` call.
This also applies after toggling calendar checkboxes, which trigger
FullCalendar to re-fetch events.

**Whack-a-mole trap (QE-155):** When a test contains multiple page
navigations (`get` + `refresh_page`), each navigation that precedes a
FullCalendar element lookup needs its own `wait_for_ajaximations` guard.
A failure backtrace points at only one call site — the first one to race.
Fixing only that call masks it and shifts the flaky failure to the next
unguarded navigation in the same test. The correct procedure is to scan
the **entire test** for all page navigations and guard each one, not just
the one in the backtrace.

Example (two-navigation test, QE-141 fixed call #2, QE-155 fixed call #1):
```ruby
get "/calendar2"
wait_for_ajaximations   # ← QE-155: guards call #1 below
event_title_on_calendar.click   # call #1

# …edit the event…

refresh_page
wait_for_ajaximations   # ← QE-141: guards call #2 below
event_title_on_calendar.click   # call #2
```

### Files affected (QE-141, QE-147, QE-155)

- `spec/selenium/calendar/calendar2_event_create_spec.rb:377` and `:683`
- `spec/selenium/calendar/calendar2_event_create_spec.rb:645` (QE-147)
- `spec/selenium/calendar/calendar2_event_create_spec.rb:687` (QE-155) — identical pattern to :377/:683 but in the `edit to-do event` context; missed in prior passes

---

## Pattern C — DB Ordering Assumption in Error Message Assertion

### Failure signature

```
RSpec::Expectations::ExpectationNotMetError:
expected MissingSubAssignmentSubmissionError with message matching
  /Submission is missing for SubAssignment 183241 and user 230593/
got MissingSubAssignmentSubmissionError:
  Submission is missing for SubAssignment 183242 and user 230593
```

Right exception class, wrong entity ID in the message.

**Stats signature:** very high `flaky_fails`, low `build_fails`
(ratio ~20:1). PostgreSQL typically returns records in insertion order but
is not obligated to; on rare scheduler conditions it returns them in the
other order.

### Root cause

The code under test iterates an ActiveRecord association with no `ORDER BY`
and raises an error for whichever record it encounters first. The test
hardcodes a specific record's ID in the regex, assuming iteration order
matches creation order. When the DB returns records in the reverse order, the
error message names the other record and the regex fails.

### Fix

Use an alternation regex that matches either of the two known IDs:

```ruby
# BAD — assumes sub_assignment1 is always iterated first
/Submission is missing for SubAssignment #{sub_assignment1.id} and user .../

# GOOD — matches either ID; still rejects an unrelated ID
/Submission is missing for SubAssignment (#{sub_assignment1.id}|#{sub_assignment2.id}) and user .../
```

This is stricter than `/\d+/` (which would match any number) while remaining
order-independent.

### When to use this fix vs fixing the production code

Fix the test (alternation regex) when the specific ID in the error message is
not a meaningful product constraint — i.e. the test only needs to verify that
the error is raised, not which specific record is named first.

Fix the production code (add `.order(:id)`) when consistent error reporting
is a product requirement — e.g. the error message is surfaced to end users
and determinism matters. In that case, document the product motivation in the
commit message, not just "test stability."

### Files affected (QE-141)

- `spec/serializers/checkpoints/sub_assignment_submission_serializer_spec.rb:113`
  and `:122`

---

## Pattern D — AJAX Save Before Next Action or Assertion

### Failure signature

```
RSpec::Expectations::ExpectationNotMetError:
  expected: 8
       got: 4
```

After refreshing the page, only half the modules are expanded despite
clicking "Expand All" before the refresh.

```
Selenium::WebDriver::Error::ElementNotInteractableError:
  element not interactable
```

After clicking Save on a tray, a menu item is not clickable when the
tray is immediately re-opened.

**Stats signature:** very low `build_fails`, high `flaky_fails`
(ratio ~100:1). The AJAX save is fast enough most of the time.

### Root cause

A user action (button click) fires an AJAX POST. The test proceeds
immediately to a downstream action or assertion without waiting for
the POST to complete. Two forms:

**Navigation form:** The test navigates away before the POST commits.
On reload, the server-side state is partially or not saved.

**Re-access form:** The test re-interacts with UI that the POST is
still in the process of updating. The component briefly enters a
loading/re-rendering state, making elements non-interactable or
returning stale values.

`element_exists?`, `be_falsey`, and similar immediate checks do **not**
drain AJAX — they only inspect the current DOM snapshot. An element
disappearing from the DOM (e.g. a tray closing) is not a signal that
the save POST has committed.

### How to recognise it

A button click that triggers a server-side save followed **without
`wait_for_ajaximations`** by any of:
- Navigation (`go_to_modules`, `get`, `refresh_page`)
- Re-opening a menu, tray, or modal that was affected by the save
- An assertion on the persisted state (`element_exists?`, attribute
  checks, `expect(...)`)

In the re-access form the element is **found** by `f()` (implicit wait
fires) but then fails with `ElementNotInteractableError` — the DOM
node exists but the component is still re-rendering after the AJAX.

### Fix

**Rule: place `wait_for_ajaximations` immediately after the triggering
action — before any other action or assertion that expects the effects
of that action.**

```ruby
# BAD — wait placed too late; element_exists? check runs during AJAX
click_save_button
expect(element_exists?(tray_selector)).to be_falsey  # ← runs while AJAX in-flight
wait_for_ajaximations
click_manage_button   # ← may still fail if re-render not done

# GOOD — all downstream checks run after AJAX is settled
click_save_button
wait_for_ajaximations  # drain AJAX immediately after the action
expect(element_exists?(tray_selector)).to be_falsey
click_manage_button
```

```ruby
# Navigation form
expand_all_modules_button.click
wait_for_ajaximations  # persist preference before navigating away
go_to_modules
```

Placing the wait after an intermediate check creates a whack-a-mole
risk: the check itself may race the AJAX and become the new failure
point in a future CI run.

### Difference from Pattern B

Pattern B is about AJAX that fires **during page load** (deferred
widget data fetch). Pattern D is about AJAX that fires **from a user
action** and needs to settle before the test proceeds. Both are fixed
with `wait_for_ajaximations` but the placement differs: Pattern B adds
the wait **after** navigation; Pattern D adds it **before** the next
action or assertion.

### Files affected (QE-142, QE-161)

- `spec/selenium/context_modules_v2/students/course_modules2_student_spec.rb:148`
  and `:170` (proactive)
- `spec/selenium/assignments/assignments_index_assign_to_spec.rb:82`
  (QE-161 — re-access form: ElementNotInteractableError on tray
  re-open after save)
