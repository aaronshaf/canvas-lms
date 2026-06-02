---
name: selenium-pipeline
description: Run the full selenium trim pipeline (audit → trim –apply → coverage compare) on a spec/selenium directory. Short names like `courses` are resolved to `spec/selenium/courses` automatically. Collects all upfront inputs in one go, then runs the three stages with a confirmation gate before each destructive step.
---

# Selenium pipeline skill

Runs up to six skills in sequence against a single `spec/selenium/` directory:

1. **[[selenium-audit]]** — classifies every `it` block, produces a CSV
2. **[[selenium-trim]]** dry-run — previews deletions, produces `manual_review.csv`
3. *(optional)* **[[selenium-behavior-extract]]** — extracts behavioral contracts from MANUAL_REVIEW rows
4. *(optional)* **[[selenium-coverage-quality]]** — scores each contract STRONG / WEAK / GAP
5. *(optional)* **[[selenium-gap-filler]]** — writes replacement tests for GAP rows, promotes rows in audit CSV
6. **[[selenium-trim]] `--apply`** — deletes HIGH-confidence rows, commits
7. **[[selenium-coverage-compare]]** — proves deletions caused no net production coverage loss
8. **[[selenium-package]]** — archives all artifacts

The audit step is delegated to the `selenium-audit-batch` sub-agent so its
batch-agent output is isolated from this context window. All other steps run
in this context because they need interactive git operations and background-task
monitoring.

The quality steps (3–5) run **by default**. They analyse what the MANUAL_REVIEW
tests actually assert, find gaps in lower-layer coverage, write replacement tests,
and promote newly-covered rows in the audit CSV so the trim step can delete more.
Set `SELENIUM_SKIP_QUALITY=1` in the environment to skip the quality steps entirely
(useful for quick trim passes on directories where coverage is already well-understood).

## Input

A directory path or short name, supplied as the skill argument:

```
courses                       →  spec/selenium/courses
spec/selenium/courses         →  spec/selenium/courses
announcements                 →  spec/selenium/announcements
```

If no argument is supplied, ask for one.

## Workflow

### Step 1 — Normalise the path

If the argument contains no `/`, prepend `spec/selenium/`.
Verify the directory exists: `test -d <path>` must succeed.
If the directory doesn't exist, stop and tell the user.

### Step 1.5 — Establish a per-run output directory

Each pipeline run gets its own artifact root so repeated runs on the same
directory (or two runs going at once) never clobber each other's CSVs, reports,
or coverage files.

```bash
RUN_SLUG="<dir_name>_$(date +%Y%m%d-%H%M%S)"
RUN_DIR="tmp/selenium-runs/${RUN_SLUG}"
mkdir -p "$RUN_DIR"
```

`RUN_DIR` is a repo-relative path such as `tmp/selenium-runs/courses_20260602-141530`.
Hold this concrete string for the rest of the run — every sub-skill is invoked with
`--run-dir "$RUN_DIR"`, and each writes its artifacts under that root instead of the
bare `tmp/` default. (The Bash tool does not persist env vars between calls, so pass
the literal `RUN_DIR` value on each invocation rather than relying on an exported
variable.)

Tell the user the run directory up front:

```
Run directory: tmp/selenium-runs/<dir>_<timestamp>
  All artifacts for this run land here; prior runs are left untouched.
```

Throughout the rest of this document, any path written as `tmp/selenium-<stage>/…`
means `${RUN_DIR}/selenium-<stage>/…`.

### Step 2 — Upfront precondition checks

> **First time using the skill suite, or after any skill update?**
> Run `/selenium-test --fast` first. It verifies behavior-extract,
> coverage-quality, and gap-filler work end-to-end before you commit to a
> full pipeline run on production data. Takes ~5 min, no Docker needed.

Run ALL of these before asking the user anything. Surface every failure at
once so they can fix them in one go rather than discovering them one by one.

