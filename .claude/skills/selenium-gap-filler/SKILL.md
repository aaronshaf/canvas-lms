---
name: selenium-gap-filler
description: Generate targeted lower-layer tests for behavioral gaps identified by selenium-coverage-quality. Fills request spec, model spec, and component test gaps. Flags keep_selenium rows. Does NOT delete Selenium tests — that remains selenium-trim's job.
---

# Selenium gap filler skill

[[selenium-coverage-quality]] produces a quality CSV with rows scored STRONG, WEAK, or GAP.
This skill acts on the WEAK and GAP rows in two phases:

**Phase 1 — parallel write:** One agent per output spec file. All agents run simultaneously.
Each agent reads the controller/component, formulates every test for its file, lints, and
returns the complete file content. No git operations in this phase.

**Phase 2 — sequential verify+commit:** Main context writes each file to disk, runs tests
in Docker (or `yarn test` for JS), mutation-checks, and commits if green. Sequential because
Docker has one test runner and git commits cannot interleave.

This separation means the slow part (reading controllers, formulating test scenarios, writing
Ruby/TypeScript) is embarrassingly parallel. The sequential gate is only the fast part
(run + commit).

This skill does NOT delete any Selenium tests. Deletion is [[selenium-trim]]'s job.

## Output root

Inputs and outputs default to `tmp/`. When invoked with `--run-dir <root>` (the
`selenium-pipeline` always passes this), replace the leading `tmp` in every path
below — both the quality CSV it reads and the gap report it writes — with `<root>`,
so concurrent or repeated runs never clobber each other.

## Inputs

The user supplies a quality CSV path: `tmp/selenium-behavior/grades.quality.csv`
or a short name: `grades` (resolved to `tmp/selenium-behavior/grades.quality.csv`).

Optional filters:
- `--layer request_spec` — only process rows with that `recommended_layer`
- `--score GAP` — only process GAP rows (skips WEAK rows)
- `--line <n>` — process only the row at that original Selenium test line number
- `--dry-run` — run Phase 1 (write agents) but do not write to disk or commit

If the CSV doesn't exist, instruct the user to run `selenium-coverage-quality` first.

## Output

- New or modified spec files on disk (unless `--dry-run`)
- One commit per spec file on the current branch

Summary doc: `tmp/selenium-behavior/<name>.gap_report.md` with columns:
```
file,line,test_name,coverage_score,action_taken,output_path,output_line,run_result,notes
```

- `action_taken` — `EXTENDED`, `WROTE_NEW`, `SKIPPED_KEEP_SELENIUM`, `FAILED`, `DRY_RUN`
- `output_path` — spec file written or modified
- `output_line` — line number of the written `it` block
- `run_result` — `green`, `red (<message>)`, `skipped`
- `notes` — what was generated and any caveats

## Workflow

### 1. Read and partition the quality CSV

Parse the 15-column schema. Partition:

```
extend_rows = [rows where coverage_score == WEAK]
write_rows  = [rows where coverage_score == GAP
               and recommended_layer in {request_spec, model_spec, component_test}]
keep_rows   = [rows where recommended_layer == keep_selenium]
strong_rows = [rows where coverage_score == STRONG]  # no action needed
```

Apply any `--layer` or `--score` filters first.

Report counts to the user:

```
Quality CSV: tmp/selenium-behavior/<name>.quality.csv
────────────────────────────────────────────────────────
  STRONG (no action):      n
  WEAK  (extend):          n
  GAP / request_spec:      n
  GAP / model_spec:        n
  GAP / component_test:    n
  GAP / keep_selenium:     n  ← reported only, not touched
```

Ask the user to confirm before writing any files ("Proceed? (y/n)"). Wait for the response.

### 2. Handle keep_selenium rows

For each `keep_selenium` row, verify the Selenium test actually requires a browser by
re-reading the original `it` block. Confirm: async polling, multi-step modal flow,
drag/drop interaction, or real-time DOM updates that cannot be exercised via a request or
component test.

Report each confirmed row in the gap report as `SKIPPED_KEEP_SELENIUM` with a one-line
justification. These rows should be promoted in the audit CSV to `KEEP / HIGH`.

If a row turns out to be incorrectly classified, reclassify it into the appropriate layer
and add it to the write queue.

### 3. Determine output files (pre-processing, main context)

Before spawning any agents, determine the target output spec file for every WEAK and GAP
row. This must happen in the main context so the clustering in Step 4 is correct.

**For WEAK rows:** the output file is `coverage_path` from the quality CSV (extend the
existing cited spec file).

