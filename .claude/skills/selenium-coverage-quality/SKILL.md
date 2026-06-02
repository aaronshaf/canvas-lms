---
name: selenium-coverage-quality
description: Score assertion-level coverage quality for Selenium behavioral contracts extracted by selenium-behavior-extract. For each Given/When/Then contract, finds existing lower-layer tests and classifies coverage as STRONG, WEAK, or GAP. Output CSV drives selenium-gap-filler.
---

# Selenium coverage quality skill

[[selenium-behavior-extract]] produces a CSV of behavioral contracts — what each Selenium `it`
block actually asserts, in plain language, with the route and actor identified.

This skill scores whether existing lower-layer tests (request specs, model specs, component tests)
cover each contract at the **assertion level**, not the file level. The critical distinction:
a request spec for `GradesController#show` exists does NOT mean coverage is STRONG. Coverage is
STRONG only when the spec asserts the specific outcome the Selenium test verifies.

## Coverage scoring

Three scores, applied per behavioral contract row:

| Score | Meaning |
|---|---|
| `STRONG` | A lower-layer test makes the same HTTP call (or equivalent), with the same actor role, and explicitly asserts the specific outcome from the `then` column. |
| `WEAK` | A lower-layer test hits the same route and actor, but assertions are under-specified: checks status only, checks different fields, or checks presence without value. |
| `GAP` | No test covers this (route + actor + assertion) combination. |

A Selenium test is **safe to delete** only when every assertion in its `then` column maps to a
STRONG lower-layer test. One WEAK or GAP blocks deletion.

## Inputs

The user supplies a behaviors CSV path: `tmp/selenium-behavior/grades.behaviors.csv`
or a short name: `grades` (resolved to `tmp/selenium-behavior/grades.behaviors.csv`).

If not supplied, ask. If the CSV doesn't exist, instruct the user to run
`selenium-behavior-extract` first.

## Output root

Outputs default to `tmp/`. When invoked with `--run-dir <root>` (the
`selenium-pipeline` always passes this), replace the leading `tmp` in every output
path below with `<root>`, and read the behaviors CSV from the same root, so
concurrent or repeated runs never clobber each other.

## Output

`tmp/selenium-behavior/<name>.quality.csv`

Extends the behaviors CSV with five new columns:

```
file,line,test_name,given,when,then,controller_route,classification,complexity,extract_notes,
coverage_score,coverage_path,coverage_line,gap_description,recommended_layer
```

New columns:
- `coverage_score` — `STRONG` / `WEAK` / `GAP`
- `coverage_path` — repo-relative path to the best matching lower-layer test. Required for
  STRONG and WEAK. Empty for GAP.
- `coverage_line` — line number of the specific `it`/`test` block in `coverage_path`. Required
  for STRONG and WEAK. Both path AND line are required — if you can find the file but not a
  specific line, downgrade to WEAK and explain in `gap_description`.
- `gap_description` — for WEAK: what the existing test is missing. For GAP: what needs to be
  written and at which layer. Empty for STRONG.
- `recommended_layer` — `request_spec` / `model_spec` / `component_test` / `keep_selenium`.
  Empty for STRONG rows.

Also write `tmp/selenium-behavior/<name>.quality.summary.md` (see Step 7).

## Workflow

### 1. Read the behaviors CSV

Parse all rows. Validate the 10-column schema — if it doesn't match,
tell the user to re-run `selenium-behavior-extract`.

Count rows per unique `controller_route`. This drives both the coverage index build and
the clustering decisions in the next steps.

### 2. Build the coverage index (main context — runs before any agents)

For each unique `controller_route`, grep for candidate lower-layer test files.
Do this **before** spawning agents so every agent receives pre-built file lists rather than
performing redundant greps independently.

#### 2a. Derive search terms for every unique controller

For each unique controller class present in the behaviors CSV, derive:
- Controller snake-case name (`GradesController` → `grades_controller`)
- Route path fragment (`/courses/:id/grades` → `grades`)
- Page object names collected from `extract_notes` for all rows on that controller

#### 2b. Run all controller grep queries in parallel

Issue all controller grep queries as **parallel Bash calls in a single message** —
one call per unique controller class. Do not run them sequentially.

Each query:

```bash
# Ruby specs — controller/request/api
grep -rn "<controller_snake_case>\|<ControllerCamelCase>" \
  spec/requests/ spec/controllers/ spec/apis/ --include="*_spec.rb" -l

# Ruby specs — route path
grep -rn "<path_fragment>" \
  spec/requests/ spec/controllers/ spec/apis/ --include="*_spec.rb" -l

# JS/TS component tests — page object name or feature keyword
grep -rn "<PageObjectName>\|<feature_keyword>" \
  ui/features/ ui/shared/ --include="*.test.{ts,tsx,js,jsx}" -l
```

Wait for all parallel results, then merge. Deduplicate results per controller.

#### 2c. Build the index

The output is a dict keyed by `controller_route` (all routes on the same
controller share the same candidate file list — one search covers all):

