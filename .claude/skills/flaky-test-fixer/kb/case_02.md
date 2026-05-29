# KB Case 02 — Correcting Under-Set `custom_timeout` in Selenium Tests

## Context

This case documents a systematic investigation into selenium tests that fail
intermittently with `SpecTimeLimit::Error`. The investigation was triggered by
a single highly-flaky test (`quizzes_question_creation_regressions_spec.rb:40`,
168 flaky_fails in 24 h) and expanded to a full corpus analysis using an
Observe flaky-test report. The result is a reproducible formula for setting
`custom_timeout` correctly, and a set of fixes for five under-set tests.

---

## The `custom_timeout` Mechanism

`SpecTimeLimit` (in `spec/support/spec_time_limit.rb`) wraps every example in
`Timeout.timeout`. The timeout value is chosen by priority:

1. **`custom_timeout: N` metadata** on the `it` block → always wins; raises if
   `N > ABSOLUTE_TIMEOUT` (default 60 s).
2. **Files under `spec/selenium/rcs/`** → `SIDEBAR_LOADING_TIMEOUT` (35 s).
3. **Spec file appears in HEAD's changed files** → `TARGET_TIMEOUT` (15 s).
4. **All other existing specs** → `ABSOLUTE_TIMEOUT` (60 s).

The timer covers the **entire example including all `before` hooks**. This is
the most common misunderstanding: developers count only the test body and forget
that shared `before` blocks that navigate pages or wait for the RCE are charged
against the same budget.

---

## Root Cause Pattern

Under-set timeouts cause **intermittent** failures, not consistent ones,
because CI worker load varies. On a lightly-loaded worker the test completes in
28 s and passes; on a loaded worker it takes 33 s and hits the 30 s wall. This
produces the characteristic signature in flaky-test reports:

- Moderate `build_fails` (consistent failures on load spikes)
- High `flaky_fails` (intermittent failures on normal CI load)
- The error is always `SpecTimeLimit::Error: Exceeded the N sec target threshold`

Contrast with **race-condition flakiness** which has 0 `build_fails` and a
varied error message (stale element, element not found, etc.).

---

## The Interaction Cost Model

Derived from calibrating against 7 known-passing tests with measured timeouts.

### Cost table

| Category | Examples | Cost |
|---|---|---|
| **H (Heavy)** | Page nav: `get`, `refresh_page`, `visit_*`, `open_*_form`, `expect_new_page_load` | **6 s each** |
| **H (Heavy)** | RCE/TinyMCE: `type_in_tiny`, `wait_for_rce`, `set_answer_comment`, `set_question_comment` | **6 s each** |
| **M (Medium)** | AJAX: `wait_for_ajaximations`, `wait_for_ajax_requests` | **2 s each** |
| **M (Medium)** | Submit/dialog: `submit_form`, `submit_dialog`, explicit save-button click | **2 s each** |
| **ignored** | DOM ops: `.click`, `f()`, `replace_content`, `send_keys`, assertions | 0 |

### Formula

```
minimum_timeout = max(20,  H×6 + M×2 + 5)
```

Round up to the nearest 5. Cap at 60 (system max). If result > 60, split the
test.

The `+5` is fixed overhead: Selenium driver handshake, cookie setup, initial
DOM settle.

### DB-bulk amendment

For tests that create **25+ records in the test body** (not in `before(:once)`),
add `1H` per 25 records. Those DB operations contend with other CI processes and
add measurable latency before the first browser interaction.

### React-form amendment

For tests that make **10+ sequential `replace_content(tab_out: true)` calls**
on React-driven date/time inputs (e.g. checkpoint assign-to cards, module item
tray), add **1H per 5 such calls** (rounded up). Each tab-out triggers a React
re-render and validation cycle on the surrounding form; in aggregate these
consume real CI time that the formula's "ignored DOM ops" classification misses.

Identifying signals:
- Page uses the "assign-to cards" component with checkpoints enabled (4 date
  fields per card instead of the standard 2)
- Test calls helpers like `update_reply_to_topic_date`, `update_required_replies_date`,
  `update_available_date`, `update_until_date` from `items_assign_to_tray.rb`
- Total `replace_content` calls in the test body ≥ 10

### Validation table

