---
name: flaky-test-fixer
description: >
  Fix flaky Ruby RSpec tests in Canvas LMS. Classifies failure patterns,
  applies documented fixes from the KB, and drives the full batch workflow.
user-invocable: true
allowed-tools: [Read, Grep, Glob, Bash, Edit, Write, Agent, AskUserQuestion, mcp__atlassian__getJiraIssue, mcp__atlassian__editJiraIssue]
---

## Purpose

Fix flaky Ruby RSpec tests in Canvas LMS by classifying failure patterns
against a knowledge base (KB) of documented cases, applying the appropriate
fix, and driving the full batch workflow — from test selection through
CI verification and KB update. The skill orchestrates the human-in-the-loop
cycle: gathering failure data, implementing fixes, pushing for CI
verification, and capturing learnings for future sessions.

## On invocation

1. Read `kb/process.md` and `kb/style.md` — they define the workflow
   and conventions for every fix batch.
2. Use AskUserQuestion to prompt the user for the **JIRA issue number**
   tracking this batch (e.g. QE-147). All fixes, tags, and comments
   reference this number.
3. Enter the batch loop below. Case files (`kb/case_*.md`) are read
   on-demand during classification — do not load them all upfront.

## Batch loop

Drive the session through these phases. The user may provide multiple
tests at once, group related tests, skip steps they've already done, or
offer observations at any point — adapt naturally. Examples:

- The user notices that 4 tests from the same file always fail together
  and provides all their failure reports at once. Use the "all fail
  together" signal for classification (likely Case 12 — process state
  contamination), investigate the shared root cause, and if confirmed,
  fix and tag all 4 proactively rather than treating them one by one.

### Phase 1 — Gather

Use AskUserQuestion: *"Provide the CSV data values (no header needed)
and failure report MHTMLs for the next test (or group of related tests)."*

The user pastes only the data values — match them positionally to the
column definitions in `kb/process.md` § "Gather failure data" table.

If the user has already provided them in the same message that invoked
the skill, skip the prompt and proceed.

### Phase 2 — Fix

For each test (or group):

1. **Read the failure report(s)** — extract error type, failing line,
   backtrace, Rails log entries, and screenshot observations.
2. **Read the full spec file** — not just the failing line. Check
   `before` blocks, shared contexts, and helper methods.
   If the test already carries a `# flaky-fix:` tag:
   - For each JIRA key in the tag, call `getJiraIssue` and scan the
     Description for a matching `(flaky-fix)` section per S-16.
     This gives the prior root cause, what was tried, and the fallback
     plan — feed this into classification before reading the new failure.
   - Use `AskUserQuestion` to request the detailed breakdown CSV from
     the Observe worksheet. This is mandatory for S-16 — the aggregate
     stats (flaky_fails total) are useless after a prior fix has been
     applied; only the daily timeline reveals whether the prior fix
     helped. **Important:** the breakdown CSV contains only flaky
     failure events (runs where the test failed at least once), not all
     test executions. It is only useful for computing average daily
     flaky failures — not pass rates, total runs, or reliability
     percentages. Build a daily flaky-failure count and compare the
     rate before vs after each prior fix merge date to classify the
     outcome (A/B/C).
3. **Classify** using the table below. Read the referenced case file.
4. **Present the root-cause analysis** to the user before implementing.
5. **Implement the fix locally** following the case's procedure. Tag the
   test with `# flaky-fix: <JIRA>` per S-01 (in `kb/style.md`).
   Apply the changes to the working tree — do not stage or commit yet.
6. **Verify every change addresses the root cause.** For each change
   in the diff, ask: does this directly fix the identified failure
   mechanism? Drop any change that does not — cosmetic refactors,
   marginal optimisations on an unrelated axis, and "while we're here"
   cleanups dilute the patch without reducing flakiness.
7. **Re-evaluate `custom_timeout`** per S-09 (in `kb/style.md`) if the
   fix changes the test's runtime or the file will be in HEAD.
8. **Check for sibling tests** with the same pattern — fix proactively.
   Tag every satellite with `# flaky-fix: <JIRA>` per S-01, including
   tests whose fix lives entirely in the shared example or `before`
   block. Verify all tags before proceeding to step 9.
9. **Show the diff** and use `AskUserQuestion` to explicitly ask the
   user to approve or reject before proceeding. This is a mandatory
   human-in-the-loop gate — call `AskUserQuestion` even in Auto mode.
   Do not proceed to step 10 until the user answers affirmatively.
10. **Once the user approves via `AskUserQuestion`:**

    **a. Commit and push:**
    `git add` the changed files, `git commit --amend --no-edit`
    (same Change-Id per S-05), push to Gerrit.

    **b. Capture the PS number** from the push output. Gerrit prints
    the change URL in the push response:
    `remote: https://gerrit.instructure.com/c/canvas-lms/+/NNNNN`
    Extract NNNNN — this is the PS number for the "Fix applied" field.

    **c. Post to Jira** using the MCP workflow from S-02. Compose the
    `(flaky-fix)` section from the data already in session context:

    | Field | Source |
    |---|---|
    | `it` description | read from the spec file in step 2 |
    | Spec path | from the CSV row / failure report |
    | Stats | from the CSV row provided in Phase 1 |
    | Satellite-fixes | from step 8 (sibling tests fixed) |
    | Error | from the failure report (MHTML error line) |
    | Prior fixes (S-16) | from step 2 (if `# flaky-fix:` tag existed) |
    | Root cause | from the analysis in steps 3–4 |
    | Fix applied (PS NNNNN) | from the analysis + PS number from step b |
    | If insufficient | from the analysis |

    Then follow the S-02 workflow: `getJiraIssue` → scan for existing
    section → append or replace → `editJiraIssue`.

    **d. If the MCP call fails** (tools unavailable or auth error):
    follow the first-time setup instructions in S-02, then retry.
    Do not fall back to HTML files.