```
git status --porcelain          # must be empty (clean tree)
git branch --show-current       # must not be master/main
git rev-parse --verify master   # master ref must exist
docker compose ps               # web container must be Running
```

If any check fails, list all failures and stop.

Also read the env var that controls quality analysis:

```bash
SKIP_QUALITY=${SELENIUM_SKIP_QUALITY:-0}
```

If `SKIP_QUALITY` is `1`, set `run_quality=false` immediately (skip the
quality question in Step 3 and all of Steps 5.5–5.6) and tell the user:
`Quality analysis disabled via SELENIUM_SKIP_QUALITY=1`. Otherwise default
`run_quality=true`.

### Step 3 — Collect upfront inputs (one question, before any work starts)

If `SELENIUM_SKIP_QUALITY=1` was set, ask only two questions. Otherwise ask
three. Use a single `AskUserQuestion` call so the user answers all at once.

```
Questions:
  1. JIRA key for trim commits (e.g. VICE-1234), or "none"
  2. Base git ref for coverage compare (default: master)
  3. (only when SELENIUM_SKIP_QUALITY is not set)
     Skip quality analysis for this run?
     Quality analysis (behavior-extract → coverage-quality → optional
     gap-filler) runs by default. It analyses MANUAL_REVIEW rows, scores
     existing coverage, and writes replacement tests for gaps.
     Set SELENIUM_SKIP_QUALITY=1 to always skip.
     yes = skip quality / no = run quality (default: no)
```

Record `jira_key`, `base_ref`, and `run_quality` (true unless the user
answered "yes" to skip or `SELENIUM_SKIP_QUALITY=1` was set).

### Step 4 — Audit (sub-agent)

Spawn the `selenium-audit-batch` sub-agent:

```python
Agent(
    description="Selenium audit: <spec_dir>",
    subagent_type="selenium-audit-batch",
    prompt=f"""
Audit this directory: {spec_dir}
Base ref for comparison: {base_ref}
Write all output under this run directory: {RUN_DIR}/selenium-audit/

Follow the selenium-audit-batch agent instructions exactly.
Return the AUDIT_RESULT block when done.
"""
)
```

Parse the `AUDIT_RESULT` block from the agent's return value:
- `csv_path` — path to the CSV
- `auto_delete_count` — how many rows will be acted on automatically
- `top_wins` — the 5 HIGH-confidence deletions to show the user

Display a summary table to the user:

```
Audit complete — spec/selenium/<dir>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total it blocks:    N
  AUTO-DELETE (HIGH): n   ← trim will act on these
  Manual review:      m   ← MEDIUM DELETE + KEEP/MEDIUM
  Follow-up work:     p   ← WRITE_NEW + PARTIAL

  Top quick wins:
    <file>:<line> — <test_name>
    ...
```

**Confirmation gate:** Ask the user whether to proceed with the trim. If
they say no, stop here and point them to the CSV and summary for manual
review. Do not use `AskUserQuestion` for this — a simple "Proceed? (y/n)"
in your response text is fine; wait for the user's next message.

### Step 5 — Trim dry-run (in this context, via Skill tool)

Invoke the `selenium-trim` skill WITHOUT `--apply` (dry-run mode).
Pass the directory name and `--run-dir "$RUN_DIR"`. Also pass the audit CSV path
inside the run dir (`$RUN_DIR/selenium-audit/<dir>.csv`). Provide the JIRA key when
asked.

The trim skill will write (under `$RUN_DIR`):
- `$RUN_DIR/selenium-trim/<dir>.preview.md`
- `$RUN_DIR/selenium-trim/<dir>.manual_review.csv`
- `$RUN_DIR/selenium-trim/<dir>.follow_up.md`

No files are deleted yet. After the dry-run completes, show the user:

```
Dry-run complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  AUTO-DELETE:    N it blocks across M files
  Manual review:  P rows → tmp/selenium-trim/<dir>.manual_review.csv
  Follow-up:      Q items → tmp/selenium-trim/<dir>.follow_up.md
```

