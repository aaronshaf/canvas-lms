---
name: request-test-grader
description: Grade a single Canvas request test (`it` block) against the Canvas request-test rules. Returns a pass/fail grade and the list of failing rules with fixes. Report-only — no edits made.
when_to_use: Invoke when the user asks to "grade", "lint", "review", "assess", or "validate" a Canvas request test, or wants to check whether a request test follows the Canvas request-test rules. Also useful for auditing existing request specs in this repo.
argument-hint: "[<path>:<line> | <path> \"<it description>\"]"
arguments:
  - name: target
    description: Either `path:line` pointing at (or inside) the `it` block to grade, or `path` followed by a quoted `it`-description matcher. Examples — `spec/requests/courses_api_spec.rb:42`, or `spec/requests/courses_api_spec.rb "returns the requesting teacher's TeacherEnrollment"`.
    required: false
    default_behavior: If omitted or empty, the skill uses AskUserQuestion to collect the spec file path, then asks the user whether they want to target by line number or by `it` description, then collects the chosen identifier.
model: inherit
disable-model-invocation: false
user-invocable: true
allowed_tools:
  - AskUserQuestion
  - Read
  - Grep
  - Glob
  - Agent
---

## Purpose

Grade exactly one Canvas request test (`it` block) against the rules in `.claude/skills/request-test-grader/references/request-test-rules.md`. Make no changes.

This skill is a thin entry point. The `request-test-grader` subagent does the grading; the skill parses input, resolves any description-style target down to `path:line`, invokes the agent, and relays the report. **Do not** grade the test in this skill's context — that defeats the agent isolation the architecture is built around (see `references/design.md`).

The grader is one-tier: every rule is binary (`pass` / `fail` / `na`) and the test's grade is `pass` (zero `fail` verdicts) or `fail` (one or more `fail` verdicts). There is no severity gradient, no letter grade — pass/fail is the grade scale. See `references/request-test-rules.md` for the rules themselves.

**Scope.** This grader checks rules that RuboCop and similar static linters *cannot* enforce — rules that require reading the test's intent, the route under test, and the controller context together. RuboCop-enforceable rules belong in `.rubocop.yml`, not here; this skill is the complement to RuboCop, not a replacement.

## Workflow

Run the steps in order. Do not narrate transitions — just emit the specified outputs.

### 1. Parse the input

If the user invoked the skill with a target argument, parse it. Accept both forms:

- **`path:line`** — `spec/requests/courses_api_spec.rb:42`. Skip directly to step 3.
- **`path` + quoted description** — `spec/requests/courses_api_spec.rb "returns the requesting teacher's TeacherEnrollment"`. The quoted string may also be prefixed with `#` (e.g., `path#description`). Continue to step 2.

If no argument was provided, use `AskUserQuestion` to collect it. Ask in this order, one question at a time:

1. "What spec file?" — collect the path.
2. "Identify the `it` block by line number or by its description?" — two-option select.
3. Either "Which line?" (free-form integer) or "Which description?" (free-form text).

If the user answered with a line number, skip to step 3 with that `path:line`. If with a description, continue to step 2.

### 2. Resolve description to `path:line`

Use `Grep` to find lines in the spec file matching `it "<description>"` (substring match against the `it "..."` string is fine — exact-string matching is too strict for human input). Three cases:

