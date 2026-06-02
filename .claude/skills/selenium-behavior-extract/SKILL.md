---
name: selenium-behavior-extract
description: Extract behavioral contracts (Given/When/Then) from Selenium `it` blocks. Accepts a spec file, directory, or manual_review.csv. Output CSV is consumed by selenium-coverage-quality to score assertion-level coverage.
---

# Selenium behavior extract skill

[[selenium-audit]] classifies tests using heuristics — grep matches, description text, controller
name patterns. That works for clear-cut cases. It breaks down for tests where the description is
vague, the coverage grep found a file but not the specific assertion, or the behavior spans
multiple layers.

This skill reads the actual `it` block code and translates each one into a precise behavioral
contract: what must exist (Given), what happens (When), and what specifically is asserted (Then).
The output is consumed by [[selenium-coverage-quality]], which scores whether existing lower-layer
tests cover each assertion — at assertion granularity, not file granularity.

## Why context windows, not full files

The original approach sent whole spec files to agents. A file like `speedgrader_spec.rb` has
1,261 lines but only 60 target `it` blocks — 95% of the file is irrelevant context that wastes
the agent's context window and forces larger, slower batches.

Instead, this skill pre-extracts a **context window** for each target `it` block before spawning
agents. A context window is the `it` body + the surrounding `let`/`before`/`describe` nesting
that defines the Given. Typical window: 100–300 lines. Agents receive pre-cut windows and focus
entirely on interpretation, not file navigation.

Benefits:
- Agents process **20–25 targets each** (vs ~10 with full files)
- Fewer agents needed for the same row count (or more parallelism for the same cost)
- Each agent's context is dense with relevant information, not diluted by unrelated tests
- Pre-extraction reads each file exactly once

## Inputs

One of:
- A Selenium spec file: `spec/selenium/grades/gradebook_spec.rb`
- A directory or short name: `grades` → `spec/selenium/grades`
- A manual review CSV: `tmp/selenium-trim/grades.manual_review.csv` — processes only the
  `it` blocks listed in the CSV (does not re-scan whole files)
- A single block reference: `spec/selenium/grades/gradebook_spec.rb:42`

If no input is supplied, ask.

## Output root

Outputs default to `tmp/`. When invoked with `--run-dir <root>` (the
`selenium-pipeline` always passes this), replace the leading `tmp` in every output
path below with `<root>` so concurrent or repeated runs never clobber each other.

## Output

`tmp/selenium-behavior/<name>.behaviors.csv`

`<name>` is derived from the input:
- Spec file → basename without `_spec.rb` (e.g. `gradebook`)
- Directory → directory name (e.g. `grades`)
- CSV → CSV basename without extension (e.g. `grades`)

Create `tmp/selenium-behavior/` if it does not exist.

Header:
```
file,line,test_name,given,when,then,controller_route,classification,complexity,extract_notes
```

### Column definitions

- `file` — spec path relative to repo root
- `line` — line number of the `it "..." do` line
- `test_name` — exact `it` description string, RFC 4180 escaped
- `given` — plain-English preconditions separated by ` | `: records that exist, the actor's
  role and enrollment, feature flags that must be on, page state before the action fires
- `when` — plain-English user action AND the implied HTTP call. Both matter.
  Example: `Teacher clicks Submit Grade button → POST /courses/:id/gradebook/update_submission`
  If the route cannot be determined from the page object, write the UI action and note the
  uncertainty in `extract_notes`.
- `then` — plain-English outcomes, one per assertion, separated by ` | `. Be specific about
  values: not "score is visible" but "score field shows '95' for student Alice". Include:
  - DOM assertions (element text, visibility, presence)
  - Flash messages (success/error, message text)
  - DB state changes asserted via `.reload` or re-navigation
  - Redirect or response state if the test checks it
- `controller_route` — primary controller action + route, e.g.
  `GradesController#show GET /courses/:id/grades`. Derive this from page object `visit_*`
  calls, Capybara `visit` calls, or form action attributes. Leave empty if genuinely
  undeterminable; explain in `extract_notes`.
- `classification` — one of exactly these six values:
  - `page_render` — asserts only that content appears (no server state change, pure display)
  - `data_verify` — asserts that server-returned data displays correctly
  - `form_interaction` — fills and submits a form, asserts the resulting server or UI state
  - `permission_check` — verifies who can or cannot see or do something
  - `workflow` — multi-step flow exercising several sequential actions
  - `async_interaction` — relies on JS polling, WebSocket updates, or real-time DOM changes