If `manual_review.csv` is empty (0 data rows) and `run_quality` is true,
skip Steps 5.5–5.6 and proceed directly to Step 5b.

### Step 5.5 — Quality analysis (optional, runs when run_quality=true)

This step processes the MANUAL_REVIEW rows to determine what each test
actually asserts, score existing lower-layer coverage, and — optionally —
write replacement tests so those rows can be auto-deleted by trim.

Skip this step entirely when `run_quality` is false.

Capture the SHA before any gap-filler commits, so the consolidation step in 5.5c
knows the exact range of commits this run produced:

```bash
quality_start_sha=$(git rev-parse HEAD)
```

#### 5.5a — Behavior extraction

Invoke the `selenium-behavior-extract` skill:

```
selenium-behavior-extract $RUN_DIR/selenium-trim/<dir>.manual_review.csv --run-dir "$RUN_DIR"
```

This reads every `it` block listed in the manual review CSV and extracts a
precise Given/When/Then behavioral contract for each one. Output:
`$RUN_DIR/selenium-behavior/<dir>.behaviors.csv`

#### 5.5b — Coverage quality scoring

Invoke the `selenium-coverage-quality` skill:

```
selenium-coverage-quality <dir> --run-dir "$RUN_DIR"
```

This scores each behavioral contract STRONG / WEAK / GAP by searching for
existing lower-layer tests that assert the same specific outcome. Output:
`$RUN_DIR/selenium-behavior/<dir>.quality.csv`
`$RUN_DIR/selenium-behavior/<dir>.quality.summary.md`

Show the quality summary to the user:

```
Quality analysis complete — <dir>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  STRONG (already covered):    n   ← safe to add to audit CSV as DELETE_COVERED
  WEAK   (extend existing):    n
  GAP / request_spec:          n
  GAP / model_spec:            n
  GAP / component_test:        n
  GAP / keep_selenium:         n   ← will be added to audit CSV as KEEP
```

#### 5.5c — Gap filling

Gap filling always runs on **WEAK rows** (no confirmation needed) and runs
on **GAP rows** after a confirmation gate.

**WEAK rows — always run:**

If the quality CSV shows 0 WEAK rows, skip this sub-step entirely and proceed
directly to the GAP gate.

Otherwise, invoke gap-filler immediately. These already have cited existing spec
files; gap-filler strengthens them from WEAK to STRONG by extending the existing
assertions:

```
selenium-gap-filler <dir> --score WEAK --run-dir "$RUN_DIR"
```

Show the WEAK-pass summary before proceeding to the GAP gate:

```
WEAK → STRONG pass complete — <dir>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Extended (green): n   ← WEAK rows promoted to STRONG
  Extended (red):   n   ← spec files on disk, not committed; manual fix needed
```

**GAP rows — confirmation gate:**

After the WEAK pass, ask: "Run gap-filler to write replacement tests for GAP
rows? This writes and commits new spec files (request specs, model specs,
or component tests) for each actionable GAP. Proceed? (y/n)"

If the user declines, skip to Step 5.6. The STRONG and keep_selenium promotions
still happen in Step 5.6.

If the user proceeds: invoke gap-filler for GAP rows only:

```
selenium-gap-filler <dir> --score GAP --run-dir "$RUN_DIR"
```

The gap-filler will:
- Write new spec files for each GAP row where a lower-layer test is feasible
- Run, lint, and mutation-check each generated test
- Commit each passing spec file with a message explaining which selenium test
  it enables for deletion
- Report keep_selenium rows as confirmed untouchable
- Write `tmp/selenium-behavior/<dir>.gap_report.md`

Show the combined gap-filler summary to the user:

```
Gap filler complete — <dir>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Tests written (green): n   ← these rows will be promoted to DELETE_COVERED
  Tests written (red):   n   ← spec files on disk, not committed; manual fix needed
  Keep selenium:         n   ← these rows will be promoted to KEEP
  Follow-up:             n   ← skipped (component_test layer) — see gap_report.md
```