**For GAP / request_spec rows:**
- Derive the controller name from `controller_route` (e.g., `GradesController` →
  `spec/requests/grades_spec.rb`)
- Also check for an existing controller spec: `spec/controllers/<name>_controller_spec.rb`
- Check whether the request spec file already exists: `test -f <path>`
- If it exists, that is the output file (rows will be appended)
- If not, it will be created
- Record whether a controller spec exists — this determines how Phase 1 runs (see Step 5)

**For GAP / model_spec rows:**
- Derive the model name from `controller_route` or `then` assertion
- Target `spec/models/<model_name>_spec.rb`

**For GAP / component_test rows:**
- Extract the feature/component name from `extract_notes` (page object class name)
- Find the adjacent `*.test.{tsx,jsx,ts,js}` file:
  ```bash
  find ui/features -name "<feature_keyword>*.test.*" | head -3
  ```
- If no existing test file, determine where a new one should live

Record `output_file` for every row. Rows sharing the same `output_file` will be handled
by the same write agent in the next step.

### 4. Cluster rows by output file

Group all rows (WEAK and GAP) by their `output_file`. Each cluster becomes one write agent
in Phase 1.

**Sizing limits:**
- No cluster should exceed 20 rows. If a single output file has more rows than this, split
  it into sub-clusters (e.g., `speedgrader_section_spec_part1` and `_part2`) — the agent
  will produce separate describe blocks that can be merged by hand if desired.
- No cluster should be fewer than 1 row.

Report the cluster plan to the user before spawning agents:

```
Write plan — N output files across M clusters
────────────────────────────────────────────────────────
  spec/requests/speedgrader_spec.rb         — 12 rows  (WEAK: 4, GAP: 8)
  spec/requests/gradebooks_spec.rb          —  5 rows  (WEAK: 2, GAP: 3)
  ui/features/speed_grader/__tests__/...    —  8 rows  (GAP: 8)
  ...
```

### 5. Phase 1 — Parallel write agents

Clusters are split by layer type. To maximise parallelism, **launch 5b write agents
first** (all in a single message), then immediately begin 5a request-spec skill calls
in the main context while those agents run. The two groups share no Phase 1 output
dependency. Collect all 5b agent results after 5a completes, then proceed to Phase 2.

#### 5a. request_spec clusters — delegate to `controller-to-request-spec`

For each `request_spec` cluster, **do not spawn a write agent**. Instead, invoke the
`controller-to-request-spec` skill directly in the main context via the `Skill` tool.

**Case 1 — controller spec exists** (`spec/controllers/<name>_controller_spec.rb` is
present):
```
Skill("controller-to-request-spec", "<path to controller spec>")
```
The skill converts the file, runs lint, runs the spec, and grades every `it` block.
After it completes, append any additional `it` blocks needed to cover the GAP-row
behavioral contracts that are not already covered by the converted spec. Use
`request-test-writer` for each additional scenario:
```
Skill("request-test-writer", "<Given/When/Then from quality CSV row>")
```

**Case 2 — no controller spec exists** (pure GAP, new request spec needed):

Write a stub spec file at `spec/requests/<name>_spec.rb` that contains an empty
`describe` block with `type: :request`, then use `request-test-writer` for each
GAP-row behavioral contract:
```
Skill("request-test-writer", "<Given/When/Then from quality CSV row>")
```
After all `it` blocks are appended, invoke `controller-to-request-spec` with
`--no-grading` skipped — i.e., pass the new request spec file so grading mode runs
over every `it` block:
```
Skill("controller-to-request-spec", "spec/requests/<name>_spec.rb")
```

In both cases, `controller-to-request-spec` owns lint, run, and grading for the
request spec file. **Phase 2 steps 6b–6d are skipped for request_spec clusters**
because `controller-to-request-spec` already performs them.

Phase 2 step 6e (commit) and 6f (record outcomes) still apply.

#### 5b. model_spec and component_test clusters — write agents (unchanged)

Spawn one `general-purpose` agent per cluster **simultaneously** (all in a single
message). Each agent is self-contained: it reads source files, writes tests, lints, and
returns the complete file content. It does NOT write to disk.

#### Agent prompt template (model_spec / component_test only)