- `complexity` — `LOW` / `MEDIUM` / `HIGH`:
  - `LOW` — single action, 1–2 assertions, clearly maps to one HTTP endpoint
  - `MEDIUM` — 2–4 assertions or actions, uses page objects, moderate setup
  - `HIGH` — multi-step workflow, async behavior, complex data setup, or 3+ controllers
- `extract_notes` — free-text: page object class names used, feature flags seen in setup,
  whether the test has `before` blocks that affect Given, any extraction uncertainties

## Workflow

### 1. Resolve input

Determine the set of `(file, target_lines)` pairs to process:

- **Spec file path** → target_lines = all `it` blocks in the file (scan for `^  it ` / `^    it `)
- **Directory / short name** → collect all `*_spec.rb` under `spec/selenium/<name>/`;
  target_lines = all `it` blocks in every file
- **manual_review.csv** → read `file` and `line` columns; target_lines per file = the listed
  line numbers only. Do NOT scan for other `it` blocks in those files.
- **file:line** → single target

Verify all resolved files exist on disk. Report missing files and stop if any are missing.

For `manual_review.csv` input, also collect `test_name` per row — agents use this to
disambiguate same-line targets that differ only in the test name (FF=true/FF=false variants).

### 2. Pre-extract context windows (main context)

Read each unique file **once** and extract a context window for every target line.
This step runs in the main context — no agents needed. It is fast (mechanical file reading)
and eliminates redundant reads across agents.

**Context window extraction algorithm** for a target at line L in file F:

```
1. Read all lines of F into memory.

2. Find the it block start at line L.
   Confirm line L matches: /^\s*it\s+["']/ or /^\s*xit\s+["']/

3. Walk DOWN from L to find the it block end.
   Track Ruby block depth (do/end pairs). The block ends when depth returns to 0.
   Capture lines L..closing_end_line as the "body" (call this body_end).

4. Walk UP from L to find the enclosing context boundary.
   Scan backward from L-1 looking for:
   - let/let! blocks → include entire block
   - before/after blocks → include entire block
   - subject blocks → include entire block
   - shared_context / include_context references → capture the reference line
   - describe/context blocks → capture the block header (the open line only,
     not their full content — we only want the name for Given context)
   Stop scanning when you have walked back 200 lines or reached the top of the file,
   whichever comes first.

5. The context window = [lines captured in step 4] + [body from step 2-3].
   Prepend "# FILE: <filepath>" and "# TARGET LINE: <L>" as comment headers.
   Append any let/before/shared_context lines found between the outermost describe
   and the first nested describe/context (these are file-level shared setups).

6. If the window exceeds 400 lines, truncate the backward scan to 150 lines
   (keep the it body in full; never truncate the body).
```

Emit a **snippet dict** for each target:
```
{
  file: "spec/selenium/...",
  line: L,
  test_name: "...",   # from manual_review.csv or extracted from line L
  window: "<multiline string, the context window>"
}
```

**If the backward scan finds a `shared_context` or `it_behaves_like` reference that is not
defined within the 200-line window:** note the reference name in `extract_notes`. The agent
will flag it with LOW complexity and note the uncertainty.

**Parallelise for large inputs:** If there are more than 5 unique files to read, spawn one
Explore agent per file to extract all its snippets simultaneously. Each agent reads one file,
extracts all target-line windows for that file, and returns the snippets as a JSON array.

**Pipeline read → extract; don't barrier on the whole set.** Step 3 forms batches
file-by-file (see its grouping strategy), so a file's snippets don't depend on any other
file's read. As each read agent returns:
- If that file alone yields ≥ the minimum batch size (3 snippets), cluster it immediately
  (Step 3) and spawn its extraction agent(s) (Step 4) right away — while other files are
  still being read.
- If it yields fewer than the minimum, hold its snippets in a small-file merge pool and
  batch them together once all reads are in.

This keeps the read and extract waves overlapping instead of waiting for the slowest file
read before any extraction starts. Only the merge-pool stragglers wait for the full set.

For ≤5 files, extract snippets in the main context directly (the file reads are fast enough
that agent spin-up overhead would dominate), then proceed to Step 3.

### 3. Cluster snippets into agent batches

Group the extracted snippets into batches. Each batch becomes one parallel extraction agent
in Step 4.

**Sizing target:** 20–25 snippets per agent (not file-line count). This gives each agent a
focused, manageable workload regardless of how large the original files are.

**Hard limits:**
- Maximum 30 snippets per agent
- Minimum 3 snippets per agent (merge smaller batches)

**Grouping strategy:** Keep snippets from the same file together within a batch where
possible — agents can cross-reference shared context more easily when multiple targets
from the same file are in the same batch. Fill batches file-by-file until the size limit
is reached, then start a new batch.

