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
Pass the directory name. Provide the JIRA key when asked.

The trim skill will write:
- `tmp/selenium-trim/<dir>.preview.md`
- `tmp/selenium-trim/<dir>.manual_review.csv`
- `tmp/selenium-trim/<dir>.follow_up.md`

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

#### 5.5a — Behavior extraction

Invoke the `selenium-behavior-extract` skill:

```
selenium-behavior-extract tmp/selenium-trim/<dir>.manual_review.csv
```

This reads every `it` block listed in the manual review CSV and extracts a
precise Given/When/Then behavioral contract for each one. Output:
`tmp/selenium-behavior/<dir>.behaviors.csv`

#### 5.5b — Coverage quality scoring

Invoke the `selenium-coverage-quality` skill:

```
selenium-coverage-quality <dir>
```

This scores each behavioral contract STRONG / WEAK / GAP by searching for
existing lower-layer tests that assert the same specific outcome. Output:
`tmp/selenium-behavior/<dir>.quality.csv`
`tmp/selenium-behavior/<dir>.quality.summary.md`

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

#### 5.5c — Gap filling (separate confirmation gate)

**Confirmation gate:** "Run gap-filler to write replacement tests for GAP
rows? This writes and commits new spec files (request specs, model specs,
or component tests) for each actionable GAP. Proceed? (y/n)"

If the user declines, skip to Step 5.6. The STRONG and keep_selenium promotions
still happen in Step 5.6.

If the user proceeds: invoke the `selenium-gap-filler` skill:

```
selenium-gap-filler <dir>
```

The gap-filler will:
- Write new or extended spec files for each GAP row where a lower-layer test
  is feasible
- Run, lint, and mutation-check each generated test
- Commit each passing spec file with a message explaining which selenium test
  it enables for deletion
- Report keep_selenium rows as confirmed untouchable
- Write `tmp/selenium-behavior/<dir>.gap_report.md`

Show the gap-filler summary to the user:

```
Gap filler complete — <dir>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Tests written (green): n   ← these rows will be promoted to DELETE_COVERED
  Tests written (red):   n   ← spec files on disk, not committed; manual fix needed
  Keep selenium:         n   ← these rows will be promoted to KEEP
  Follow-up:             n   ← skipped (component_test layer) — see gap_report.md
```

Record `quality_end_sha`:

```bash
quality_end_sha=$(git rev-parse HEAD)
```

This SHA marks the boundary between quality commits (new tests) and trim
commits (test deletions). It is used in Step 5b to squash only the trim commits.
If the gap-filler made no commits, `quality_end_sha` equals the SHA before
Step 5.5 started.

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

Invoke the `selenium-trim` skill with `--apply` and the directory name.
Provide the JIRA key when asked.

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
them. The quality commits (new spec files) should stay as individual reviewable
commits.

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
coverage compare takes ~10–15 minutes (two full selenium runs). If the user
declines, summarise what's been done and stop.

### Step 6 — Coverage compare (in this context, via Skill tool)

Invoke the `selenium-coverage-compare` skill with the spec directory and
`--base <base_ref>` (from step 3).

The coverage skill will:
- Ensure the selenium hub is running (start if needed)
- Build and `docker cp` a pipeline script that runs both rspec passes and
  the file swap in one background job
- Wait for the task notification
- `docker cp` the resultsets out of the Docker volume
- Run the diff analysis and cross-check against the audit CSV
- Write `tmp/selenium-coverage/<dir>/report.md`

### Step 7 — Package and archive (via Skill tool)

After coverage compare completes, invoke the `selenium-package` skill:

```
selenium-package <dir_name>
```

The skill will:
- Discover all artifact files under `tmp/selenium-audit/`, `tmp/selenium-trim/`,
  `tmp/selenium-behavior/`, and `tmp/selenium-coverage/`
- Prompt the user once (ticket key + destination: jira / path / both)
- Build the named zip and deliver it

The JIRA ticket key to suggest is the `jira_key` collected in step 3.

### Step 8 — Final summary

After all stages (and packaging) complete, print:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SELENIUM PIPELINE COMPLETE — spec/selenium/<dir>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Audit CSV:         tmp/selenium-audit/<dir>.csv
  Trim branch:       selenium-trim/<dir>
  Coverage report:   tmp/selenium-coverage/<dir>/report.md

  Tests deleted:     N (HIGH confidence, squashed into 1 trim commit)
  Coverage verdict:  <verdict line from report>
```

If the quality pipeline ran, also print:

```
  Quality artifacts:
    Behaviors:  tmp/selenium-behavior/<dir>.behaviors.csv
    Quality:    tmp/selenium-behavior/<dir>.quality.csv
    Gap report: tmp/selenium-behavior/<dir>.gap_report.md

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
  2. Push the trim branch for review:
       /gerrit-commit
  3. Triage remaining follow-up work:
       tmp/selenium-trim/<dir>.follow_up.md    (Q items)
       tmp/selenium-behavior/<dir>.gap_report.md (red/skipped gaps)
  4. Manual review queue:
       tmp/selenium-trim/<dir>.manual_review.csv (P rows)
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

If a previous run partially completed (trim branch exists, CSVs exist):

- Skip re-running any stage whose output already exists on the current branch:
  - Audit: `test -f tmp/selenium-audit/<dir>.csv`
  - Behaviors: `test -f tmp/selenium-behavior/<dir>.behaviors.csv`
  - Quality: `test -f tmp/selenium-behavior/<dir>.quality.csv`
  - Trim dry-run: `test -f tmp/selenium-trim/<dir>.manual_review.csv`
  - Gap report: `test -f tmp/selenium-behavior/<dir>.gap_report.md`
  - Trim + squash: `git log --oneline selenium-trim/<dir> ^master` has
    exactly **1** trim commit (subject starts with `selenium: trim`)
  - Coverage: `test -f tmp/selenium-coverage/<dir>/report.md`
- Ask the user which stages to re-run rather than silently skipping.
- When resuming after a partial quality run, re-derive `quality_end_sha`
  from the last gap-filler commit: `git log --oneline --grep="gap-filler" master..HEAD | head -1`
