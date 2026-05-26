---
name: request-test-file-grader
description: Grade every `it` block in a Canvas request spec file by fanning out parallel `request-test-grader` subagents. Writes per-spec reports to `tmp/grade-reports/`; emits only the summary table in chat. Does not edit project files.
when_to_use: Invoke when the user asks to "grade the whole file", "grade all the specs in this file", "audit this request spec", or wants per-`it` grades for an entire request spec file. For grading a single `it`, use `request-test-grader` instead.
argument-hint: "[path-to-spec-file]"
model: sonnet
effort: medium
disable-model-invocation: false
user-invocable: true
allowed-tools: Read Grep Agent Bash Write AskUserQuestion
---

## Purpose

Grade every `it` block in a Canvas request spec file. The skill does discovery and aggregation in the main session; the grading itself happens in isolated `request-test-grader` subagents, one per `it`, spawned in parallel waves. The grader agent is the authority for per-`it` verdicts — this skill never grades anything itself.

For grading a single `it`, use the `request-test-grader` skill instead. This skill is the file-level orchestrator.

## Workflow

Run the steps in order. Do not narrate transitions — emit only the outputs the steps specify.

The full argument string is available as `$ARGUMENTS`. Parse it into:

- **path** — the first non-flag token. If absent, use `AskUserQuestion` to ask the user to enter a relative file path to the spec file they want to grade.

Reject any flags or extra tokens with a single-line error and stop:

```
Unexpected argument: <token>. Usage: /request-test-file-grader <path-to-spec-file>.
```

Then proceed.

### 1. Verify the target

The grader applies only to request tests. Run two checks in order; the first failure stops the skill with the indicated message and no further work.

**1a. File exists.** Confirm `path` is a readable file. If it doesn't exist, stop and print:

```
File not found: <path>
```

**1b. Request-test category.** Confirm one of these:

- The path is under `spec/requests/`, `spec/integration/`, or `spec/apis/`, *or*
- The file declares `type: :request` (use `Grep` to check for `type: :request` in the file).

If neither holds, stop and print exactly one line:

```
The request-test grader applies only to request tests. <path> is not under spec/requests/, spec/integration/, or spec/apis/, and does not declare `type: :request`.
```

Do not invoke any agents.

### 2. Discover `it` blocks

`Grep` the file with output mode `content` and `-n` to capture line numbers. Match the pattern `^\s*(it|specify|example)\s+['"]` (lines that start an `it` block with a description string).

For each match, capture:
- **line:** the line number from grep
- **description:** the quoted string after `it`/`specify`/`example` (substring after the first `"` or `'`, up to the matching closing quote). Truncation is fine if the description spans multiple lines — record what's on the matched line.

**Inline `it { ... }` (no description).** If the line matches `^\s*it\s+do` or `^\s*it\s*\{`, treat it as a candidate but record its description as `(no description)`. The grader can still handle it.

If discovery yields zero candidates, stop and print:

```
No `it` blocks found in <path>. Nothing to grade.
```

### 3. Confirm the run

Always prompt before spawning any graders. The user should see the expected cost and wall time before committing — small files are cheap, but a misclick on a 400-`it` file is not, and the prompt is consistent regardless of size.

Compute estimates from the empirically-measured per-grader cost (~$0.13, ~60 s wall time on Sonnet 4.x):

- **Estimated cost** (USD) = `N × 0.13`, rounded to one decimal.
- **Estimated wall time** = `ceil(N / 10)` minutes (each wave runs up to 10 graders in parallel, each grader ~60 s).

These are rough — actual cost varies with controller size and `it` complexity; treat them as order-of-magnitude and quote them as "≈" values.

Use `AskUserQuestion` with the question:

```
This file has <N> `it` blocks. Estimated cost ≈ $<cost>, wall time ≈ <minutes> min. Proceed?
```

Two options:

- **Proceed** — continue to step 4 (Announce the run).
- **Cancel** — exit cleanly with a single line: `Cancelled. No graders spawned.` Do not create the output directory; do not call any agents.

### 4. Announce the run

Print one line so the user sees what's about to happen:

- N ≤ 10 (single wave):
  ```
  Grading <N> `it` blocks in <path>…
  ```
- N > 10 (multiple waves):
  ```
  Grading <N> `it` blocks in <path> in waves of 10…
  ```

### 5. Fan out in waves

Process candidates in **waves of 10**, in source order (lowest line first). For each wave, emit a **single assistant message containing one `Agent` tool call per candidate in the wave** — they run in parallel. Wait for the wave to complete before starting the next.