- **Zero matches.** Print: ``No `it` block in `<path>` matched `<description>`. Try a different description, or pass `<path>:<line>` directly.`` Then stop. Do not invoke the agent.
- **Exactly one match.** Take that line number as the resolved target and continue to step 3.
- **Multiple matches** (common — the same `it "..."` description legitimately recurs under different `describe`/`context` blocks).
   1. `Read` the spec file. For each matching `it` line, walk *backward* through the file, tracking unclosed `do`/`end` pairs, and collect each enclosing `describe "..."` / `context "..."` description string until you reach the top of the file. The chain is outermost → innermost, joined by ` > ` (space-greater-space). If an enclosing block has no description string (e.g., `context do ... end`), use `<unnamed>` for that link.
   2. Build `AskUserQuestion` options — one per candidate, in source order (lowest line number first):
      - `label`: the innermost `describe`/`context` description, truncated to ~5 words. This is what the user sees at a glance.
      - `description`: the full context chain (outermost → innermost, joined by ` > `) followed by ` — <path>:<line>`. Long lines here are fine — `description` is the disambiguating context.
      Keep an internal mapping from each option to its line number; the user's selection only carries back the label/description, so the skill needs to know which line each option pointed to.
   3. `AskUserQuestion` allows at most 4 options. If there are more than 4 candidates, show the first 3 in source order and a fourth option with label `Other` and a description telling the user to re-invoke with a `path:line` target. If the user chooses `Other`, stop and wait for re-invocation; do not try to grade anything.
   4. Take the line number for the selected option from the internal mapping. That is the resolved target. Continue to step 3.

### 3. Verify the target is a request test

The grader applies only to request tests. Before invoking the agent, confirm one of these is true:

- The path is under `spec/requests/`, `spec/integration/`, or `spec/apis/`, *or*
- The file declares `type: :request` (e.g., `RSpec.describe "...", type: :request do`). Use `Grep` to check for `type: :request` in the file.

If neither holds, stop and print exactly one line:

```
The request-test grader applies only to request tests. <path> is not under spec/requests/, spec/integration/, or spec/apis/, and does not declare `type: :request`.
```

Do not invoke the agent. Model specs, controller specs, service specs, etc. fall outside this grader's scope.

### 4. Spawn the grader agent

Invoke the `request-test-grader` subagent via the Agent tool, in the foreground.

- **subagent_type:** `request-test-grader`
- **description:** `Grade <basename>:<line>`
- **prompt:** the resolved target, e.g. `spec/requests/courses_api_spec.rb:42`

The agent owns its own input contract, workflow, and output schema. Do not restate them in the prompt.

### 5. Relay the agent's output

The agent emits one of two output shapes; relay either verbatim — do not reformat, summarize, add a preamble, or modify any line inside the report content.

**Grader report (the normal case).** On a valid target, the agent wraps its report in `<report>...</report>` tags. Inside those tags the report has two parts: the human-readable markdown body, followed by a `=== machine-readable === ... === end ===` trailer (the parser contract) just before the closing tag. Print everything from the opening `<report>` through the closing `</report>`, inclusive — tags, markdown body, and trailer. The trailer block is not footer noise; it is the machine-parseable contract for downstream tools and must be preserved exactly as emitted. Before ending your turn, confirm your relay contains both `<report>` and `</report>`. If either is missing, your relay is incomplete — re-emit the full block from the agent's tool result.

Then, on a new line *after* the closing `</report>` tag, append exactly this one-line invitation (verbatim):

```
If you have questions about these results, ask me!
```

That line is outside the `<report>...</report>` block, so it does not interfere with the parser contract; it's a user-facing nudge that the model is still in context and can answer follow-up questions about any failure. Do not append any other postscript, summary, or commentary.

**Caller-misuse diagnostic.** On a malformed input or a target that doesn't resolve to an `it` block (file missing, line past EOF, line outside any `it`), the agent emits a single diagnostic line with no `<report>` tags and stops. Relay that line as-is. Do not wrap it in `<report>` tags, do not re-invoke the agent, do not run the tag-presence check, and do not append the questions-invitation line — none of those apply to this shape.

## Boundaries

- **Report-only.** This skill does not edit any file. To act on violations, re-invoke `request-test-writer` or apply the `Failures` fixes manually.
- **One `it` per invocation.** Matches the agent's contract. Grade a whole file by invoking once per `it`.

If the user asks what rules the grader applies, `Read` `.claude/skills/request-test-grader/references/request-test-rules.md` and relay the relevant section — that is the authoritative source.

## Example invocations

```
/request-test-grader spec/requests/courses_api_spec.rb:42
```

```
/request-test-grader spec/requests/courses_api_spec.rb "returns the requesting teacher's TeacherEnrollment"
```

```
/request-test-grader
```
(skill prompts for path → identifier mode → identifier)