#### 5.5d — Consolidate gap-filler commits

Gap-filler produces one commit per spec file. A run that fills many gaps can leave
a dozen-plus tiny, near-identical commits, which is noise for a reviewer. Before
the trim commit lands on top, group these into a smaller number of coherent,
reviewable commits.

This runs only if the gap-filler made commits this run
(`git rev-list --count ${quality_start_sha}..HEAD` > 1). Skip if 0 or 1.

**Grouping rules** — balance reviewability against overwhelm:
- **Never mix layers in one commit.** Request specs, model specs, and component
  tests are reviewed by different lenses; keep them in separate commits.
- Within a layer, group by subject area:
  - request specs for the same controller → one commit
  - model specs for related models → one commit
  - component tests for the same feature → one commit
- **Cap each consolidated commit at roughly 8 files or ~400 changed lines.** If a
  group exceeds that, split it by sub-feature rather than producing one giant
  commit. A reviewer should be able to take in each commit in one sitting.
- Don't go the other way either — a layer with three one-file commits for the same
  controller becomes one commit, not three.

**Mechanics** (no interactive rebase — these gap-filler commits are currently at
the tip, so a soft reset is safe):

```bash
git reset --soft ${quality_start_sha}   # all new-spec changes now staged
git reset ${quality_start_sha}          # unstage, keep working-tree changes
# then, per group:
git add <files for this group>
git commit -m "<combined message for the group>"
```

Each consolidated commit keeps the Canvas commit conventions (≤60-char subject,
`refs <jira_key>`, `flag=none`, test plan). The git hook regenerates a Change-Id
per resulting commit. Use `test: cover <layer> for <subject>` as the subject.

Report the consolidation to the user:

```
Commits consolidated — gap-filler
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Before: n one-file commits
  After:  m grouped commits (by layer + subject)
```

Record `quality_end_sha` **after** consolidation:

```bash
quality_end_sha=$(git rev-parse HEAD)
```

This SHA marks the boundary between quality commits (new tests) and trim
commits (test deletions). It is used in Step 5b to squash only the trim commits.
If the gap-filler made no commits, `quality_end_sha` equals `quality_start_sha`.

### Step 5.6 — Promote rows in the audit CSV

This step runs whenever `run_quality` is true, regardless of whether the
gap-filler ran. It updates `tmp/selenium-audit/<dir>.csv` so the trim `--apply`
step in Step 5b can act on newly-covered rows.

**Promotions to apply:**

1. **STRONG rows from quality CSV** → set in audit CSV:
   ```
   verdict    = DELETE_COVERED
   confidence = HIGH
   existing_coverage = <coverage_path>:<coverage_line>
   reason     = "existing lower-layer coverage confirmed by selenium-coverage-quality"
   ```

2. **keep_selenium rows from quality CSV** → set in audit CSV:
   ```
   verdict    = KEEP
   confidence = HIGH
   auditor_note = "confirmed keep_selenium by selenium-coverage-quality: <gap_description>"
   ```

3. **Green gap-filler rows (action_taken=WROTE_NEW, run_result=green)** from
   `tmp/selenium-behavior/<dir>.gap_report.md` → set in audit CSV:
   ```
   verdict    = DELETE_COVERED
   confidence = HIGH
   existing_coverage = <output_path>:<output_line>
   reason     = "replacement test written by selenium-gap-filler"
   ```

Match rows between the quality/gap CSV and the audit CSV by `(file, line)`.
Only update rows that are currently `WRITE_NEW` or `PARTIAL` or
`DELETE_COVERED` with MEDIUM confidence — never overwrite HIGH-confidence rows.

After updating the audit CSV, show the user:

```
Audit CSV promoted — <dir>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Rows upgraded to DELETE_COVERED/HIGH:  n
  Rows upgraded to KEEP/HIGH:            n
  Audit CSV:  tmp/selenium-audit/<dir>.csv
```

