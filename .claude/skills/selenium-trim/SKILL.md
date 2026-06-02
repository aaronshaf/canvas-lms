---
name: selenium-trim
description: Consume the CSV produced by selenium-audit and remove the auto-actionable selenium tests. Defaults to dry-run preview; only mutates files when invoked with --apply. Use after running selenium-audit on a directory.
---

# Selenium trim skill

This skill is the downstream half of [[selenium-audit]]. It reads the audit CSV and performs the deletions that meet the auto-action policy. Anything ambiguous goes to a manual-review queue. Anything requiring new test authoring goes to a follow-up doc.

## Inputs

The user supplies either:
- A path to a CSV: `tmp/selenium-audit/<directory>.csv`
- A directory short name: `courses` (resolved to `tmp/selenium-audit/courses.csv`)

If neither is supplied, ask. If the CSV doesn't exist, instruct the user to run `selenium-audit` first.

Optional flags the user may pass:
- `--apply` — perform the deletions and commit. Default is dry-run.
- `--branch <name>` — override default branch name (`selenium-trim/<directory>`).
- `--no-commit` — apply the edits but don't commit. Engineer commits manually.
- `--run-dir <root>` — root for reading the audit CSV and writing the
  preview/manual-review/follow-up artifacts. Defaults to `tmp`. The
  `selenium-pipeline` always passes this (e.g. `tmp/selenium-runs/courses_20260602-141530`);
  replace the leading `tmp` in every artifact path below with `<root>` so concurrent
  or repeated runs never clobber each other.

## Action policy (auto vs. manual)

Built from the `(verdict, confidence)` combinations the audit CSV produces:

| Verdict | HIGH | MEDIUM | LOW |
|---|---|---|---|
| `DELETE_SKIPPED` | **AUTO-DELETE** | manual | manual |
| `DELETE_COVERED` | **AUTO-DELETE** | manual | skip |
| `KEEP` | no action | flag for review | n/a |
| `PARTIAL` | n/a | n/a | follow-up task |
| `WRITE_NEW` | n/a | n/a | follow-up task |

**AUTO-DELETE** = the skill removes the `it` block from the selenium spec file.

This skill never deletes a test without verified equivalent coverage. There is no "trivial test, just delete it" shortcut — that judgment is the engineer's to make during `WRITE_NEW` triage. The audit CSV's `auditor_note` column carries hints (e.g. "trivial rendering — recommend accept loss") so the engineer can rubber-stamp the obvious ones quickly, but the deletion decision is theirs, not the skill's.

**KEEP, PARTIAL, WRITE_NEW are never deleted by this skill.** PARTIAL and WRITE_NEW become entries in `follow_up.md` (grouped by `auditor_note` so the engineer can batch the rubber-stamp cases). KEEP is silent (HIGH) or flagged for review (MEDIUM).

## Outputs

In dry-run mode (default):
- `tmp/selenium-trim/<directory>.preview.md` — a per-file summary of what would be deleted, the resulting diff size, and any `describe`/`context` blocks that would become empty after deletion.
- `tmp/selenium-trim/<directory>.manual_review.csv` — rows from the audit CSV that need engineer attention (any non-HIGH on a DELETE verdict, plus KEEP/MEDIUM rows).
- `tmp/selenium-trim/<directory>.follow_up.md` — PARTIAL and WRITE_NEW rows formatted as a checklist with file:line refs and suggested target paths.
- No file mutations. No git activity.

In `--apply` mode:
- All of the above, plus:
- One commit per selenium spec file in branch `selenium-trim/<directory>` (created if not present, checked out).
- After each commit, run the cited lower-level test for any `DELETE_COVERED` rows in that commit. If a cited test no longer passes, revert the commit and surface the failure.
- Final summary printed: N deletions committed across M files, P follow-ups queued, Q rows for manual review.

## Workflow

### 1. Preconditions

- Fail with a clear message if the CSV doesn't exist.
- Fail if the CSV header doesn't match the 10-column schema expected from [[selenium-audit]]. Don't silently accept older 9-column variants.
- Fail if the git working tree is dirty (uncommitted changes). The engineer should commit or stash first. The check is `git status --porcelain` — empty output means clean.
- In `--apply` mode, also check that the current branch is not `master`/`main`. Either we're on an existing `selenium-trim/<directory>` branch (resume), or we'll create one (fresh start).

