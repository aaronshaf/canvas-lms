---
name: selenium-audit
description: Audit a directory of Canvas selenium tests, classify each `it` block (KEEP / DELETE / PARTIAL / WRITE NEW), verify whether equivalent lower-level coverage already exists, and emit a CSV that a downstream code-modification skill can act on. Use when the user asks to trim, prune, audit, or migrate selenium tests in a specific directory.
---

# Selenium audit skill

Canvas has hundreds of selenium spec files in `spec/selenium/`. Many are overkill — they assert on static rendering, duplicate controller/request specs, or test pure client-side logic that belongs in jest. This skill classifies every `it` block in a directory and produces a CSV other tooling can consume.

## Inputs

The user supplies a directory path, e.g. `spec/selenium/courses` or `spec/selenium/announcements`. Resolve it relative to the repo root if not absolute.

If the user did not specify a directory, ask for one. Do not run on `spec/selenium/` wholesale — that is hundreds of files.

## Output root

Outputs default to `tmp/`. When invoked with `--run-dir <root>` (the
`selenium-pipeline` always passes this, e.g. `tmp/selenium-runs/courses_20260602-141530`),
replace the leading `tmp` in every output path below with `<root>` so concurrent or
repeated runs never clobber each other's artifacts.

## Output

A CSV at `tmp/selenium-audit/<directory-name>.csv` (create `tmp/selenium-audit/` if missing). Header row:

```
file,line,test_name,verdict,confidence,skip_date,skip_ticket,existing_coverage,auditor_note,reason,suggested_action
```

One row per `it` block in the audited directory. Column rules:

- `file` — selenium spec path relative to repo root (e.g. `spec/selenium/courses/courses_spec.rb`).
- `line` — line number where the `it "..." do` begins.
- `test_name` — the exact string passed to `it`. Quote-escape commas and quotes per CSV rules (RFC 4180: wrap in `"..."`, double internal `"`s).
- `verdict` — one of the fixed values below. Downstream tooling depends on these literal strings. The verdict is purely data-driven — it reflects what is or isn't covered, never the auditor's opinion about whether a test is "trivial" or "valuable." Opinion goes in `auditor_note`.
  - `KEEP` — selenium is the right layer; leave alone
  - `DELETE_COVERED` — equivalent lower-level test already exists; cite it
  - `DELETE_SKIPPED` — already disabled in source via `skip:` / `xit` / `skip` block; remove the dead code
  - `PARTIAL` — some lower-level coverage exists but misses a specific behavior; engineer needs to extend it before removing the selenium test
  - `WRITE_NEW` — no lower-level coverage; engineer must decide per-row whether to author a new test or accept coverage loss before removing the selenium test
- `confidence` — `HIGH` / `MEDIUM` / `LOW`. Rules below.
- `skip_date` — ISO date (`YYYY-MM-DD`) parsed from the skip message if `verdict=DELETE_SKIPPED` and the skip metadata contains a date. Empty otherwise. Common patterns: `skip: "2025-10-22 reason..."`, `skip: "FOO-1234 (2025-10-22)..."`. If only a year/month is present, normalize to `YYYY-MM-01`. If no date, leave empty (do not invent one).
- `skip_ticket` — JIRA-style ticket reference parsed from the skip message if present. Match `[A-Z]{2,}-\d+` (e.g. `RCX-4312`, `INSTUI-1234`). Empty if no ticket found. Empty for non-skipped rows.
- `existing_coverage` — single `path:line` citation to the matching lower-level test, repo-relative (e.g. `spec/controllers/search_controller_spec.rb:329`). Both the path AND the line are required for `DELETE_COVERED` and `PARTIAL`. If you can identify the test file but cannot pin a specific line, you have not done enough work — find the line, or downgrade confidence to `MEDIUM` and explain in `reason`. Empty for `KEEP` / `DELETE_SKIPPED` / `WRITE_NEW`.
- `auditor_note` — free-text, optional. The auditor's qualitative hint to the engineer who will later triage `WRITE_NEW` rows. Examples:
  - `trivial rendering pattern — recommend accept loss` (a test that asserts only element presence; engineer can rubber-stamp the deletion)
  - `feature-flag visibility check — recommend accept loss`
  - `regression coverage for prior bug — recommend authoring jest test before delete`
  - `i18n-sensitive text — view spec recommended`
  - Empty when no hint applies.
  Engineers reading `WRITE_NEW` rows use this column to triage fast — rows with "recommend accept loss" hints get rubber-stamped; rows without hints (or with "worth authoring") get engineer deliberation.
- `reason` — one-line justification, no line breaks.
- `suggested_action` — one-line imperative the downstream skill can act on. Templates:
  - `DELETE_*` → `Remove it block at <file>:<line>`
  - `KEEP` → `Leave selenium test as-is`
  - `WRITE_NEW` → `Author <target_layer> test at <suggested_target_path> covering <behavior>, then remove it block at <file>:<line>`
  - `PARTIAL` → `Extend <existing_coverage> to cover <gap>, then remove it block at <file>:<line>`