```
coverage_index = {
  "<controller_route>": ["spec/requests/foo_spec.rb", "ui/features/bar/__tests__/Baz.test.jsx", ...],
  ...
}
```

### 3. Cluster rows into parallel scoring groups

Assign every row in the behaviors CSV to exactly one cluster. Each cluster becomes one
parallel agent in Step 4. The goal is 6–10 clusters of roughly equal scoring work,
with related routes grouped so each agent reads a coherent set of spec files.

**Default clustering rules** (adjust based on actual row counts):

| Cluster | Routes to include | Typical row count |
|---|---|---|
| `speedgrader_display` | SpeedGrader rows where classification ∈ {page_render, data_verify} and `then` mentions grade values, format, or status pills | ~40–60 rows |
| `speedgrader_comments` | SpeedGrader rows where `extract_notes` mentions comment, attachment, draft, avatar | ~25–35 rows |
| `speedgrader_moderation` | SpeedGrader + AssignmentsController rows for moderated grading, provisional grades, anonymous marking | ~30–40 rows |
| `speedgrader_teacher` | SpeedGrader rows for section filtering, enrollment states, submission details, turnitin/plagiarism | ~30–40 rows |
| `speedgrader_ui_state` | SpeedGrader rows where classification ∈ {workflow, async_interaction} or `extract_notes` mentions state machine | ~20–30 rows |
| `grades_page` | GradesController, GradebooksController#grades routes | ~25–35 rows |
| `moderation_page` | AssignmentsController#moderate routes | ~30–40 rows |
| `rubrics` | RubricsController routes | ~15–20 rows |
| `misc` | All remaining routes (SubmissionsController, Conversations, UserPreferences, etc.) | ~10–20 rows |

**Sizing rules:**
- No cluster should exceed 60 rows — split if larger.
- No cluster should be fewer than 5 rows — merge with the most related cluster.
- The SpeedGrader cluster is almost always the largest; always split it.

For each cluster, collect:
- The rows assigned to it
- The union of `coverage_index[route]` for all routes in the cluster
  (the combined list of candidate spec files the agent will read)

### 4. Spawn parallel scoring agents

Spawn one Explore agent per cluster **simultaneously** (all in the same message).
Each agent receives a self-contained prompt — it has no knowledge of other clusters.

#### Agent prompt template

```
You are scoring selenium behavioral contracts for assertion-level coverage quality.
You will receive a list of behavioral contract rows and a list of candidate lower-layer
spec/test files. Read the candidate files, then score each row.

## Scoring rules

Coverage score per row (take the LOWEST score across all assertions in the `then` column):
- STRONG: a lower-layer test hits the same route + actor AND explicitly asserts the specific
  value/state from `then` (not just status or presence)
- WEAK: a lower-layer test hits the same route + actor but assertions are under-specified
  (status-only, presence-not-value, wrong field, actor mismatch)
- GAP: no lower-layer test covers this route + actor + assertion combination

Recommended layer for WEAK and GAP rows:
- page_render classification → component_test
- data_verify → request_spec (if server data) or component_test (if UI rendering)
- form_interaction → request_spec
- permission_check → request_spec
- workflow + HIGH complexity OR async_interaction → keep_selenium
- workflow + LOW/MEDIUM complexity → request_spec if server state, keep_selenium if UI state

## Output format

Return ONLY CSV rows (no header, no commentary). One row per input row, same order.
15 columns: file, line, test_name, given, when, then, controller_route, classification,
complexity, extract_notes, coverage_score, coverage_path, coverage_line,
gap_description, recommended_layer

Rules:
- STRONG rows: coverage_path and coverage_line required; gap_description and
  recommended_layer empty
- WEAK rows: coverage_path and coverage_line required; gap_description explains what's
  missing; recommended_layer populated
- GAP rows: coverage_path and coverage_line empty; gap_description explains what needs
  to be written; recommended_layer populated
- For STRONG and WEAK: coverage_line must be a specific integer (the line number of the
  `it`/`test`/`describe` block) — not a file-level citation
- RFC 4180 escaping: wrap fields containing commas or quotes in double-quotes;
  double any internal double-quotes

## Candidate spec files

Read these files to find lower-layer coverage for this cluster's routes:

<list of candidate spec/test files from coverage_index for this cluster>

## Rows to score

<the CSV rows assigned to this cluster, including all 10 behavior columns>
```

Run all cluster agents simultaneously. Wait for all to complete before proceeding to Step 5.

### 5. Synthesize results

Collect the CSV row output from every agent. Combine all rows into a single result set.

**Re-order to match the original behaviors CSV:** The agents return rows in the order they
received them (cluster order), which may differ from the original CSV order. Re-sort by
matching `(file, line, test_name)` back to the original row order.

**Handle missing rows:** If a row from the original CSV is absent from all agent outputs
(agent dropped it or errored), insert a fallback row with `coverage_score=GAP`,
empty `coverage_path`/`coverage_line`, `gap_description=(scoring agent did not return this row)`,
and `recommended_layer` derived from the row's `classification`.

### 6. Verify all citations