| Test | H | M | React-form adj | Formula | Actual set | Verdict |
|---|---|---|---|---|---|---|
| educator dashboard routing | 1 | 1 | — | 13 → 20 | 25 | ✓ conservative |
| assignment edit — submission limit | 1 | 2 | — | 15 → 20 | 25 | ✓ conservative |
| quiz question banks — inherited | 1 | 8 | — | 27 → 30 | 30 | ✓ exact |
| assignment edit — peer review toggles | 2 | 6 | — | 29 → 30 | 60 | ✓ safe margin |
| **quiz variety (original, with comments)** | **14** | **6** | — | **101 → cap** | **30** | **✗ severe** |
| **quiz variety (fixed, no comments)** | **9** | **6** | — | **71 → 60** | **60** | **✓ fixed** |
| **assignment edit — reset PR fields** | **4** | **11** | — | **51 → 55** | **30** | **✗ severe** |
| **quiz take — late submission** | **4** | **1** | — | **31 → 35** | **30** | **✗ marginal** |
| **discussions — required replies input (initial)** | **5** | **4** | — | **43 → 45** | **45** | **✗ still fails** |
| **discussions — required replies input (corrected)** | **5** | **4** | **+2H (10 calls)** | **55 → 60** | **60** | **✓ fixed** |
| **quiz question banks — paginated move** | **4** | **3** | — | **35 → 40** | **30** | **✗ marginal** |

(Bold rows = under-set; H for the question-banks test includes +2H for 102 bulk
DB creates. The discussions test M=4 counts both save-button clicks and both
section-warning-continue clicks; the React-form +2H covers 10 `replace_content`
calls in round 1, with 6 more in round 2 not yet reached at timeout.)

---

## Case Examples

### Case A — `quizzes_question_creation_regressions_spec.rb:40`
`custom_timeout: 30` → **168 flaky_fails, 21 build_fails**

The `before` block calls `start_quiz_question`, which internally calls
`open_quiz_edit_form` (1 nav + 1 `wait_for_rce`) and two more `wait_for_rce`
calls. That alone is **4H = 24 s** of heavy interactions before the test body
starts.

The test body then calls `create_multiple_choice_question`, which contains 5
RCE interactions that are **not asserted by this test** — they exist because the
same helper is reused by `quizzes_question_creation_spec.rb`, which does verify
comments. Those 5 extra H interactions added **+30 s to the budget** while
contributing zero coverage to the variety test.

**Fix (two-part):**
1. Added `with_comments: true` option to `create_multiple_choice_question` in
   `quizzes_common.rb`. Defaults to `true` so existing callers are unaffected.
2. Called `create_multiple_choice_question(with_comments: false)` in the
   regressions spec and raised `custom_timeout: 30` to `custom_timeout: 60`.

**Key lesson:** A shared helper that does more than a particular test asserts is
a hidden time tax. The fix is to parameterise the helper, not to raise the
timeout to absorb the waste.

---

### Case B — `assignment_edit_spec.rb:499`
`custom_timeout: 30` → **39 flaky_fails**

The test visits the assignments new-page, fills a complex peer-review form,
saves (page load), then visits the edit page **twice more** — once to disable
peer reviews and once to re-enable them and verify defaults reset. Three page
navigations plus a `expect_new_page_load` save gives H=4; ten explicit
`wait_for_ajaximations` calls give M=10+.

Formula: `4×6 + 11×2 + 5 = 51 → 55 s`. The test was at 30 s — **nearly half
the required budget**.

**Fix:** `custom_timeout: 30` → `custom_timeout: 55`.

---

### Case C — `quizzes_take_quiz_student_spec.rb:43`
`custom_timeout: 30` → **22 flaky_fails**

The test calls three helpers that each navigate to a different page:
`begin_quiz` (quiz show + quiz take = 2H), `open_student_quiz_submission`
(submission page = 1H), `open_quiz_in_speedgrader` (SpeedGrader = 1H). The
SpeedGrader page is one of the heaviest in Canvas (React bundle + submissions
list). Four page navigations with a single AJAX wait gives H=4, M=1.

Formula: `4×6 + 1×2 + 5 = 31 → 35 s`. Set at 30 s with no room for variance.
Bumped to 40 s to account for the known SpeedGrader load weight.

**Fix:** `custom_timeout: 30` → `custom_timeout: 40`.

---

### Case D — `discussions_edit_page_spec.rb:1162`
**No `custom_timeout`** → **62 flaky_fails, 3 build_fails**

No annotation at all. When the spec file appears in a HEAD commit (e.g. because
an unrelated test in the same file was modified), the system assigns
`TARGET_TIMEOUT = 15 s`, which is impossible for a test with 5H. This explains
the `build_fails` — consistent failures on any run where the file is marked
as modified.