These promotions increase the number of AUTO-DELETE rows that trim `--apply`
will act on in the next step.

### Step 5.7 — Post full analysis summary to Jira

If `jira_key` is not "none", post a comment to the Jira ticket now that all
analysis is complete (audit + dry-run + quality + promotions). This is the
definitive pre-deletion record: the ticket gets the full picture of what was
found, what will be deleted, and what new coverage was written before any
Selenium tests are removed.

**Don't block on this.** The Jira comment is a record, not a dependency of the
trim. Fire the `jira_add_comment` call and immediately continue to Step 5b — do
not wait for the network round-trip before starting the trim. Check the result
opportunistically before the final summary (Step 8); if it failed, log the
warning there. Composing the comment body, however, must happen here while the
analysis numbers are in hand.

Use the `jira_add_comment` MCP tool:

```
ticket:  <jira_key>
comment: (formatted below)
```

Comment format:

```
*Selenium pipeline analysis — spec/selenium/<dir_name>*

*Audit results:*
||Verdict||Count||
|AUTO-DELETE (HIGH confidence)|n|
|Manual review|m|
|Follow-up (WRITE_NEW/PARTIAL)|p|
|Total it blocks|N|

*Trim preview (before deletions):*
||Item||Count||
|Tests queued for deletion|n|
|Rows in manual review queue|m|
|Follow-up items|p|
```

If `run_quality` is true, append the quality block:

```
*Quality analysis (MANUAL_REVIEW rows):*
||Score||Count||
|STRONG (already covered)|n|
|WEAK (needs test extension)|n|
|GAP / request_spec|n|
|GAP / component_test|n|
|GAP / keep_selenium (confirmed KEEP)|n|

*Audit CSV promotions:*
||Action||Count||
|Promoted → DELETE_COVERED/HIGH|n|
|Promoted → KEEP/HIGH|n|
|New specs written (green)|n|
```

Always append the artifacts block:

```
*Artifacts (local paths):*
* Audit CSV: {{tmp/selenium-audit/<dir_name>.csv}}
* Manual review: {{tmp/selenium-trim/<dir_name>.manual_review.csv}}
* Follow-up: {{tmp/selenium-trim/<dir_name>.follow_up.md}}
```

If quality ran, also add:

```
* Quality CSV: {{tmp/selenium-behavior/<dir_name>.quality.csv}}
* Gap report: {{tmp/selenium-behavior/<dir_name>.gap_report.md}}
```

Close the comment with:

```
_Posted by selenium-pipeline — no Selenium tests have been deleted yet_
```

If the MCP call fails (ticket not found, no permission), log a warning and
continue — do not stop the pipeline over a Jira comment failure.

### Step 5b — Trim --apply and squash

#### Trim --apply

Invoke the `selenium-trim` skill with `--apply`, the directory name, and
`--run-dir "$RUN_DIR"` (so it reads the promoted audit CSV and writes its
manual-review/follow-up artifacts under the run dir). Provide the JIRA key when
asked.

The trim skill will:
- Create branch `selenium-trim/<directory-name>` if it does not exist
- Delete all HIGH-confidence `it` blocks (including newly-promoted rows), one
  commit per spec file
- Run rubocop autocorrections as needed

After the trim skill completes, show the user:

```
Trim complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Branch:    selenium-trim/<dir>
  Deleted:   N tests across M files  (N commits)
```

#### Squash trim commits

Squash only the trim commits — not the quality/gap-filler commits that preceded
them. The gap-filler commits (new spec files), already consolidated into coherent
per-layer/per-subject groups in Step 5.5d, stay as their own reviewable commits.

**Determine the squash base:**

If quality analysis ran (`run_quality=true`), use `quality_end_sha` as the base.
Otherwise, use `master` as the base.

```bash
# squash_base is either quality_end_sha or the SHA of master
N=$(git log --oneline ${squash_base}..HEAD | wc -l | tr -d ' ')
```