For every STRONG and WEAK row:
1. Confirm `coverage_path` exists on disk: `test -f <path>`
2. Confirm `coverage_line` is a positive integer within the file's line count
3. Spot-check: read lines `coverage_line - 3` through `coverage_line + 3` and confirm
   the window contains an `it`, `test`, `describe`, or `context` keyword

Rows that fail verification:
- Malformed path or non-integer line → downgrade to GAP, append `(citation malformed)` to
  `gap_description`
- File missing or line out of bounds → downgrade to GAP, append `(citation unverified)`
- No test context near cited line → reclassify as PARTIAL, note in `gap_description`

Run all verifications with parallel `test -f` calls where possible — don't verify one row
at a time when you can batch 10 at once.

### 7. Write the quality CSV

Write `tmp/selenium-behavior/<name>.quality.csv` with all 15 columns.

Validate:
- Every row has exactly 15 columns
- `coverage_score` is `STRONG`, `WEAK`, or `GAP`
- STRONG and WEAK rows have non-empty `coverage_path` and `coverage_line`
- GAP rows have empty `coverage_path` and `coverage_line`
- `recommended_layer` is empty for STRONG rows; populated for WEAK and GAP rows
- `gap_description` is non-empty for WEAK rows; populated for GAP rows

Fix any validation failures before writing (do not silently drop rows).

### 8. Write the summary

`tmp/selenium-behavior/<name>.quality.summary.md`:

```markdown
# Coverage Quality Report — <name>
Generated: <timestamp>

## Score summary

| Score  | Count | % |
|--------|-------|---|
| STRONG |   n   |   |
| WEAK   |   n   |   |
| GAP    |   n   |   |
| Total  |   N   |   |

## Clusters processed

| Cluster | Rows | Agents |
|---------|------|--------|
| speedgrader_display | n | 1 |
| ...                 | n | 1 |

## Top 5 STRONG (safe to delete after manual spot-check)

- `file:line` — test_name (coverage: coverage_path:coverage_line)
...

## WEAK rows (cheapest fixes — extend existing tests)

- `file:line` — test_name
  Gap: <gap_description>
  Fix: extend <coverage_path:coverage_line>
...

## GAP rows by recommended layer

### request_spec (N)
- `file:line` — test_name: <gap_description>

### component_test (N)
- `file:line` — test_name: <gap_description>

### model_spec (N)
- `file:line` — test_name: <gap_description>

### keep_selenium (N)
- `file:line` — test_name: <gap_description>
```

### 9. Report to the user

Print the score summary, cluster table, and output paths. Then:

```
Next steps:
  - STRONG rows: safe to delete once you spot-check cited tests.
    Update your audit CSV and run selenium-trim.
  - WEAK rows: extend cited tests per gap_description, then re-run
    this skill to upgrade them to STRONG.
  - GAP rows: pass this CSV to selenium-gap-filler to generate the
    missing tests.
  - keep_selenium rows: leave in audit CSV as KEEP.
```

## Sizing guidance for the SpeedGrader cluster

SpeedGrader is almost always the dominant route (60–70% of rows in grades-adjacent
directories). If a SpeedGrader cluster would exceed 60 rows, split it further using these
sub-feature signals from `extract_notes` or `then`:

| Sub-cluster | Split signal |
|---|---|
| `speedgrader_grade_format` | `extract_notes` contains "GradeFormat" or `then` mentions specific grade values (letter/percent/points) |
| `speedgrader_comments` | `extract_notes` contains "comment", "attachment", "draft", "avatar" |
| `speedgrader_rubric` | `extract_notes` contains "rubric", "criterion", "rating" |
| `speedgrader_quiz` | `extract_notes` contains "quiz", "iframe" |
| `speedgrader_moderated` | `extract_notes` contains "provisional", "moderat", "anonymous" |
| `speedgrader_turnitin` | `extract_notes` contains "turnitin", "originality", "plagiarism" |
| `speedgrader_reassign` | `then` contains "reassign" |
| `speedgrader_status` | `then` contains "status pill" or "missing pill" or "late pill" |

Each sub-cluster maps to a distinct set of component test files, which makes each agent's
read list smaller and more focused.

## Anti-patterns

- **Don't skip the coverage index build.** Agents must receive pre-built candidate file
  lists. Agents that grep independently produce redundant work and inconsistent results.
- **Don't score STRONG based on file existence.** A `grades_controller_spec.rb` that tests
  index but not show is not STRONG coverage for a test of `GradesController#show`.
- **Don't score STRONG for status-only assertions.** `have_http_status(:ok)` without value
  assertions is WEAK.
- **Don't score STRONG when the actor role doesn't match.** A teacher-actor spec doesn't
  cover a student-visibility assertion.
- **Don't collapse per-assertion scoring into a file-level score.** Score every assertion in
  `then`; the row takes the lowest.
- **Don't recommend `keep_selenium` lazily.** Only for genuinely browser-only behavior:
  multi-step modal state, JS event chains, drag/drop, async polling.
- **Don't create clusters smaller than 5 rows.** Merge them — the agent spin-up cost
  exceeds the parallelism benefit for tiny clusters.
