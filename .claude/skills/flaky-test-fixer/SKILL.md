---
name: flaky-test-fixer
description: >
  Fix flaky Ruby RSpec tests in Canvas LMS. Classifies failure patterns,
  applies documented fixes from the KB, and drives the full batch workflow.
user-invocable: true
allowed-tools: [Read, Grep, Glob, Bash, Edit, Write, Agent, AskUserQuestion]
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

Use AskUserQuestion: *"Provide the CSV row and failure report MHTMLs
for the next test (or group of related tests)."*

If the user has already provided them in the same message that invoked
the skill, skip the prompt and proceed.

### Phase 2 — Fix

For each test (or group):

1. **Read the failure report(s)** — extract error type, failing line,
   backtrace, Rails log entries, and screenshot observations.
2. **Read the full spec file** — not just the failing line. Check
   `before` blocks, shared contexts, and helper methods.
3. **Classify** using the table below. Read the referenced case file.
4. **Present the root-cause analysis** to the user before implementing.
5. **Implement the fix** following the case's procedure. Tag the test
   with `# flaky-fix: <JIRA>` per S-01 (in `kb/style.md`).
6. **Re-evaluate `custom_timeout`** per S-09 (in `kb/style.md`) if the
   fix changes the test's runtime or the file will be in HEAD.
7. **Check for sibling tests** with the same pattern — fix proactively.
8. **Generate the JIRA comment** as an HTML file per S-02 (in
   `kb/style.md`). Open it in the browser so the user can copy-paste
   into JIRA.

After each test, ask: *"Ready for the next test, or should we move to
review and push?"*

### Phase 3 — Verify

When the user says to push (or after all tests are done):

1. **Pause for review before touching git.** Present a summary of every
   file changed and the nature of each change. Use AskUserQuestion:
   *"Please review the changes above. Any corrections before I commit?"*
   Wait for explicit approval. Do not stage or commit until the user
   confirms.
2. Once approved: `git add` the changed files,
   `git commit --amend --no-edit` (same Change-Id per S-05 in
   `kb/style.md`). Then tell the user:
   *"Committed. Run `git push origin HEAD:refs/for/master` when ready."*
   Do not push autonomously.
3. Use AskUserQuestion: *"Paste the CI run report MHTML when the build
   completes."* (The user downloads the Jenkins build summary page as
   MHTML and provides it as a file path.)
4. Check the report for failures in any fixed test. If found:
   - Read the failure MHTML, diagnose, adjust the fix, re-commit.
5. If clean: note which CI run passed. Need 2 consecutive clean runs
   per process step 5a in `kb/process.md`.

### Phase 4 — Close out

After 2 clean CI runs, execute steps 5a–5d in `kb/process.md`:
update KB cases, verify the lookup tables in `README.md` and
`SKILL.md`, amend the commit message to cover all fixes, push the
final PS, and summarise the batch (tests fixed, patterns used, KB
changes, tests skipped and why).

## Classification

Match the failure report against these signatures. Read the referenced
case file for the full diagnostic procedure and fix pattern.

| Error / Signal | Pattern | Read |
|---|---|---|
| `SpecTimeLimit::Error`, `custom_timeout` too low | Timeout budget | `kb/case_02.md` |
| `SpecTimeLimit::Error` at 60s absolute cap | Cap optimisation | `kb/case_03.md` |
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