If `N` is 0, nothing was committed by trim — skip and warn.
If `N` is 1, already one commit — skip (nothing to squash).
If `N` > 1, proceed.

```bash
git reset --soft ${squash_base}
```

**Build and create the squash commit:**

Collect data:
- `dir_name` — last path segment of `spec_dir`
- `deleted_total` — total `it` blocks removed by trim
- `files_changed` — `git diff --cached --name-only`
- `skipped_count` — DELETE_COVERED rows that were HIGH confidence
- `pending_count` — DELETE_SKIPPED rows
- `promoted_count` — rows promoted by quality pipeline (Step 5.6), if any
- `jira_key` — from step 3
- `cited_specs` — unique spec files from `existing_coverage` in the audit CSV

Commit message format:

```
selenium: trim spec/selenium/<dir_name>

Remove <deleted_total> HIGH-confidence tests from
spec/selenium/<dir_name> identified by selenium-audit.
All deleted tests have equivalent coverage at the
controller/model/API layer.

DELETE_SKIPPED: <pending_count> (disabled dead code)
DELETE_COVERED: <skipped_count> (verified citations)
Quality-promoted: <promoted_count> (gap-filler coverage)

Files changed:
- <file1>
- <file2>
...

refs <jira_key>
flag=none

test plan:
- bin/rspec <cited_spec_file_1>
- bin/rspec <cited_spec_file_2>
```

Omit the `refs <jira_key>` line when the JIRA key is "none".
Omit `DELETE_SKIPPED`, `DELETE_COVERED`, or `Quality-promoted` lines when
their count is 0.

After the squash commit succeeds, verify with:

```bash
git log --oneline ${squash_base}..HEAD
```

There should be exactly **1** trim commit. Show the user the final commit hash
and subject. Show separately any gap-filler commits that precede it (they are
intentionally not squashed).

**Confirmation gate:** Ask whether to proceed with coverage compare. The
coverage compare runs the changed spec files first (fast path, usually a few
minutes); it only falls back to two full selenium runs (~10–15 minutes) if that
narrowed pass detects potential production coverage loss. If the user declines,
summarise what's been done and stop.

### Step 6 — Coverage compare (in this context, via Skill tool)

Invoke the `selenium-coverage-compare` skill with the spec directory,
`--base <base_ref>` (from step 3), and `--run-dir "$RUN_DIR"`.

The coverage skill will:
- Ensure the selenium hub is running (start if needed)
- Run the changed spec files first (fast path); fall back to the full directory
  only if that pass flags potential production coverage loss
- `docker cp` the resultsets out of the Docker volume
- Run the diff analysis and cross-check against the audit CSV
- Write `$RUN_DIR/selenium-coverage/<dir>/report.md`

### Step 7 — Package and archive (via Skill tool)

After coverage compare completes, invoke the `selenium-package` skill:

```
selenium-package <dir_name> --run-dir "$RUN_DIR"
```

The skill will:
- Discover all artifact files under `$RUN_DIR/selenium-audit/`,
  `$RUN_DIR/selenium-trim/`, `$RUN_DIR/selenium-behavior/`, and
  `$RUN_DIR/selenium-coverage/`
- Prompt the user once (ticket key + destination: jira / path / both)
- Build the named zip and deliver it

The JIRA ticket key to suggest is the `jira_key` collected in step 3.

### Step 8 — Final summary

After all stages (and packaging) complete, print:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SELENIUM PIPELINE COMPLETE — spec/selenium/<dir>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Run directory:     $RUN_DIR
  Audit CSV:         $RUN_DIR/selenium-audit/<dir>.csv
  Trim branch:       selenium-trim/<dir>
  Coverage report:   $RUN_DIR/selenium-coverage/<dir>/report.md

  Commits:           m grouped gap-filler commits + 1 trim commit
  Tests deleted:     N (HIGH confidence, squashed into 1 trim commit)
  Coverage verdict:  <verdict line from report>