*Why 10.* Wave size only affects wall time — token cost per grader is fixed regardless of batching. The cap is a chosen default, not a derived ceiling. Two real considerations push toward a small number rather than fanning out unbounded:

- **Org-level rate limits.** All subagents share the org's [Anthropic API rate limits](https://platform.claude.com/docs/en/api/rate-limits) (ITPM in particular — Sonnet 4.x ITPM ranges from 30 K at Tier 1 to 2 M at Tier 4). A single grader uses on the order of 20 K input tokens; a wave that's too wide can saturate the ITPM budget for ~60 s and 429 itself or any parallel session on the same org.
- **Empirically untested wider fan-outs.** Claude Code doesn't publish a per-message parallelism cap; very-wide tool fan-outs in a single assistant message are not a well-trodden path, so 10 stays inside the range that's been exercised in practice.

Raise deliberately if you know your org tier can absorb it and you've watched a real run not 429.

For each `Agent` call:

- **subagent_type:** `request-test-grader`
- **description:** `Grade <basename>:<line>`
- **prompt:** the bare `<path>:<line>`, e.g. `spec/requests/courses_api_spec.rb:42`. No prefix, no extra prose — the agent's input contract is a single `path:line` string.

Do not pass any other context. Each agent loads the rules file and resolves the controller on its own.

### 6. Parse each agent's result

Each agent invocation produces one of four outcomes. Classify each before writing files (step 7) and before the summary (step 8). The classification keys off whether the result contains a `<report>` block — diagnostic length is not part of the test, so a multi-line caller-misuse message is still **ungraded**, not malformed.

- **Graded.** Result contains a `<report>...</report>` block whose body ends with a `=== machine-readable === ... === end ===` trailer carrying all four fields (`result`, `failures`, `passing`, `na`). The normal case.
- **Ungraded.** Result has **no** `<report>` block at all — the grader stopped before emitting one (caller-misuse diagnostic, agent refusal, empty output, etc.). Capture the raw text verbatim.
- **Malformed.** Result has a `<report>` block but the trailer is missing, truncated, or its fields don't match the parser contract (missing field, unexpected field, `result` value outside `{pass, fail}`, slugs not kebab-case, or the same slug appearing in more than one of `failures` / `passing` / `na`). Capture the raw text verbatim. Do not retry.
- **Agent error.** The `Agent` tool itself failed (timeout, refusal, tool error — no usable result body). Capture whatever error string is available.

For each `Graded` result, extract the trailer fields:

- `result` → `pass` or `fail`
- `failures` → comma-separated kebab-case slugs of rules with `fail` verdict. May be empty (`failures=`); an empty value coincides with `result=pass`.
- `passing` → comma-separated kebab-case slugs of rules with `pass` verdict. May be empty (`passing=`).
- `na` → comma-separated kebab-case slugs of rules whose trigger condition was absent. May be empty (`na=`).

Do not retry any outcome — surface failures honestly. A retry policy is a separate decision; this skill is single-pass.

### 7. Write per-spec reports to disk

Full `<report>` blocks are *not* printed to chat — nobody reads 20 inline reports, and the directory is a more useful artifact (persistent, shareable, scriptable against later). Write each report to a file instead and emit only the summary in chat (step 8). Writing-to-disk doesn't save output tokens versus printing-to-chat — the model emits the report content either way — but it dominates on UX.

#### 7a. Create the output directory (once, before the first wave)

Compute the basename of the spec file without extension (e.g. `spec/requests/courses_api_spec.rb` → `courses_api_spec`). Before launching the first wave, issue **one** `Bash` call that builds the dir name with a timestamp, creates it, and prints the resulting path on stdout:

```
DIR="tmp/grade-reports/<basename>-$(date +%Y%m%d-%H%M%S)" && mkdir -p "$DIR" && echo "$DIR"
```

Capture stdout as `<outdir>` and use it verbatim for every `Write` below.

#### 7b. Write one file per candidate (after each wave)

After each wave completes, write `<outdir>/L<line>.md` for every candidate in that wave. File contents depend on the outcome from step 6:

- **Graded** — write the agent's full `<report>...</report>` block verbatim. Tags, markdown body, and `=== machine-readable ===` trailer all preserved.
- **Ungraded** — write the raw agent output verbatim with a leading line `UNGRADED — agent returned no <report> block:` so the consumer can tell at a glance the grader stopped before producing a verdict.
- **Malformed** — write the raw agent output verbatim with a leading line `MALFORMED — <report> block present but trailer missing or invalid:` so the consumer knows the grading attempt produced output that didn't match the parser contract.
- **Agent error** — write the captured error string verbatim with a leading line `AGENT ERROR — Agent tool call did not return a usable result:` so the consumer can distinguish tool failures from grader output.