The test creates a graded discussion with checkpoints enabled, sets 4 date/time
fields in an assign-to card (reply-to-topic date/time, required-replies date/time,
available-from date/time, until date/time), saves, re-opens the edit page, and
updates all 4 dates again before saving a second time. The page nav count is H=5
(`get` new discussion, `type_in_tiny`, `wait_for_new_page_load` after first save,
`get` edit page, `wait_for_new_page_load` after second save). The save interactions
are M=4 (two `save_button.click` + two `section_warning_continue_button.click`).

**Initial (incorrect) fix:** Added `custom_timeout: 45`.

This matched the base formula (5×6 + 4×2 + 5 = 43 → 45 s) but **still failed**
in CI. The failure happened at `update_required_replies_date` on line 1240 —
the 3rd date field in the second editing round — confirming the test genuinely
needed more than 45 s.

**Root cause of underestimate:** The base formula treats all `replace_content`
calls as free (0 s). This test makes 16 `replace_content(tab_out: true)` calls
across two editing rounds on a checkpoint-enabled discussions page. Each tab-out
triggers a React re-render and validation cycle across the checkpoint assign-to
card (which renders 4 date fields instead of the standard 2). Collectively these
16 calls consumed ≈15 s that the formula did not account for.

Applying the React-form amendment (+1H per 5 `replace_content` calls):
16 calls → +4H. But since only 10 calls completed before the timeout, the
conservative application is +2H (10 calls / 5 = 2):
`(5+2)×6 + 4×2 + 5 = 55 → 60 s` — which is exactly the system cap.

**Corrected fix:** `custom_timeout: 45` → `custom_timeout: 60`.

**Warning:** 60 s is the system maximum. If this test flakes again at the cap on
very loaded workers, the only remaining option is splitting it: separate the
"create discussion and assert" phase from the "re-open edit page, update dates,
assert" phase into two independent `it` blocks.

---

### Case E — `quizzes_question_banks_spec.rb:337`
`custom_timeout: 30` → **97 flaky_fails, 9 build_fails**

Formula without DB adjustment: H=2, M=3 → 23 s (within budget). Formula with
DB adjustment: the test creates 51 assessment questions and 51 quiz questions
inline (102 total records) before any browser step. 102 / 25 → +2H.
H=4, M=3 → 35 s, tight against the 30 s wall.

Additionally, the test depends on `.more_questions_link` rendering correctly
after a single `wait_for_ajaximations` following a click on an item in a
paginated list — a potential race condition that the timeout increase alone will
not fully resolve. The timeout fix eliminates the timer as one source of
flakiness; the race condition may warrant a separate investigation.

**Fix:** `custom_timeout: 30` → `custom_timeout: 40`.

---

## The Correct Fix Procedure

1. **Confirm the error type.** Only `SpecTimeLimit::Error` in the failure log
   indicates a timeout issue. `Selenium::WebDriver::Error::StaleElementReference`
   or `Capybara::ElementNotFound` point to a different cause.

2. **Count H and M across the full example**, including all `before` hooks in
   scope. Watch especially for `before` hooks that call page-navigating helpers
   like `open_quiz_edit_form` or `visit_assignments_index_page`.

3. **Apply the formula:**
   ```
   minimum_timeout = max(20,  H×6 + M×2 + 5)
   ```
   Add 1H per 25 in-test bulk DB creates. Add 1H per 5 `replace_content(tab_out: true)`
   calls if the test exercises checkpoint-enabled or React-intensive assign-to tray
   pages (signals: helpers from `items_assign_to_tray.rb`, 10+ total date/time field
   fills). Round up to nearest 5. Cap at 60.

4. **If result > 60:** look for unnecessary interactions first. Specifically:
   - Shared helpers may contain RCE interactions (`set_answer_comment`,
     `set_question_comment`, `type_in_tiny`) that this particular test does not
     assert. Parameterise the helper (e.g. `with_comments: false`) before
     raising the timeout.
   - If interactions cannot be removed, split the test.

5. **If result ≤ 60:** update `custom_timeout`. If there was no `custom_timeout`
   annotation at all, add one.

---

## The Core Rule

> Every RCE/TinyMCE interaction costs as much as a full page navigation — treat
> them identically in the time budget.

The most common mistake is to see `set_answer_comment` or `type_in_tiny` as
"just typing" and ignore it. Each call waits for TinyMCE to fully initialise,
which takes 3–5 s on a CI worker — the same as a full page load. Five such
calls in `create_multiple_choice_question` added the equivalent of five extra
page loads to a test that was already at its limit.