Each test fix is pushed to the PS before moving to the next test.
After pushing and posting to Jira, ask: *"Ready for the next test?"*

### Phase 3 — Close out

The user decides when to end the batch. The 5–6 unique-case guideline
in `kb/process.md` is a soft starting point, not a hard cap. When
counting cases for the summary, count only **unique primary cases** —
satellites (same shared example in a different context, sibling tests
with the same pattern) and skipped/deferred tests do not count.

After all tests are fixed, execute steps 5a–5d in `kb/process.md`:
verify CI (2 consecutive clean runs), update KB cases, verify the
lookup tables in `README.md` and `SKILL.md`, amend the commit message
to cover all fixes, push the final PS, and summarise the batch (tests
fixed, patterns used, KB changes, tests skipped and why).

## Classification

Match the failure report against these signatures. Read the referenced
case file for the full diagnostic procedure and fix pattern.

| Error / Signal | Pattern | Read |
|---|---|---|
| `SpecTimeLimit::Error`, `custom_timeout` too low | Timeout budget | `kb/case_02.md` |
| `SpecTimeLimit::Error` at 60s absolute cap | Cap optimisation | `kb/case_03.md` |
| `ScriptTimeoutError` during `get` / page load | Chrome async script timeout | `kb/case_02.md` (with_timeouts) |
| `RuntimeError` from JS console (CDP / session) | Browser artifact | `kb/case_04.md` Pattern A |
| `NoSuchElementError` after page load / refresh | Deferred AJAX miss | `kb/case_04.md` Pattern B |
| `ExpectationNotMetError`, wrong value from DB | DB ordering assumption | `kb/case_04.md` Pattern C |
| `ExpectationNotMetError` after navigate-away | AJAX pref save race | `kb/case_04.md` Pattern D |
| All tests fail together, all retries, varies by worker | Process state contamination | `kb/case_12.md` |
| `NoSuchElementError` on AJAX list, no `Processing by` | JS bundle init race | `kb/case_06.md` Pattern A |
| AJAX list empty despite DB data, `loaded: true` | Browser HTTP cache | `kb/case_06.md` Pattern B |
| Error in `prepend_before`/`after`, wrong screenshot | Browser state leak | `kb/case_07.md` |
| Data contract violation in pipeline output | Pipeline substitution | `kb/case_01.md` |
| InstUI portal never mounts (`findByRole` timeout) | rAF starvation | `kb/case_09.md` |
| Mixed `fireEvent`/`userEvent` on `CanvasAsyncSelect` | Focus/blur race | `kb/case_10.md` |
| Unguarded ref + `isLoading` in observer effect deps | React stuck ref | `kb/case_11.md` |
| "expected X but nothing was raised", sibling tests stub the method | Same-file stub leak | `kb/case_12.md` Pattern E |
| `waitFor` timeout, button disabled when `fireEvent.click` fired | Disabled-button click race | `kb/case_13.md` |
| `PG::InFailedSqlTransaction` during synchronous worker + browser poll | Thread-unsafe SET ROLE race | `kb/case_15.md` |

If no signature matches, investigate from first principles using the
failure report MHTMLs and spec file. After fixing, decide whether to
create a new case file or add a pattern to an existing one (see
`kb/README.md` step 5b criteria).

## Model guidance

Start the session on **Sonnet** (default). If classification matches a
known pattern in the table above, Sonnet is sufficient for applying the
documented fix.

If the failure doesn't match any known pattern and requires deep
investigation (reading multiple files, tracing call chains, analysing
backtraces across gems), suggest:
*"This is an unfamiliar pattern — recommend switching to Opus
(`/model opus`) for the investigation."*

**Before switching back to Sonnet** after fixing an unfamiliar case,
materialise all learnings to files first:
1. Generate the JIRA comment HTML (S-02)
2. Write or update the KB case file (process step 5b)
3. Only then suggest: *"Learnings captured. You can switch back to
   Sonnet (`/model sonnet`) for the next test."*

Why: context compaction summarises older messages to make room. A long
Opus investigation accumulates detail that compaction will discard.
Writing the case file and JIRA comment while the full context is live
preserves the high-fidelity diagnosis. After that, even if compaction
occurs on switch-back, the knowledge is safely in the KB.

## Key conventions (quick reference)

- **S-01** — `# flaky-fix: QE-NNN` inline on the `it` line
- **S-03/S-04** — Preserve all original assertions
- **S-05** — One Gerrit PS per JIRA, amend with same Change-Id
- **S-09** — Recalculate `custom_timeout` after adding waits
- **S-12** — Fix state contamination at the source, not the victim

Full conventions: `kb/style.md`