Do not edit, reformat, or summarize report bodies. Downstream parsers depend on the trailer contract.

#### 7c. Write the running summary file (after each wave)

After each wave's per-candidate files are written, also (re-)write `<outdir>/summary.md` with the summary computed from the results gathered so far (same shape as step 8, but only covering candidates that have completed). The file is overwritten on each wave so it always reflects the current state. This way a Ctrl-C mid-run still leaves the user with a usable summary of what *did* grade, alongside the per-spec files for the completed candidates.

### 8. Emit the chat summary

Emit exactly three sections in this order. **Do not** include any `<report>` blocks here.

#### 8a. Summary table

GitHub-flavored markdown. One row per candidate, in source order. Columns:

| Column | Contents |
|--------|----------|
| `#` | 1-based row index |
| `Line` | the `it` line number |
| `Description` | the captured description string, truncated to ~60 chars with `…` if longer |
| `Result` | the trailer's `result` uppercased (`PASS` or `FAIL`), or `—` for ungraded/malformed/error |
| `# Fails` | count of slugs in the trailer's `failures` field (`0` on a passing test), or `—` for ungraded/malformed/error |
| `Failing rules` | up to 3 slugs from the trailer's `failures` field, comma-separated (e.g. `literal-path, reload-assertions, no-magic-values`); if more than 3, append `+N` for the remainder (e.g. `literal-path, reload-assertions, no-magic-values +2`); `—` if `failures` is empty or the outcome is ungraded/malformed/error |
| `Status` | blank when graded; `ungraded`, `malformed`, or `error` otherwise |

The grader emits `failures` in source-line order (per its `Failures` sort rule), so the first 3 slugs are the earliest violations in the `it` body. No re-sort, no rules-file lookup.

#### 8b. Aggregate counts

A short bullet list:

- `Graded: <G>/<N>` (where G is graded, N is total candidates)
- `Results: <P> pass, <F> fail` (across graded reports; omit either side if zero)
- `Total failures: <X>` (sum of slug counts in `failures=` across all graded reports — the number of rule violations to fix)
- `Top failing rules: <slug> ×<n>, <slug> ×<n>, …` (rules ranked by how many graded `it`s failed them; cap the line at the top 5 rules; omit the line entirely if `Total failures` is zero)
- `Non-graded: <U> ungraded, <M> malformed, <E> agent errors` (omit categories with zero count; omit the whole line if all three are zero)

#### 8c. Report directory pointer

A short footer telling the user where the per-spec reports landed. Exact shape:

```
Full per-spec reports: `<outdir>/`
  summary.md       — this summary
  L<line>.md × <N> — one file per spec, full <report> block (or diagnostic / error) inside
```

Do not list every individual file path — the `L<line>.md × <N>` form is enough; the user can `ls` the directory.

## Boundaries

- **Whole-file scope, no sampling knob.** This skill grades every `it` in one file. There is no per-run cap — to grade a subset, invoke `request-test-grader` on specific `path:line` targets directly. A partial cap was considered and dropped: the natural follow-up to "grade the first N" is "now grade the next N," which would force the user to re-run the already-graded N to pick up the remainder — useless ceremony for no real value.
- **Does not edit project files.** The only filesystem writes go to `tmp/grade-reports/<basename>-<timestamp>/`. Source files, specs, and controllers are read-only.
- **No controller pre-resolution.** Each grader resolves its own route and controller independently. This wastes some tokens (each agent re-reads the rules file and re-resolves the controller) but keeps the grader agent autonomous and the orchestrator simple. Pre-resolution is a possible later optimization, not part of v1.
- **Full reports never go to chat.** They go to disk only. The summary table plus the report-directory pointer is the chat contract. This is a UX decision, not a cost optimization — the model emits the report content either way (`Write` tool inputs are output tokens too), but a directory of files is a more useful artifact than 20 inline reports a human won't read.
- **Single-pass, no retry.** Each candidate gets exactly one `Agent` call. Tool failures, malformed output, and caller-misuse diagnostics all surface in the summary as-is. Retry policy is a separate concern; this skill is the orchestrator, not a recovery layer.

## Example invocations

```
/request-test-file-grader spec/requests/courses_api_spec.rb
/request-test-file-grader spec/apis/v1/courses_api_spec.rb
```

