# KB Case 03 — Optimizing Tests That Hit the ABSOLUTE_TIMEOUT Cap

## Context

This case documents what to do when the `custom_timeout` formula (Case 02)
produces a value above 60 s and raising the annotation further is impossible
because the framework enforces a hard ceiling.

```ruby
# spec/support/spec_time_limit.rb
ABSOLUTE_TIMEOUT = ENV.fetch("SPEC_TIME_LIMIT_ABSOLUTE", 60).to_i

raise "Custom timeouts cannot exceed #{ABSOLUTE_TIMEOUT} seconds!" \
  if example.metadata[:custom_timeout].to_i > ABSOLUTE_TIMEOUT
```

Setting `custom_timeout: 90` does not give the test 90 seconds — it raises a
`RuntimeError` before the browser even opens. The signal is
`RuntimeError: Custom timeouts cannot exceed 60 seconds!`, not
`SpecTimeLimit::Error`.

The triggering test was `discussions_edit_page_spec.rb:1162`. Its Case 02
formula value reached the 60 s cap, yet the test still failed on loaded CI
workers because the React-form amendment was conservative.

---

## The Three-Step Decision Tree When formula > 60

```
formula > 60?
    │
    ├─ Step 1: Remove unasserted interactions  (see patterns below)
    │          → recalculate; if ≤ 60: done
    │
    ├─ Step 2: Parameterise shared helpers
    │          (see Case 02, Case A for technique)
    │          → recalculate; if ≤ 60: done
    │
    └─ Step 3: Split the test
               (separate create-and-assert from edit-and-assert)
```

Always try Step 1 first — it removes steps the test's own assertions never
verify, so there is no coverage loss.

---

## Pattern 1 — `wait_for_new_page_load` Race Condition

### The antipattern

```ruby
# BAD — bare call after the navigation trigger
save_button.click
section_warning_continue_button.click   # triggers navigation
wait_for_new_page_load                  # sets flag on maybe-new page
```

`wait_for_new_page_load` plants `INST.still_on_old_page = true` on the
current page, then polls until it disappears. If navigation has already
completed before the script runs, the flag lands on the new page and can
never be unset — the poll burns the full finder timeout (~5 s) before
returning false. This happens silently; two occurrences waste up to 10 s.

### The fix

```ruby
# GOOD — flag is planted before navigation fires
save_button.click
expect_new_page_load { section_warning_continue_button.click }
```

### When to recognise it

Any three-line sequence of: action → navigation-trigger → bare
`wait_for_new_page_load` (no block). Grep: `wait_for_new_page_load$`

---

## Pattern 2 — `type_in_tiny` Without an Assertion on the Body

`type_in_tiny` polls for TinyMCE initialisation, switches iframe context,
and types — costing 6 s (H) in the formula. If the test never asserts on
the body content, the call is pure overhead.

### How to verify removal is safe

1. Search the test for any `expect` that reads the typed text or the
   `message` variable.
2. Check a neighbouring test in the same file that saves without
   `type_in_tiny` and succeeds — this confirms the body field is optional.

```ruby
# discussions_edit_page_spec.rb:1552 — saves without body, no type_in_tiny
force_click_native('input[type=checkbox][value="graded"]')
force_click_native('input[type=checkbox][value="checkpoints"]')
wait_for_new_page_load { Discussion.save_button.click }
```

### The fix

Remove the `type_in_tiny` call and leave a comment:
```ruby
# body field is not required by this form — skip type_in_tiny (saves ~6 s)
```

---

## Pattern 3 — Form Fields Filled But Not Asserted

When a test fills many date/time fields but final assertions only check a
subset, fields that appear only in intermediate display checks (done before
the second edit cycle, not in the final DB assertions) can be skipped —
provided omitting them does not violate the form's ordering constraint
(`available_from ≤ due_date ≤ lock_at`).

### Example (discussions_edit_page_spec.rb:1162)

The second edit cycle filled 8 date/time fields but the final DB assertions
only verified `reply_to_topic` and `required_replies`. The `available_from`
and `until` dates were left at their first-save values, which still satisfied
the ordering constraint. Removing 4 field fills saved ~5–8 s.

### How to verify removal is safe

1. Map each filled field to the assertion that checks it.
2. Verify that the unmodified value from the first save still satisfies the
   form's date-ordering validation.
3. Skip the fill only if both conditions hold.

