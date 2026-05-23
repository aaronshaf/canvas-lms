# request-test-grader: Architecture Decision Record

Audience: engineers maintaining the `request-test-writer` and `request-test-grader` skills.

Not referenced by the skill or agent files at runtime. This document exists to explain *why* the grader is shaped the way it is, so future maintainers can evaluate proposed changes against the original reasoning rather than re-deriving it from scratch.

## Problem statement

Two needs:

1. The `request-test-writer` skill needs a validation step that confirms a freshly-written request test obeys the writer's own composition rules (one-it, aaa-headers, verify-stubs, reload-assertions, etc.). The writer's prior Self-review step was a hand-rolled checklist inside the writer's SKILL.md — easy to drift from the rules above it, easy for the model to "tick" without actually verifying.
2. Existing request specs in this repo predate the shared request-test rules. We want to audit them and surface specific, prioritized improvements without rewriting the suite blind.

Both needs reduce to the same primitive: **given one `it` block, apply the shared request-test rules and emit a verdict.** The grader is that primitive.

## Architecture

```
.claude/
├── agents/
│   └── request-test-grader.md            ← workflow + rules @include + inline output schema
└── skills/
    ├── request-test-writer/
    │   └── SKILL.md                       ← @includes shared rules; invokes the grader agent
    └── request-test-grader/
        ├── SKILL.md                       ← user-invocable entry point; spawns grader agent
        └── references/
            ├── request-test-rules.md     ← canonical rules + rubric (SoT)
            ├── test-cases.md             ← behavioral contract / QA checklist
            └── design.md                  ← this file
```

Three artifacts, one canonical source of truth per concern:

- **`references/request-test-rules.md`** holds every composition rule, its reasoning, and the severity/letter-grade rubric. Nothing else *describes* the rules — every consumer `@include`s this file.
- **`agents/request-test-grader.md`** holds the workflow (validate input, locate `it`, resolve route, read controller, grade each rule, emit report) and the report's output schema (worked example, critical invariants, trailer schema) inline in a single file. It `@include`s the shared rules but does not restate any rule content.
- **`skills/request-test-grader/SKILL.md`** is the user-facing entry point. It parses input, resolves description-style targets down to a concrete `path:line` (via `Grep` + an `AskUserQuestion` disambiguation loop when multiple `it` blocks match), spawns the agent, and relays the report verbatim. Description resolution lives in the skill, not the agent — see *Decision: where target resolution lives*, below. The skill is deliberately ignorant of the report's shape: the agent owns its output contract.

The writer skill's former Self-review step becomes "invoke the grader agent and act on its verdict."

## The central decision: agent vs. skill-to-skill

The grader could have been just another skill that the writer invokes via the `Skill` tool. We chose an agent instead. Three reasons, in increasing importance:

### 1. Context isolation as a design forcing function

A skill invoked by another skill is a function call within one context: it inherits ambient state and can *implicitly* depend on whatever the caller happens to have already loaded (the writer just read the controller; the grader can "just see" it). A subagent is a process boundary: implicit dependencies become explicit arguments. If the grader needs the controller path, it must be passed in or re-derived. That constraint surfaces design defects early — input/output gets defined honestly, not by accident.

### 2. Quality of judgment under bounded context

A focused agent context (rules + one `it` + one controller) reasons more reliably about rule application than a model whose main context is already heavy with the writer's workflow, pre-flight artifacts, and prior tool output. The grader's job is essentially careful pattern-matching against a rubric; it benefits more from a clean context than almost any other step in the writer's pipeline.

### 3. Scaling characteristics

The strongest argument. Per-grade *work* (reading the spec, the controller, sometimes routes/precedents) is fixed regardless of design — both options pay roughly the same raw read cost. **What scales differently is where that work lands in context.**

| Scale | Skill-in-main-session | Agent (one per `it`) |
|---|---|---|
| 1 `it` | ~10–20k in main session | ~10–20k in agent context; ~1k report in main |
| 30 `it`s (whole file) | ~300–600k accumulating in main; compaction likely | ~30k of reports in main; agent work isolated |
| 200 `it`s (directory) | Impossible in one session | ~200k of reports in main; agents parallelize |

