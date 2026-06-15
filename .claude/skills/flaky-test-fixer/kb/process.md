# Flaky Test Fixer — Process

Step-by-step workflow for a flaky test fix batch, from ticket creation
through KB update. Each batch is tracked by a single JIRA ticket and
shipped as a single Gerrit patch set (S-05).

---

## 1. Create the JIRA ticket

Create a ticket (e.g. QE-142) to track the batch. The ticket accumulates
fix descriptions as HTML comments (S-02) as tests are resolved. No special
template — Gerrit-JIRA integration automatically links patch sets as long
as the commit message mentions the ticket number (e.g. `refs QE-142`).

## 2. Select tests from the flaky leaderboard

Source: [Jenkins Flaky Test Ranking](https://103443579803.observeinc.com/workspace/41863084/worksheet/43099426)
(rolling 30-day window).

Pick 5–6 tests from the top of the ranking. If a test ends up split or the
fix affects multiple sibling tests, pick fewer. The goal is to keep the
patch set humanly reviewable.

Selection criteria:
- High `flaky_fails` count (signal strength)
- `credibility: 1High` and `freshness: 1High` (recent, real failures)
- `is_fixed: 3Low` (not already addressed)
- Failure data available (CI reports with error details)

## 3. Gather failure data for each test

For each test, collect:

**CSV row** — copy the row from the Ranking worksheet. Key fields:
`testcase_uniquename`, `build_fails`, `flaky_fails`, `latest_spec_location`,
`drill_down_url`.

**Failure MHTMLs** — follow this path to download 3 failure reports:

1. Click the `drill_down_url` from the Ranking row → opens
   [Jenkins Flaky Test Breakdown](https://103443579803.observeinc.com/workspace/41863084/worksheet/43099789)
   filtered for the specific test.
2. Each row in the Breakdown corresponds to a Jenkins run where the test
   failed. Key columns: `spec_location` (test line at the time of the run)
   and `parent_build_url` (link to the Jenkins run summary).
3. Open the `parent_build_url` → search for the `spec_location` text →
   the match highlights the link to the specific test failure page.
4. Open that test failure page and download it as MHTML.
5. Repeat for 2–3 separate runs for pattern diversity.

Three reports reveal whether the failure pattern is consistent or varies.

## 4. Analyse and fix (per test)

### 4a. Read the spec and failure reports

- Read the full spec file (not just the failing line)
- Read the `before` blocks and context nesting — they run inside the timer
- Read the page object helpers used by the test
- Read all 3 MHTMLs to extract: error type, failing line, backtrace, timing

### 4b. Classify the failure pattern

| Error type | Likely pattern | KB reference |
|---|---|---|
| `SpecTimeLimit::Error` | Under-set timeout or test too slow | Case 02, Case 03 |
| `NoSuchElementError` after refresh | Deferred AJAX miss | Case 04 Pattern B/D |
| `RuntimeError` from JS console | CDP artifact | Case 04 Pattern A |
| `ExpectationNotMetError` (wrong value) | DB ordering / global state | Case 04 Pattern C, Case 12 |
| "expected X but nothing was raised" | Global state contamination | Case 12 |
| `NoSuchElementError` on AJAX-loaded content | JS init race or browser cache | Case 06 |
| Error in `prepend_before` / `after` hook | Previous test left browser state | Case 07 |
| Multiple tests always fail together | Shared environment variable | Case 12, Case 06 (env) |
| `RuntimeError: Don't know how to build task` (all tests) | Conditional task loading with stale guard | Case 08 |

### 4c. Implement the fix locally

- Apply the appropriate pattern from the KB to the working tree
- Tag the test with `# flaky-fix: <JIRA>` (S-01)
- Preserve all original assertions (S-03, S-04)
- Proactively fix sibling tests with the same pattern
- Do not stage or commit yet — the user reviews the analysis and diffs
  together before approving

### 4d. Critically review every change for actual value

Before staging, review each change in the fix and ask: **does this change
directly address the identified root cause?** Drop any change that does not.

- A change that saves 2 s of DB setup does not help when the root cause is
  a 10 s Chrome script timeout — the two are independent.
- A refactor from `before` to `before(:once)` is not a flaky fix unless the
  per-test data creation is itself the source of the flakiness.
- A `custom_timeout` bump is not a fix for a race condition.

Every line in the diff should be traceable to the root cause. If it is not,
remove it — cosmetic improvements and "while we're here" refactors dilute
the patch, complicate review, and risk introducing new issues.

### 4e. Push once the user approves, then generate JIRA comment

Each test fix is pushed to the PS before moving to the next test.
The user has already reviewed the analysis and diffs (4c–4d). Once they
approve:

- `git add` the changed files
- `git commit --amend --no-edit` (or with updated message) — same Change-Id (S-05)
- `git push origin HEAD:refs/for/master`
- Generate an HTML file for the JIRA comment (S-02) covering:
  test location/stats, error signature, root cause, fix applied (with
  PS reference), and fallback if insufficient.

Then move to the next test (back to 4a).

## 5. Close out the batch

### 5a. CI verification

After all tests in the batch are fixed and pushed, verify in CI.
Run at least 2 consecutive clean CI builds with no flaky failures on
any of the fixed tests.

Check the PS CI run for failures of any fixed test. The Jenkins summary
report page (same format as the Breakdown `parent_build_url`) is used to
search for reoffending tests.

- If the test fails: download the MHTML, diagnose, adjust, push again
- If the MHTML does not contain enough information to diagnose, add
  temporary diagnostic logging (S-07) and push again. Read the diagnostic
  output from the next failure's MHTML, then remove the logging.
- If the test passes: move to the next test
- Also check for new failures in the same spec file — a fix can introduce
  flakiness in sibling tests (e.g. a `before(:once)` creating shared data)

### 5b. Update the KB

Review each fix against the existing case files:
- **(a)** Already represented → no change
- **(b)** Requires update → amend the existing case
- **(c)** Similar to existing pattern → add as a new pattern in the
  existing case file
- **(d)** New category → create a new `case_NN.md`

Update `style.md` if new conventions emerged during the batch.

Push KB changes to the same PS.

### 5c. Verify lookup tables

Cross-check the classification tables in `SKILL.md` and the failure-mechanism
lookup in `kb/README.md` against the active case files (`kb/case_*.md`):

1. List all active case files and their patterns/sub-patterns.
2. Verify every case and sub-pattern has a row in **both** tables.
3. Verify every row references a case file that exists (not archived or
   renamed during a rebase).
4. Add missing entries; remove stale ones.

These tables are the primary entry point for classification. A missing row
means the skill falls back to first-principles investigation for a pattern
that already has a documented fix — wasting time and risking a worse result.

### 5d. Submit for review

The PS is ready for code review and merge. Standard team review process.