The second most common mistake is forgetting that `before` hooks run inside the
timer. A `before` block that calls `open_quiz_edit_form` or
`start_quiz_question` can easily account for 15–25 s before the test body
starts.

---

## Unsuccessful Approaches (what not to do)

| Approach | Why it fails |
|---|---|
| Raise `custom_timeout` without analysing the interaction count | Masks the real problem; may still fail on heavy load, or the new value may exceed ABSOLUTE_TIMEOUT |
| Remove `custom_timeout` entirely | Falls back to TARGET_TIMEOUT (15 s) when the spec file is in HEAD, causing consistent failures |
| Reduce interactions without checking which are asserted | Can delete coverage silently if the removed calls affect persisted data that downstream assertions check |
| Counting only `it` block lines, ignoring `before` hooks | The most common calibration error; before hooks with `open_*_form` helpers can consume half the budget before line 1 of the test |
| Setting `custom_timeout` exactly at the formula result for React-heavy pages | The base formula treats all `replace_content` as free. On checkpoint-enabled discussion/assignment pages, 10+ `replace_content(tab_out: true)` calls collectively consume 10–15 s through React re-renders. The formula minimum is also the failure threshold on any loaded worker. Apply the React-form amendment (+1H per 5 such calls) before finalising the value. |

---

## Dictionary of Terms

**`SpecTimeLimit`** — `spec/support/spec_time_limit.rb`. Wraps each RSpec
example in `Timeout.timeout`. The timeout value is determined by metadata
priority: `custom_timeout:` > `rcs/` file default > HEAD-commit TARGET_TIMEOUT
> ABSOLUTE_TIMEOUT.

**`custom_timeout: N`** — RSpec metadata key on an `it` block. Sets a hard
wall of `N` seconds for the entire example including before/after hooks.
Maximum value: `ABSOLUTE_TIMEOUT` (default 60 s). Setting this value too low is
the primary cause of the failures documented in this case.

**`TARGET_TIMEOUT`** — 15 s. Applied to any spec whose file appears in the
`git diff-tree` of HEAD. Intended to enforce fast specs on new/modified code.
A test without `custom_timeout` that needs > 15 s will fail every time its
file is in a commit, producing `build_fails` in the flaky report.

**`ABSOLUTE_TIMEOUT`** — 60 s. The ceiling for all specs and the maximum
allowed value for `custom_timeout`. Also the fallback for existing specs that
are not in HEAD's changed files and have no `custom_timeout`.

**`SIDEBAR_LOADING_TIMEOUT`** — 35 s. Applied automatically to all specs under
`spec/selenium/rcs/`. Cannot be overridden by `custom_timeout`.

**H (Heavy interaction)** — Page navigation or RCE/TinyMCE call. Costs 6 s in
the formula. Includes: `get`, `refresh_page`, `visit_*`, `open_*_form`,
`expect_new_page_load`, `wait_for_new_page_load`, `type_in_tiny`, `wait_for_rce`,
`set_answer_comment`, `set_question_comment`.

**M (Medium interaction)** — AJAX wait or form submit. Costs 2 s in the
formula. Includes: `wait_for_ajaximations`, `wait_for_ajax_requests`,
`submit_form`, `submit_dialog`, explicit save/update button clicks.

**DB-bulk amendment** — For tests that create 25+ records in the test body
(before any browser step), add 1H per 25 records. These contend for DB
connections under CI load and add measurable latency that the base formula does
not account for.

**`build_fails`** — In the Observe flaky-test report: the test failed and
continued to fail on retry (consistent failure). For `SpecTimeLimit::Error`,
this occurs when the test is structurally impossible to complete in the allotted
time regardless of load — either because the budget is vastly under-set, or
because the file is in HEAD and gets `TARGET_TIMEOUT = 15 s`.

**`flaky_fails`** — In the Observe flaky-test report: the test failed but
passed on retry (intermittent failure). For `SpecTimeLimit::Error`, this occurs
when the test completes within budget on lightly-loaded workers but not on
loaded ones. The ratio `flaky_fails / build_fails` is typically 5:1 to 20:1 for
timeout-related flakiness.

**`with_comments: false`** — Option added to `QuizzesCommon#create_multiple_choice_question`
to skip the five RCE comment interactions (`set_answer_comment` ×2,
`set_question_comment` ×3) when the calling test does not assert comment content.
Default is `true` to preserve backward compatibility with tests that do verify
comments (e.g. `quizzes_question_creation_spec.rb`).
