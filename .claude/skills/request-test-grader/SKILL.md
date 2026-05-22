---
name: request-test-grader
description: Grade a single Canvas request test (`it` block) against the Canvas request-test rules. Returns a letter grade, per-rule verdict, and prioritized fixes. Report-only — no edits made.
when_to_use: Invoke when the user asks to "grade", "review", "assess", or "validate" a Canvas request test, or wants to check whether a request test follows the Canvas request-test rules. Also useful for auditing existing request specs in this repo.
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

Grade exactly one Canvas request test (`it` block) against the rules defined in `.claude/skills/_shared/request-test-rules.md`. Emit a letter grade, a per-rule verdict, and a prioritized list of fixes. Make no changes.

This skill is a thin entry point. The actual grading is performed by the `request-test-grader` subagent. The skill's job is input parsing, agent invocation, and relaying the report. **Do not** grade the test yourself in this skill's context — that defeats the agent isolation that the architecture is designed around (see `.claude/skills/request-test-grader/DESIGN.md`).

## Workflow

Run the steps in order. Do not narrate transitions — just emit the specified outputs.

The agent only accepts `path:line`. This skill is responsible for collapsing any description-based input down to a single line number before invocation. Ambiguity and "no match" are handled here, not by the agent.

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

### 3. Spawn the grader agent

Invoke the `request-test-grader` subagent via the Agent tool. The `subagent_type` is `request-test-grader`. The `prompt` is just the resolved target, e.g. `Target: spec/requests/courses_api_spec.rb:42`. The agent owns its own input contract, workflow, and output schema — do not restate them in the prompt. If you find yourself tempted to add instructions, edit the agent file instead.

The `description` field of the Agent invocation should be a short tag like `Grade <basename>:<line>` — enough for the call to be identifiable in the user's transcript.

Spawn the agent in the foreground. The user is waiting on the report; backgrounding would only make sense if you were doing additional work in parallel, which you are not.

### 4. Relay the report

Print the agent's report verbatim. Do not:

- Reformat it.
- Add a preamble ("Here's the grade for your test:").
- Add a summary or interpretation after it.
- Convert any of its structure to markdown headers, tables, or code blocks beyond what the agent already emitted.

## Boundaries

- **Report-only.** This skill does not edit the test, the controller, or any other file. Fixing violations is the user's job (or a separate skill's). If the user asks the skill to fix the violations, suggest they re-invoke the `request-test-writer` skill with the corrected scenario, or apply the fixes manually using the `Top fixes` list as a punch-list.
- **One `it` per invocation.** This matches the agent's contract. To grade a whole file or directory, invoke this skill once per `it`. (A future batch skill could spawn N agents in parallel — that is out of scope here, intentionally; see `DESIGN.md`.)
- **No interactive disambiguation of rules.** If the user asks "why did you mark X a ✗?", point them to the rule slug in the report and the shared rules file. The skill does not re-litigate rules; the rules file is the canonical answer.

## What the grader checks

The full list of rules, their reasoning, the severity classifications, and the letter-grade rubric live in:

```
.claude/skills/_shared/request-test-rules.md
```

If the user asks what rules the grader applies, `Read` that file and relay its contents (or the relevant section). Do not paraphrase from memory — the file is the authoritative source.

The skill deliberately does **not** `@include` the rules file here. The rules are loaded into the *agent's* context at grade time (the agent `@include`s them); loading them into this skill's main-session context on every invocation would erode the token savings the agent architecture is designed to capture. See `DESIGN.md` for the full reasoning.

## What the grader emits

The output contract (two modes — shape-check refusal and standard grading — plus emission rules) lives in:

```
.claude/skills/request-test-grader/references/report-template.md
```

If the user asks what the report looks like or why a particular line in the report is shaped a certain way, `Read` that file and relay the relevant section. Same non-`@include` reasoning as above: the template is in the *agent's* context at grade time, not the skill's.

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