Compute expected batch count: `ceil(total_snippets / 22)`. For 289 targets: ~13 batches.

Report the batching plan to the user before spawning:

```
Pre-extraction complete — <N> snippets across <M> files
Spawning <B> parallel extraction agents (~<avg> snippets each)
```

### 4. Spawn parallel extraction agents

Spawn one Explore agent per batch **simultaneously** (all in the same message).

#### Agent prompt template

```
You are extracting behavioral contracts from Canvas Selenium test snippets.
Each snippet is a pre-extracted context window: the `it` block body plus the
surrounding `let`/`before`/`describe` nesting that defines Given.

## Output format (one CSV row per snippet, no header)

10 columns, RFC 4180 escaped:
file,line,test_name,given,when,then,controller_route,classification,complexity,extract_notes

Rules:
- given: pipe-separated plain-English preconditions (role | records | feature flags | page state)
- when: "<actor> <UI action> → <HTTP VERB> <route>" — both UI gesture and implied HTTP call
- then: pipe-separated SPECIFIC assertions — exact text values, not vague summaries
- controller_route: "ControllerName#action VERB /route/:id" — from visit/navigation calls
- classification: page_render | data_verify | form_interaction | permission_check | workflow | async_interaction
- complexity: LOW | MEDIUM | HIGH
- extract_notes: page object class names, feature flags, shared_context references, uncertainties

Critical rules:
- Do NOT summarize assertions. "grade field shows '95'" not "grade is visible".
- Do NOT skip nested let/before context — all inherited setup is part of Given.
- Do NOT collapse multiple assertions into one Then — use pipe separator.
- For FF=true/FF=false test_name variants at the same line: produce one row per test_name,
  reflecting the correct feature flag state in the given column.

## Snippets to process

<paste all snippets for this batch, each preceded by its FILE/TARGET LINE comment header>
```

Return rows in the same order as the input snippets.

**Agent failure handling:** If an agent returns fewer rows than snippets provided, the
missing rows get a fallback entry in the synthesized output: all fields from the snippet
metadata (file, line, test_name) plus `given=EXTRACTION_FAILED`, `then=EXTRACTION_FAILED`,
`classification=page_render`, `complexity=LOW`, `extract_notes=Agent did not return this row`.

### 5. Synthesize

Collect all agent outputs. Re-order rows to match the original input order (by file, then
by target line number within each file).

Write to `tmp/selenium-behavior/<name>.behaviors.csv` with a single header row.

Validate:
- Every row has exactly 10 columns
- `classification` is one of the 6 enum values
- `complexity` is one of the 3 enum values
- `given`, `when`, `then` are non-empty on every row
- `controller_route` is non-empty for every row where the route is determinable

Fix any validation failures before writing (do not silently drop rows).

### 6. Report to the user

```
Behavior extraction complete — <input source>
────────────────────────────────────────────────
  Snippets pre-extracted:  N
  Agents spawned:          B  (~<avg> snippets each)
  Rows in output:          N

  By classification:
    page_render:        n
    data_verify:        n
    form_interaction:   n
    permission_check:   n
    workflow:           n
    async_interaction:  n

  By complexity:
    LOW:     n
    MEDIUM:  n
    HIGH:    n

  Extraction failures:  n  (rows with given=EXTRACTION_FAILED — review manually)

  Output: tmp/selenium-behavior/<name>.behaviors.csv

Next step: pass this CSV to selenium-coverage-quality to score
assertion-level coverage for each extracted contract.
```

## Anti-patterns

- **Don't send full files to agents.** Always pre-extract context windows first. Sending
  a 1,200-line file when only 60 lines are needed is the primary source of slow, shallow
  extraction.
- **Don't summarize assertions.** "Grade is displayed" is not a Then. "Score field shows '95'
  for student Alice after submit" is a Then. Vague Thens produce vague quality scores.
- **Don't skip the backward scan.** A `before` block 150 lines up that sets `@course` is
  part of Given. The context window algorithm must walk back far enough to capture it.
- **Don't guess at routes when you can trace them.** If the page object has a `visit_course`
  method, read its definition to find the actual path. Only fall back to guessing when the
  definition isn't accessible; note the uncertainty in `extract_notes`.
- **Don't collapse multiple assertions into one Then.** If the test asserts both that a flash
  appears AND that a DB record was saved, those are two Thens separated by ` | `.
- **Don't process files that aren't in scope.** When input is a manual_review.csv, only
  extract the listed `it` blocks — not every `it` in the files.
- **Don't batch by raw file-line count.** Batch by snippet count (20–25 per agent). A file
  with 1,000 lines but only 5 target blocks should contribute 5 snippets to a batch, not
  1,000 lines worth of batching weight.