```
You are writing lower-layer replacement tests for Canvas LMS Selenium behaviors.
Your job: produce the complete content of ONE spec file (or the new it blocks to append
to an existing file). Do NOT write to disk. Return the content as a structured response.

## Your output file
<output_path>

## Layer
<model_spec | component_test>

## Existing file content (empty if new file)
<full current content of the output file, or "(new file)" if it does not exist>

## Rows to cover
<for each row: file, line, test_name, given, when, then, classification, gap_description>

## Rules by layer

### model_spec rules:
- One describe block per method being tested
- Explicit setup via create or build — no factory defaults for asserted values
- Assert the specific output value, not just that the method runs

### component_test rules:
- Import the component and render with explicit props
- Props represent the server data the Selenium test was verifying
- Assert the rendered output matches the `then` assertion value
- Example: expect(screen.getByTestId('student-grade')).toHaveTextContent('95')

## Lint before returning
For Ruby specs: conceptually apply rubocop rules (correct indentation, no trailing
whitespace, frozen_string_literal comment at top if present in existing file).
For JS/TS specs: ensure imports are correct, no unused variables, proper TypeScript types.

## Return format
Return EXACTLY this structure (no additional commentary before or after):

FILE_CONTENT_START
<complete file content — either the full new file, or the lines to append to the existing file>
FILE_CONTENT_END

ROW_MAPPINGS_START
<selenium_file>:<selenium_line> → <output_line_number_in_returned_content>
...
ROW_MAPPINGS_END

LINT_STATUS: clean | <brief description of any lint issues that need manual fix>
```

Wait for all agents to return before proceeding to Phase 2.

**Agent failure handling:** If an agent returns malformed output (no `FILE_CONTENT_START`
marker, no `ROW_MAPPINGS_START` marker), log a warning and mark all rows in that cluster
as `FAILED`. Do not block Phase 2 for other clusters.

### 6. Phase 2 — verify+commit

The sequencing constraint is the **Docker rspec runner**, not Phase 2 as a whole —
only one Ruby spec run can use the test database at a time. Split clusters by runner:

- **Ruby clusters** (request_spec, model_spec) — process one at a time. Their run
  step (6c) and mutation check (6d) hold the single Docker runner.
- **component_test clusters** — `yarn test` runs on the host and never touches the
  Docker runner. Launch their write+lint+run (6a–6d) **concurrently** with the Ruby
  queue. Collect their results when they finish.

Commits (6e) are always serialised across all clusters — git is a single writer and
diffs must not interleave. Queue each green cluster's commit and apply them in order
once its verification is done.

**Request spec clusters** were already handled by `controller-to-request-spec` in Phase 1
(lint, run, grade). Skip steps 6b–6d for those clusters and proceed directly to 6e (commit)
and 6f (record outcomes). If `controller-to-request-spec` reported any red `it` blocks,
record `run_result=red` for the corresponding rows and do not commit.

For **model_spec and component_test clusters** whose agent returned valid output:

#### 6a. Write to disk

If the output file is new: write the full returned content to disk.

If the output file already exists: append the returned content (the new `it` blocks) to
the end of the appropriate `describe` block, or at the end of the file if no clear
insertion point. Do NOT overwrite existing `it` blocks.

#### 6b. Lint

**For Ruby specs:**
```bash
docker exec canvas-web bin/rubocop -a <output_path>
```

**For JS/TS specs:**
```bash
yarn lint <output_path>
```

Fix any auto-correctable issues. If lint exits non-zero after autocorrect, record the issue
in `notes` but continue — a lint warning should not block test execution.

#### 6c. Run and verify green

**For Ruby specs:**
```bash
docker exec canvas-web bin/rspec <output_path>
```

Run the entire output file (not line by line) so setup/teardown interactions are caught.
If failing, iterate up to **3 attempts**:
1. Read the failure output
2. Fix one root cause (do not patch symptoms)
3. Re-run

After 3 failed attempts, record `run_result=red (<last error>)` for all rows in the cluster
and move on. Do NOT commit a failing file.

**For JS/TS specs:**
```bash
yarn test <output_path>
```

Canvas component tests do NOT require Docker.

#### 6d. Mutation check (only when file is green)

Run a **3-mutation budget** across the new `it` blocks to verify they are non-tautological.
For each mutation attempt:

1. Snapshot the target production file: `cp <file> <file>.mutation-bak`
2. Apply one mutation (invert a condition, flip a comparison, change a return value)
3. Run only the specific `it` block: `bin/rspec <output_path>:<line>`
4. Restore: `cp <file>.mutation-bak <file>` then `rm <file>.mutation-bak`
5. Stop early if the mutation was caught (assertion failure, not a crash)

If no mutation is caught in 3 attempts, the test is too weak. Add a stronger value assertion
and repeat verify + mutation check.

#### 6e. Commit the file

```bash
git add <output_path>
git commit -m "..."
```