---

## Pattern 4 — Over-Specified Setup

### DB records not referenced in assertions

Every `create!` takes a DB round-trip. Records created for completeness but
never referenced are waste.

```ruby
# BAD — @course_section never used after creation
@course_section   = course.course_sections.create!(name: "section alpha")
@course_section_2 = course.course_sections.create!(name: "section Beta")

# GOOD
@course_section_2 = course.course_sections.create!(name: "section Beta")
```

### Enrolments beyond the minimum needed

One enrolled student in the default section is enough to trigger the
section-warning dialog when the assignment is restricted to a different
section. A second student adds a DB round-trip for zero behavioural
difference.

---

## The Correct Optimisation Procedure

1. Confirm `RuntimeError: Custom timeouts cannot exceed 60 seconds!` — this
   means the cap was exceeded before the test ran. If the error is
   `SpecTimeLimit::Error`, the test ran but timed out; raise `custom_timeout`
   within the 60 s cap instead.

2. Fix any `wait_for_new_page_load` race (Pattern 1). Always safe, always
   correct.

3. Remove unasserted `type_in_tiny` calls (Pattern 2) if body is not tested.

4. Skip form-field fills not covered by final assertions (Pattern 3) if
   ordering constraints remain satisfied.

5. Trim over-specified setup (Pattern 4).

6. Recalculate the Case 02 formula. If ≤ 60, set `custom_timeout` to the
   result. If still > 60, split the test.

---

## Pattern 5 — Test Split with DB Setup (Step 3 in Practice)

When Steps 1–2 are exhausted and the formula still exceeds 60, split the
test. The challenge is reproducing the first cycle's output state via DB
setup so the second test doesn't repeat the slow UI create.

### Technique (discussions_edit_page_spec.rb:1162, QE-142)

The original test did create-save-edit-save in one `it` block (~60s). Split
into:

**Test A (create cycle):** UI create → save → verify DB → open edit page →
verify displayed dates. `custom_timeout: 55`.

**Test B (edit cycle):** DB setup → open edit page → update dates → save →
verify DB. `custom_timeout: 45`.

### DB setup pitfalls learned from QE-142

1. **Do not set `submission_types: "discussion_topic"` on the assignment.**
   The `discussion_topic` creation with `assignment:` wires the association
   naturally. Explicitly setting `submission_types` causes
   `ActiveRecord::RecordNotSaved` in `update_submittable` during the GraphQL
   save mutation.

2. **The UI auto-generates cards you didn't create.** When section-specific
   overrides exist, the edit form renders an "Everyone else" card alongside
   the section card. This changes card indices (card 0 may be "Everyone else",
   not the section card). Delete the unwanted card via UI if it interferes
   with the test's intent.

3. **The frontend controls the section warning, not the DB state.** Setting
   `only_visible_to_overrides: true` in the DB does not prevent the
   "Everyone else" card from appearing. The section warning is triggered by
   the frontend checking whether all course sections are covered by the
   assign-to cards. To trigger the warning, you must delete the "Everyone
   else" card via `click_delete_assign_to_card(0)` — one UI interaction
   (~1s) that restores full coverage parity with the original test.

### When to prefer DB setup over UI setup

DB setup is justified when the UI create cycle costs > 20s and the edit
cycle is the primary behaviour under test. The trade-off: DB setup may not
produce identical state to UI create (as seen with the "Everyone else" card).
Compensate with minimal UI interactions (card deletion) rather than
replicating the full UI flow.

---

## The Core Rule

> When `custom_timeout` is at the 60 s ceiling, the only path forward is to
> make the test genuinely faster — not to raise the value. The audit question
> is: "If I delete this line, which `expect` call would fail?" If the answer
> is "none", the line is a candidate for removal.

---

## Unsuccessful Approaches

| Approach | Why it fails |
|---|---|
| Set `custom_timeout` above 60 | `RuntimeError` before the browser opens |
| Add `wait_for_ajaximations` after React checkbox toggles | React state changes are synchronous re-renders, not jQuery AJAX. `$.active` is 0 immediately; the call adds overhead without solving anything |
| Skip form-field fills without checking ordering constraints | Validation error on save; test fails for a different reason |
| Add `puts` / timing logs for profiling | `RSpec/Output` and `Rails/Output` cops reject them; `Rails/TimeZone` fires on `Time.now` |