The skill design bloats main context linearly in N. Every subsequent turn re-bills that bloat. Thirty grades followed by twenty turns of "help me fix these" pays 300–600k × 20 = 6–12M tokens of re-billed bloat under the skill design; ~30k × 20 = 600k under the agent design.

Two compounding effects, both available only to the agent design:

- **Prompt caching.** The agent's system prompt + shared rules file (~7–8k tokens) cache for ~5 minutes. Repeated grades within a session hit warm cache; subsequent invocations effectively skip the overhead. Skill-in-main cannot cache because the surrounding main context shifts on every grade, invalidating prefix matches.
- **Parallelism.** N agents can grade concurrently. N skill calls are serial. Wall-clock matters when auditing a directory.

## Costs we accepted

The agent design is *not* free. Honest accounting:

- **Per-single-grade raw API spend is ~5–20k tokens higher** than the skill design (agent prompt overhead, rules file loaded once in main context and once in agent context, some duplicated controller reads if the writer already had them).
- **One additional file to maintain** (the agent definition). Mitigated by keeping the agent file *purely workflow*: rule content lives only in the shared file via `@include`.
- **One additional invocation pattern** the writer must use (Agent/Task tool instead of Skill tool).
- **Two contexts loaded at peak** (main + agent) during invocation.

These costs are paid once per invocation. The savings compound across every subsequent turn in the session. The break-even is roughly "one follow-up turn" — and grading almost always has follow-up turns (rewrite-regrade loops in the writer; "now help me fix the violations" sessions for existing-test audits).

## Discipline this design demands

Future maintainers: these are not stylistic preferences. Violating any of them collapses the design's value.

1. **Rule content lives only in `references/request-test-rules.md`.** The agent file does not restate rules. The writer SKILL.md does not restate rules. The grader SKILL.md does not restate rules. All three `@include` the shared file. The instant a second copy of any rule appears, drift begins.
2. **The agent grades one `it` per invocation.** Batch grading (file, directory) is implemented by spawning N agents *outside* the agent, not by teaching one agent to loop. Looping inside the agent defeats the context-isolation win.
3. **The agent is read-only and hermetic.** Tools: Read, Grep, Glob — no shell, no Edit, no Write. No Docker/Rails dependency, no non-determinism from external processes. The verdict is a report. Any "apply the fix" workflow lives elsewhere.
4. **The grader skill is thin *with respect to grading*.** It owns input parsing and target resolution (description → `path:line`, via `Grep` + `AskUserQuestion`) — that work is intentionally skill-side because it's interactive and uses tools the agent doesn't have. It does *not* duplicate the agent's grading logic: rule application, route resolution, controller reading, severity classification, and report emission all live in the agent. If the skill starts reading controllers, applying rules, or rendering verdicts, that's a smell — that work belongs in the agent.

## When to revisit

Reconsider the agent boundary if:

- Profiling shows grading is consistently the final step in sessions (no follow-up turns). Then the agent's overhead is paid without amortization, and a skill-to-skill design wins. *Not expected:* the writer's rewrite-regrade loop and the existing-test audit use case both have heavy follow-up.
- Prompt caching semantics change such that skill-to-skill invocations gain cache hits across main-context shifts.
- The shared rules file grows to a size where loading it into the agent context per-invocation dominates the cost picture. At that point, consider splitting the rules into a smaller "rubric" the agent loads and a larger "reasoning" appendix the agent only reads on demand.

### Other Design Decisions

## Decision: where target resolution lives

The agent's input contract is `path:line` only. Description-style targets ("grade the `it` that says X") are resolved in the calling skill before invocation.

An earlier iteration accepted both forms at the agent boundary, with the agent emitting an `ambiguity` mode report when a description matched multiple `it` blocks (Canvas specs frequently repeat `it "..."` descriptions across `describe`/`context` blocks). The skill then parsed that report and used `AskUserQuestion` to disambiguate. We moved resolution into the skill for two reasons:

1. **`AskUserQuestion` is a skill-side tool.** Threading user-facing interactivity through a structured agent-report contract required the agent to emit a machine-parseable Candidates table — markdown tables embedded in a trailer, escape rules for pipe characters in `describe` descriptions, plus a prose-vs-trailer consistency rule. None of that is needed if the skill simply greps the file itself and constructs `AskUserQuestion` options from the matches.
2. **Cheaper rejection paths.** Not-found and ambiguity are both detectable with one `Grep`. Spawning an agent just to learn "your description doesn't match anything" was wasted overhead.

The narrowed agent contract has a single output mode: the grading report. Non-request `it` blocks produce a degraded report (`route-unresolvable` in the Route row, many rules marked `N/A`) rather than a structured refusal.

## Decision: no shape refusal mode

An earlier iteration of the grader had a second output mode — *shape refusal* — for the case where the caller pointed at a non-request `it` (no HTTP-verb call in the body). The agent would detect the missing HTTP call during input resolution and emit a small templated report with `grade=N/A, refusal=true` in the trailer instead of running the rubric.

We removed it. The mode existed for ~one revision; the cost wasn't worth the value.

What was supposed to be a clean defensive mode turned out to be an attractor for incorrect grading behavior. Empirically, with shape refusal in the agent prompt:

- The agent learned the concept lexically from the prompt and applied it as a *path heuristic* — a target under `spec/models/` got "shape refused" without the agent ever reading the file (`tool_uses: 0`). The procedure said "read the body and check for an HTTP call"; the agent shortcut to "this directory implies no HTTP call." Adding language like "do not decide from the path prefix; you must read the body" did not help — it named the shortcut and made it more salient.
- Moving the shape check into the skill (so the agent sees only known-good targets) would have fixed the bug but added a parallel Read+regex pass in the skill duplicating work the agent does anyway, plus a second emission path the skill has to maintain.

The value the mode provided — a clean machine-readable refusal — turned out to be marginal. A non-request spec produces a degraded report with `route-unresolvable` and N/A everywhere; the user sees that and re-invokes. The structured refusal was a nicer error UX, not a correctness-critical signal.

The general lesson, worth carrying to the next agent design: **don't teach an agent prompt to distinguish failure categories it can shortcut on.** If two failure modes need different emission shapes, prefer collapsing them (degraded output for everything) or moving the dispatch upstream (the skill classifies before invoking the agent). Don't ask the agent to maintain the distinction in prose; it will optimize the prose, not the procedure.

The two-mode `request-test-grader` agent shipped briefly and was reverted as part of the commit that landed this section.

## Decision: per-rule table as projection anchor

QE on the branch that narrowed the grader's input contract surfaced two failures the existing emission rules didn't reliably prevent:

- **Inconsistent counts across sites.** Executive Summary count line, Top fixes severity tally, and trailer `blockers=` / `majors=` / `minors=` counts disagreed in the same report. One observed run emitted Executive Summary `3 blocker(s), 5 major(s), 3 minor(s)` and trailer `blockers=3, majors=3, minors=2` for a per-rule table that contained 2 blocker ✗, 3 major ✗, 2 minor ✗ rows — three different counts for the same quantity in one report.
- **Severity drift in Top fixes.** A major rule was listed once as a blocker and once as a major in the same report. RITE verdicts also drifted (`Readable` emitted as `Poor` with no blocker ✗ in its contributing rules).

Root cause: the template treated the Executive Summary, Top fixes, RITE verdicts, and trailer as independently-emitted views of the grading state. Each section re-derived severities and counts from working memory. By the time the trailer was emitted, working memory had drifted from the per-rule table. The "re-emit until consistent" rule was a post-hoc check the model applied to text it had already committed; models do not reliably self-audit emitted text mid-stream.

**Anchor decision:** the per-rule verdict table is the single source of truth for which rules failed and at what severity. Every other section is a mechanical projection of that table, computed once before any section is emitted. This is codified in the agent file's output schema as the "Projections are mechanical from the per-rule table" invariant, paired with an explicit grade-each-rule workflow step that commits the verdicts before emission begins.