Commit message format:

```
test: cover <behavior> at <layer> layer

Adds <N> <request_spec|model_spec|component_test> cases covering
behaviors previously exercised only in selenium.

Enables removal of:
- <selenium_file>:<selenium_line> — <test_name>
- ...

refs <JIRA key if provided>
flag=none

test plan:
- bin/rspec <output_path>  [for Ruby]
- yarn test <output_path>  [for JS]
```

If the file extends an existing spec (WEAK rows), use `test: extend` instead of
`test: cover` in the subject line.

Do not commit the gap report file.

#### 6f. Record row outcomes

For each row in the cluster, record in the gap report:
- `action_taken`: `WROTE_NEW` (new file or new it blocks), `EXTENDED` (WEAK row extension)
- `output_path`: the spec file
- `output_line`: from the `ROW_MAPPINGS` returned by the write agent
- `run_result`: `green` or `red (<error>)` or `skipped` (if cluster agent failed in Phase 1)

### 7. Write the gap report

After all clusters are processed, write `tmp/selenium-behavior/<name>.gap_report.md`:

```markdown
# Gap Fill Report — <name>
Generated: <timestamp>

## Summary

| Action              | Count |
|---------------------|-------|
| Extended (WEAK)     |   n   |
| Wrote new (GAP)     |   n   |
| Keep selenium       |   n   |
| Failed (red)        |   n   |
| Failed (Phase 1)    |   n   |

## Phase 1 summary — write agents

| Output file | Rows | Agent status |
|-------------|------|--------------|
| spec/requests/... | n | green / failed |
| ...               | n | ...           |

## Green tests (committed)

- [file:line] test_name
  Written: <output_path:output_line>
  Status: green

## Red tests (manual fix needed)

- [file:line] test_name — <last error>
  File on disk: <output_path>

## Keep selenium

- [file:line] test_name — <justification>

## Phase 1 failures (agent did not return valid content)

- Cluster: <output_path> — <error description>
  Rows affected: <file:line>, <file:line>, ...
```

### 8. Report to the user

Print the summary table and the gap report path. Then:

```
Next steps for green rows:
  1. Verify new tests pass locally:
       bin/rspec <output_paths>
       yarn test <output_paths>
  2. Update audit CSV: verdict → DELETE_COVERED, existing_coverage = output_path:line
  3. Run selenium-trim --apply to remove the now-covered Selenium tests

Next steps for red rows:
  - See gap_report.md — file is on disk, not committed
  - Fix root cause manually, then commit and update audit CSV

Next steps for Phase 1 failures:
  - Re-run with --line <n> for the affected rows to retry individually

Keep selenium rows:
  - Update audit CSV: verdict=KEEP, confidence=HIGH
```

## Safety rules

1. **Never delete Selenium tests.** Only [[selenium-trim]] deletes tests.
2. **Never commit failing tests.** Red files stay on disk for the engineer; they are
   never committed.
3. **Never overwrite existing `it` blocks.** Always append new blocks or add assertions
   adjacent to the cited test. Do not modify other engineers' tests.
4. **Never invent API contracts.** Write agents must read the actual controller action
   before writing a request spec. Do not synthesize from the Selenium test alone.
5. **Stop after 3 attempts per file.** Record the failure and move on.
6. **Phase 1 agents are read-only.** They produce content as strings — they never write
   to disk, run tests, or make git commits. All mutations happen in Phase 2.

## Anti-patterns

- **Don't write status-only request specs.** `have_http_status(:ok)` without value
  assertions is WEAK — exactly what we're trying to fix.
- **Don't extend an existing `it` block when a new one is better.** Adding assertions
  inside an existing block obscures failure attribution. Add an adjacent `it`.
- **Don't rely on factory defaults for asserted values.** If the test asserts score=95,
  the setup must explicitly set score 95 — never rely on defaults.
- **Don't let Phase 1 agents write to disk.** This is the most common mistake when
  adapting agent prompts. Phase 1 produces content; Phase 2 writes files.
- **Don't split clusters too aggressively.** Related behaviors that touch the same
  controller benefit from being written by the same agent — it produces more coherent
  tests that share setup patterns.
- **Don't run two Ruby spec runs at once.** Docker has one test runner; concurrent
  rspec runs collide on the test database. Component tests (`yarn test`) run on the
  host and may run concurrently with the Ruby queue (see Step 6) — but never run two
  Docker rspec invocations in parallel.
- **Don't interleave commits.** Verification can overlap across runners, but commits
  are applied one at a time in source order — git is a single writer.