### 2. Parse and partition the CSV

Read the 11 columns. Partition rows into action buckets:

```
auto_delete = [rows where confidence == HIGH and verdict in {DELETE_SKIPPED, DELETE_COVERED}]
manual_review = [rows where verdict in {DELETE_*, KEEP} and not in auto_delete]
follow_up = [rows where verdict in {PARTIAL, WRITE_NEW}]
silent = [rows where verdict == KEEP and confidence == HIGH]
```

For each `DELETE_COVERED` HIGH row, re-verify the citation (same check as audit step 4b: file exists, `path:line` is in bounds). This is paranoia, not redundant — the audit may have been run weeks ago and the cited test may have moved. Rows that fail re-verification get moved to `manual_review`.

### 3. Build the deletion plan

Group `auto_delete` rows by their `file` column. For each spec file, produce a deletion plan:

```
file: spec/selenium/courses/course_settings_spec.rb
deletions:
  - line 32: it "shows unused tabs to teachers"
  - line 49: it "shows the course name"
  - line 56: it "shows the course alt name if it exists"
  ...
```

Sort deletions within each file by line number **descending** — this is critical. Removing the lowest-line `it` first shifts every subsequent line number, breaking later targets. Always delete from bottom up.

### 4. Dry-run output

Write `tmp/selenium-trim/<directory>.preview.md`. Per file:

- Number of `it` blocks to remove and their names
- Lines added / removed estimate
- Any `describe`/`context` containers that will be left empty (named explicitly — engineer decides whether to clean up in a follow-up pass)
- Any `let`/`before` blocks at the top of the affected file that are no longer referenced by any remaining `it` (note but don't remove — premature cleanup)

Write `tmp/selenium-trim/<directory>.manual_review.csv` with the same 10-column schema as the input CSV. Engineer can sort, filter, and rerun the audit on these rows after pinning citations.

Write `tmp/selenium-trim/<directory>.follow_up.md` as a markdown checklist. Within each verdict section, group rows by `auditor_note` so the engineer can batch the "rubber-stamp" cases together:

```
## WRITE_NEW (N items)

### Recommend accept loss — N items (rubber-stamp these)

These have an auditor_note suggesting the test isn't worth replacing. Engineer confirms and deletes without authoring equivalent coverage.

- [ ] `spec/selenium/courses/course_settings_spec.rb:32` — shows unused tabs to teachers
      auditor_note: trivial rendering pattern — recommend accept loss
      → Delete it block at spec/selenium/courses/course_settings_spec.rb:32 (no replacement)
- [ ] ...

### Engineer deliberation needed — M items

These have no auditor hint or an "author equivalent" hint. Engineer reads the test and decides whether to write lower-level coverage or accept the loss.

- [ ] `spec/selenium/courses/course_sections_spec.rb:76` — edits the section with empty start and end dates
      → Author controller spec at spec/controllers/sections_controller_spec.rb covering section update with null dates, OR accept loss

## PARTIAL (M items)

- [ ] `spec/selenium/courses/cross_listing_spec.rb:79` — does not allow cross-listing invalid section
      → Extend ui/features/section/react/__tests__/CrosslistForm.test.tsx to cover error-message rendering
```

Stop here if dry-run. Print summary to the user with the path to the preview file.

### 5. Apply mode

If `--apply` was passed:

For each file in the deletion plan, in any order:

1. Read the spec file.
2. For each deletion in that file (sorted line-descending), use Edit to remove the `it` block.
   - Locate the `it` block starting at the cited line.
   - Walk forward in the file matching `do`/`end` block depth — Ruby blocks open with `do` or `{`, close with `end` or `}`. Track depth from 1 (the `it` itself) down to 0 to find the closing `end`.
   - Edit replaces lines `line..closing_end_line` with nothing. Include any trailing blank line that was part of the visual separation.
   - Preserve indentation of surrounding `describe`/`context` blocks — don't accidentally outdent.
3. After all deletions in this file: re-read the file and check for now-empty `describe`/`context` blocks. Note them in the commit message body, but do NOT auto-remove them — that's a follow-up cleanup pass.
4. Stage just this file: `git add <file>`.
5. Commit with a message in this format:

```
Remove N selenium tests covered at lower layers

<file>: deleted N it blocks
- line A: <test name>
- line B: <test name>
...

DELETE_SKIPPED: P (refs RCX-XXXX, INSTUI-YYYY)
DELETE_COVERED: Q (citations: <path:line>, ...)

refs <JIRA key>
flag=none

test plan:
- bin/rspec <cited_coverage_files> still passes
```

Use the Canvas commit-message conventions from CLAUDE.md (60-char lines, JIRA verb). Ask the user for the JIRA key once at the start of apply mode if not provided — it goes on every commit.

6. Run the cited lower-level tests for any `DELETE_COVERED` rows in this commit.

   Maintain a `passed_citations` set across all commits in this apply session.
   Before running a cited spec, check if it is already in `passed_citations` —
   deleting selenium tests cannot affect lower-layer spec results, so a green
   citation from an earlier commit in the same session is still valid. Only
   run specs not already in `passed_citations`.

```
bin/rspec <each unique cited Ruby spec file not in passed_citations>
```

For jest tests (`.test.tsx`/`.test.jsx`/`.test.ts`/`.test.js`):

```
yarn test <each unique cited JS test file not in passed_citations>
```

   Add each spec that passes to `passed_citations`. If any cited test fails:
   `git revert HEAD` and surface the failure to the user with the failing test
   path. Do NOT continue to the next file — bail and let the engineer
   investigate. The whole point of the citation is that it covers the deleted
   behavior; if it's broken, our deletion was unsafe.

7. After all files processed, print summary:

```
Deletions: N tests across M files, all committed
Branch: selenium-trim/<directory>
Manual review queue: P rows → tmp/selenium-trim/<directory>.manual_review.csv
Follow-up authoring work: Q items → tmp/selenium-trim/<directory>.follow_up.md
```

Do NOT push the branch. The engineer reviews locally and opens the PR.

## Safety mechanisms (non-negotiable)

1. **Dry-run by default.** Mutations require explicit `--apply`.
2. **Clean working tree precondition.** Refuse to run if `git status --porcelain` is non-empty.
3. **Bottom-up deletion within a file.** Always delete the highest-line `it` first.
4. **Branch isolation.** Never commit to `master`/`main`. Use `selenium-trim/<directory>`.
5. **One commit per spec file.** Reviewers expect to see one diff per file in the PR.
6. **Run cited tests after each commit.** Citation validity is verified at audit time AND apply time AND post-commit.
7. **Never delete the spec file itself.** Even when all tests are gone, the file stays. File-level cleanup is a separate, human-reviewed step.
8. **Never delete a `describe`/`context` block.** Same reason — if all its `it`s are gone, leave the empty container for human cleanup.
9. **Never remove `let`/`before`/helper methods**, even if they appear unused after deletion. They may be used by shared examples, included contexts, or sibling files via `require`. Cleanup is a separate pass.
10. **Re-verify citations before acting.** The audit CSV may be stale — files move, line numbers shift. Re-check every `DELETE_COVERED` citation in step 2 before committing.

## Anti-patterns

- **Don't bulk-edit.** One file at a time, one commit at a time. Bulk edits are unreviewable.
- **Don't fix up adjacent code.** If a deletion leaves an awkward blank line or an empty `context`, leave it. Polishing the surrounding code mixes mechanical deletion with judgment work and bloats the diff.
- **Don't auto-act on MEDIUM confidence rows even if they look obviously safe.** The whole point of the confidence column is that the auditor flagged them for a reason — bypassing it defeats the audit.
- **Don't silently skip rows that fail re-verification.** Move them to `manual_review.csv` with a clear reason; the engineer needs to see what was rejected and why.
- **Don't push the branch.** Pushing is the engineer's decision after review.
- **Don't run on `spec/selenium/` as a whole.** Process one directory at a time; the audit CSV is per-directory by design.

## Resuming an interrupted run

If `--apply` is invoked again on the same CSV after a previous partial run:
- Check that the current branch is `selenium-trim/<directory>`.
- Skip files that already have a relevant commit on the branch (check `git log --grep "<filename>"`).
- Continue from where the previous run stopped.

This makes the skill safe to re-run after a citation-failure revert — the engineer fixes the underlying issue and re-invokes, picking up the rest of the work.