Also write a sibling `tmp/selenium-audit/<directory-name>.summary.md` with totals per verdict and the top 5 highest-confidence quick wins. This is a human-readable companion — the downstream skill consumes the CSV, not this file.

## Confidence rules

- `HIGH`
  - `DELETE_SKIPPED` — always high (it's just dead code).
  - `DELETE_COVERED` — cited test clearly exercises the same action + assertions (e.g. controller spec for the same route with the same params and same effect).
  - `KEEP` — test exercises drag/drop, multi-step modal flow, async polling, sortable interaction, masquerading, or other browser-only behavior with no plausible lower-level equivalent.
- `MEDIUM`
  - `DELETE_COVERED` — cited test covers the action but assertion specifics differ slightly (e.g. selenium checks UI state, controller checks DB state).
  - `KEEP` — test could plausibly move to a lower layer but the migration cost outweighs the value.
- `LOW`
  - `PARTIAL` — always low (gap-fill work needed).
  - `WRITE_NEW` — always low (engineer triage required: author equivalent or accept coverage loss).
  - Any case where you weren't sure between two verdicts. Always pick the lower-confidence rating when uncertain.

The downstream code-modification skill should only auto-act on `HIGH`-confidence rows. `MEDIUM` and `LOW` require human review.

## Workflow

### 1. Survey the directory

```bash
find <dir> -name "*_spec.rb" | xargs wc -l
```

Note file count and total line count. This drives batching decisions.

### 2. Decide on batching

Single Explore agent can comfortably handle ~1000 lines of selenium specs with coverage greps. Above that, batch into parallel Explore agents:

- ≤1000 lines total → single agent
- 1000–3000 lines → 2–4 batched agents (each ~500–900 lines)
- >3000 lines → 4+ batched agents; consider warning the user that this may be a lot of output

Group files so each batch is ~500–900 lines. Don't split a single spec file across agents — coverage signals are easier to spot when one agent owns the whole file.

### 3. Per-batch agent prompt template

Each batched agent should:

1. Read every `it` block in its assigned files in full (no sampling).
2. Classify provisionally using these heuristics:

   **SKIPPED signature** — verdict `DELETE_SKIPPED`. Detect ALL of these patterns; missing any will undercount skips:

   - `it "...", skip: "..." do` — skip metadata on the `it` line
   - `it "...", skip: true do` — boolean skip with no message
   - `xit "..." do` — RSpec shorthand for skipped example
   - `skip "..."` or `skip` as the first executable line of the `it` block body
   - `before { skip "..." }` or `before do; skip "..."; end` in the enclosing context — every `it` inside that context is skipped
   - `context "...", skip: "..." do` — every `it` inside this block is skipped (parent-level skip)
   - `describe "...", skip: "..." do` — same, at describe level
   - `xdescribe "..." do` / `xcontext "..." do` — RSpec shorthand for skipped groups

   When a parent `context`/`describe`/`before` triggers the skip, each child `it` gets its own row in the CSV with `verdict=DELETE_SKIPPED`. Walk up the block scope when scanning each `it`. The `skip_date` and `skip_ticket` columns get the parent-block's metadata.

   Do NOT count commented-out `it` blocks (`# it "..." do`) or `it_behaves_like "..."` shared-example invocations as `it` blocks.

   **KEEP** — drag/drop, multi-step modal workflows, sortable interactions, async polling, masquerade flows, link validator, complex form state across multiple async events. The test cannot plausibly be moved to a lower layer.

   **COVERAGE-CANDIDATE** — everything that is neither SKIPPED nor KEEP. This includes:
   - **Interactive but server-substance tests** — click + flash message, click + redirect, click + DB state change asserted via UI, permission-gated visibility
   - **Pure client validation** — form validation messages with no server call, dropdown option filtering
   - **Non-interactive rendering tests** — `expect(f('.foo')).to be_displayed`, text/element presence assertions, feature-flag→HTML state checks. These used to be classified `DELETE_TRIVIAL` and auto-deleted, but that was sneaking auditor opinion into the verdict. Now they go through the same coverage check as everything else.

   Every COVERAGE-CANDIDATE needs a coverage check before it gets a final verdict.

3. For every COVERAGE-CANDIDATE, grep for existing coverage:
   - Ruby: `spec/controllers/`, `spec/requests/`, `spec/models/`, `spec/policies/`, `spec/views/`, `spec/apis/`
   - JS: `ui/**/__tests__/`, `ui/**/*.test.{ts,tsx,js,jsx}`, `packages/**/__tests__/`
   - Match on controller action name, route, component name, behavior. "Equivalent" means same intent and same observable effect, not identical wording.

4. Emit results as CSV rows (no header — the synthesis step adds it). Every `DELETE_COVERED` and `PARTIAL` row MUST have `existing_coverage` populated as `<path>:<line>`.

### 4. Synthesize

Concatenate all batch outputs with a single header row. Write to `tmp/selenium-audit/<directory-name>.csv`. Validate:

- Every row has 11 columns
- `verdict` is one of the 5 enum values (`KEEP`, `DELETE_COVERED`, `DELETE_SKIPPED`, `PARTIAL`, `WRITE_NEW`)
- `confidence` is one of the 3 enum values
- `DELETE_COVERED` and `PARTIAL` rows have a non-empty `existing_coverage` matching the format `<path>:<line>` where `<line>` is a positive integer
- `KEEP` / `WRITE_NEW` rows have empty `existing_coverage`
- `DELETE_SKIPPED` rows have empty `existing_coverage` but may have populated `skip_date` and/or `skip_ticket`
- `skip_date` matches `YYYY-MM-DD` if present
- `skip_ticket` matches `[A-Z]{2,}-\d+` if present
- All other rows have empty `skip_date` and `skip_ticket`
- `auditor_note` may be populated on any row but is most useful on `WRITE_NEW` rows where the engineer needs a triage hint

If any row fails validation, fix it before writing.

### 4b. Verify citations

For every `DELETE_COVERED` and `PARTIAL` row, verify the cited test actually exists. This catches hallucinated citations from the batch agents.

**Batch existence check first (single Bash call):**

Collect every unique path from `existing_coverage` and issue all `test -f` checks in
one Bash command rather than per row:

```bash
while IFS= read -r path; do
  test -f "$path" && echo "OK:$path" || echo "MISSING:$path"
done <<'EOF'
<path1>
<path2>
...
EOF
```

Mark rows whose path came back `MISSING` immediately (downgrade + append
`(citation unverified)` to `reason`). Only proceed to per-row checks below for
paths that passed.

**Per-row checks (only for paths that passed the existence check):**

1. Split `existing_coverage` on the last `:` into `<path>` and `<line>`.
2. Check `<line>` is a positive integer within the file's line count (`wc -l`).
3. Spot-check that the cited line is inside or near an `it`/`describe`/`context` block — read lines `<line> - 5` through `<line> + 5` and confirm it looks like a test, not a stray import line.

If a citation fails verification:
- Malformed `existing_coverage` (missing `:`, no line, line not an integer) → downgrade `confidence` to `LOW` and append ` (citation malformed)` to the `reason` column.
- File missing or line out of bounds → downgrade `confidence` to `LOW` and append ` (citation unverified)` to the `reason` column. Do not silently drop the row.
- Citation looks unrelated to a test definition → reclassify verdict as `PARTIAL` with reason "cited coverage could not be matched to a test block, manual review needed".

This step is cheap (one `test -f` + one `sed -n` per row) and prevents the downstream code-modification skill from acting on bad references.

### 5. Write the summary

Companion `tmp/selenium-audit/<directory-name>.summary.md` with:

- Total `it` count
- Verdict breakdown (count + percentage)
- Top 5 `HIGH`-confidence quick-win deletions (file:line + reason)
- Files with the highest WRITE_NEW count (where new authoring work concentrates)
- Caveats: any classifications you marked `LOW` confidence and why

### 6. Report to the user

In your final message, give:
- The CSV path
- The verdict-count summary (one line)
- The handoff phrasing: "Pass this CSV to your code-modification skill, which should act on HIGH-confidence rows first."

## Calibration

First run on a new repo (or after the codebase has shifted significantly) — spot-check 5 random `DELETE_COVERED` rows by manually inspecting both the selenium test and the cited lower-level test. If the matches don't hold up, tighten the prompts or downgrade confidence rules before processing more directories.

## Anti-patterns to avoid

- **Don't classify by file** — every `it` block gets its own row. Files often mix KEEP-worthy and DELETE-able tests.
- **Don't mark `DELETE_COVERED` without a `path:line` citation.** If you can find the file but not a specific line, you haven't done enough work — find the line, or pick `WRITE_NEW`/`PARTIAL` instead.
- **Don't sample.** Read every `it` block in scope. Sampling produced miscounts in pilot runs.
- **Don't default to HIGH confidence.** When unsure, pick MEDIUM or LOW. The downstream skill will only auto-act on HIGH.
- **Don't infer "covered" from a controller spec that exists but tests a different scenario.** Same action, different behavior is not coverage — it's `PARTIAL` at best.
- **Don't put auditor opinion in the verdict.** A test that looks trivial but has no verified lower-level coverage is `WRITE_NEW`, not "DELETE because it's trivial." The opinion goes in `auditor_note` ("trivial rendering — recommend accept loss") so the engineer can rubber-stamp it during triage. Verdicts are data; notes are opinion.