```

If the quality pipeline ran, also print:

```
  Quality artifacts:
    Behaviors:  $RUN_DIR/selenium-behavior/<dir>.behaviors.csv
    Quality:    $RUN_DIR/selenium-behavior/<dir>.quality.csv
    Gap report: $RUN_DIR/selenium-behavior/<dir>.gap_report.md

  Quality results:
    Rows promoted → DELETE_COVERED:  n
    Rows promoted → KEEP:            n
    New specs written (green):       n
    Remaining follow-up (WEAK/GAP):  n  → gap_report.md
```

Always print next steps:

```
  Next steps:
  1. Verify cited and new specs still pass locally:
       bin/rspec <cited_spec_files>
       yarn test <component_test_files>
  2. Review the commit list — gap-filler commits are grouped by layer +
     subject, with the trim deletion as its own commit:
       git log --oneline master..HEAD
  3. Push the trim branch for review (use gerrit-commit for the commit,
     then push with the Jira ticket as the Gerrit topic):
       /gerrit-commit
       git push origin HEAD:refs/for/master%topic=<jira_key>
     (omit %topic= when jira_key is "none")
  4. Triage remaining follow-up work:
       $RUN_DIR/selenium-trim/<dir>.follow_up.md    (Q items)
       $RUN_DIR/selenium-behavior/<dir>.gap_report.md (red/skipped gaps)
  5. Manual review queue:
       $RUN_DIR/selenium-trim/<dir>.manual_review.csv (P rows)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Error handling

| Situation | Action |
|---|---|
| Audit agent returns no `AUDIT_RESULT` block | Surface raw output, stop |
| `auto_delete_count` is 0 | Tell the user, offer to stop or continue to quality analysis |
| `manual_review.csv` is empty | Skip Steps 5.5–5.6, proceed to trim --apply |
| behavior-extract produces no rows | Warn user, skip coverage-quality and gap-filler |
| gap-filler has all tests failing | Surface errors, skip Step 5.6 promotions, continue to trim |
| Trim exits non-zero | Surface the error, do not proceed to coverage |
| Coverage pipeline script fails mid-run | Show the partial log, note which run failed |
| User declines any confirmation gate | Summarise completed stages, stop cleanly |

## Resuming an interrupted pipeline

Because each run gets its own `RUN_DIR` (Step 1.5), resuming means continuing the
**existing** run directory rather than starting a fresh one. Find the most recent
run dir for the target directory and reuse it:

```bash
RUN_DIR=$(ls -dt tmp/selenium-runs/<dir>_* 2>/dev/null | head -1)
```

If none exists, start fresh (Step 1.5). Confirm the chosen `RUN_DIR` with the user
before reusing it — a different run may be the one they meant.

If a previous run partially completed (trim branch exists, artifacts exist under
the chosen `RUN_DIR`):

- Skip re-running any stage whose output already exists in that run dir:
  - Audit: `test -f $RUN_DIR/selenium-audit/<dir>.csv`
  - Behaviors: `test -f $RUN_DIR/selenium-behavior/<dir>.behaviors.csv`
  - Quality: `test -f $RUN_DIR/selenium-behavior/<dir>.quality.csv`
  - Trim dry-run: `test -f $RUN_DIR/selenium-trim/<dir>.manual_review.csv`
  - Gap report: `test -f $RUN_DIR/selenium-behavior/<dir>.gap_report.md`
  - Trim + squash: `git log --oneline selenium-trim/<dir> ^master` has
    exactly **1** trim commit (subject starts with `selenium: trim`)
  - Coverage: `test -f $RUN_DIR/selenium-coverage/<dir>/report.md`
- Ask the user which stages to re-run rather than silently skipping.
- When resuming after a partial quality run, re-derive the commit boundary as the
  parent of the trim commit (the gap-filler commits sit below it):
  `quality_end_sha=$(git rev-parse selenium-trim/<dir>~1)` if a trim commit exists,
  otherwise `quality_end_sha=$(git rev-parse HEAD)`.
