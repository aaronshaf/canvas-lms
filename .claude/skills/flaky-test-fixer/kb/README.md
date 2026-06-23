# Flaky Test Fixer — Skill Knowledge Base

## Purpose

This folder supports the `flaky-test-fixer` skill. It stores case documents
that record real fixing attempts — successful and unsuccessful — so that the
skill can learn from accumulated experience rather than repeating the same
mistakes.

## Self-Improving Loop

1. Fix a flaky test using the skill and base Claude LLM capabilities.
2. If the fix is successful — no further action needed.
3. If the fix is unsuccessful — help Claude iterate until the test is fixed.
4. Ask Claude to summarize the successful and unsuccessful strategies and the
   lessons learned.
5. Store the summary as a new case document in this folder
   (next sequential file: `case_NN.md`).
6. Ask Claude to regenerate the skill file
   (`.claude/skills/flaky-test-fixer/SKILL.md`) incorporating all case
   files from this folder.
7. The updated skill is ready for the next challenge.

## Rationale

Storing cases separately from the skill file means history is never lost when
the skill is regenerated. Each case documents the full failure sequence and
the root cause, which prevents the same mistake from being made again as new
cases are added.

## Failure-Mechanism Lookup

Use this table to jump to the right case from the error signature.

| Error / Signal | Pattern | Case |
|---|---|---|
| `SpecTimeLimit::Error` with under-set `custom_timeout` | Timeout budget | 02 |
| `SpecTimeLimit::Error` at 60s cap | Cap optimisation | 03 |
| `ScriptTimeoutError` during `get` / page load | Chrome async script timeout | 02 (with_timeouts) |
| `RuntimeError` from JS console (CDP session) | Browser artifact | 04A |
| `NoSuchElementError` after page load / refresh | Deferred AJAX miss | 04B |
| `ExpectationNotMetError` wrong value, DB ordering | DB ordering assumption | 04C |
| `ExpectationNotMetError` after navigate-away | AJAX pref save race | 04D |
| All tests fail together, all retries, varies by worker | Process state contamination | 12 |
| `NoSuchElementError` on AJAX list, zero `Processing by` | JS bundle init race | 06A |
| AJAX list empty despite DB data, `loaded: true` | Browser HTTP cache | 06B |
| Error in `prepend_before` / `after` hook, wrong screenshot | Browser state leak | 07 |
| Test depends on data contract from a pipeline | Pipeline substitution | 01 |
| InstUI portal never mounts (`findByRole` timeout) | rAF starvation | 09 |
| Mixed `fireEvent`/`userEvent` on `CanvasAsyncSelect` | Focus/blur race | 10 |
| Unguarded ref + `isLoading` in observer effect deps | React stuck ref | 11 |
| "expected X but nothing was raised", sibling tests stub the method | Same-file stub leak | 12E |
| `waitFor` timeout, button disabled when `fireEvent.click` fired | Disabled-button click race | 13 |
| `waitFor` timeout on a `CanvasAsyncSelect` test QE-149 already touched | Whack-a-mole (S-16 Outcome B) | 14 |
| `PG::InFailedSqlTransaction` during synchronous worker + browser poll | Thread-unsafe SET ROLE race | 15 |

## Case File Naming

Active cases live in `kb/`. Cases that have been merged into another case
or are no longer actively referenced move to `kb/archive/` — they keep
their original filenames so JIRA and commit references remain valid, but
don't clutter the active listing. The lookup table above only references
active cases.

See `case_01.md` for the reference example of the expected structure
(context, failure sequence, correct fix, core rule, and dictionary of
terms).

## Periodic Review

Every 3–4 batches, review the KB for redundancies and regrouping. Check
whether cases that were filed by JIRA should be merged by failure mechanism.
See the QE-147 session for an example of this review.

## Archiving Cases

When a case is merged into another or heavily rewritten, move the original
to `archive/` rather than editing it in place. This preserves a clean
audit trail — JIRA comments and commit messages that reference the old
case number still find the original content.

**When to archive:**
- A case is consolidated into a broader case (e.g. Cases 05 + 08 →
  Case 12). Archive the originals, create a new numbered case.
- A case is made obsolete by a framework-level fix that eliminates the
  failure class entirely.

**When NOT to archive (edit in place instead):**
- Adding a new pattern to an existing case (e.g. Case 04 Pattern B
  gets the `ff()` vs `f()` note).
- Updating file paths, line numbers, or JIRA references.
- Correcting factual errors.

**Format:** Add a one-line `**Archived:**` header at the top of the
archived file stating where the content was merged to and why, then
preserve the original content below unchanged.

## Style Guidelines

`style.md` captures coding and annotation conventions that apply across all
flaky-fix work — things like how to tag a fixed test with a JIRA reference.
Each rule in that file is numbered (S-01, S-02, …) and cites the JIRA that
introduced it. When adding a new convention, append it to `style.md` rather
than scattering it across case files.
