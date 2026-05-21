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
│   └── request-test-grader.md            ← workflow + I/O contract; @includes shared rules
└── skills/
    ├── _shared/
    │   └── request-test-rules.md         ← canonical rules + rubric (SoT)
    ├── request-test-writer/
    │   └── SKILL.md                       ← @includes shared rules; invokes the grader agent
    └── request-test-grader/
        ├── SKILL.md                       ← user-invocable entry point; spawns grader agent
        └── DESIGN.md                      ← this file
```

Three artifacts, one canonical source of truth:

- **`_shared/request-test-rules.md`** holds every composition rule, its reasoning, and the severity/letter-grade rubric. Nothing else *describes* the rules — every consumer `@include`s this file.
- **`agents/request-test-grader.md`** is a workflow definition only: parse input, resolve route, read controller, apply rules from the shared file, emit a structured report. It explicitly does not restate any rule content.
- **`skills/request-test-grader/SKILL.md`** is a thin user-facing entry point. It parses input (path:line or path + description matcher), spawns the agent, relays the report.

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

1. **Rule content lives only in `_shared/request-test-rules.md`.** The agent file does not restate rules. The writer SKILL.md does not restate rules. The grader SKILL.md does not restate rules. All three `@include` the shared file. The instant a second copy of any rule appears, drift begins.
2. **The agent grades one `it` per invocation.** Batch grading (file, directory) is implemented by spawning N agents *outside* the agent, not by teaching one agent to loop. Looping inside the agent defeats the context-isolation win.
3. **The agent is read-only and hermetic.** Tools: Read, Grep, Glob — no shell, no Edit, no Write. No Docker/Rails dependency, no non-determinism from external processes. The verdict is a report. Any "apply the fix" workflow lives elsewhere.
4. **The grader skill is thin.** It parses input, spawns the agent, relays output. It does not duplicate the agent's grading logic. If the skill grows substantive logic, that's a smell — it probably belongs in the agent.

## When to revisit

Reconsider the agent boundary if:

- Profiling shows grading is consistently the final step in sessions (no follow-up turns). Then the agent's overhead is paid without amortization, and a skill-to-skill design wins. *Not expected:* the writer's rewrite-regrade loop and the existing-test audit use case both have heavy follow-up.
- Prompt caching semantics change such that skill-to-skill invocations gain cache hits across main-context shifts.
- The shared rules file grows to a size where loading it into the agent context per-invocation dominates the cost picture. At that point, consider splitting the rules into a smaller "rubric" the agent loads and a larger "reasoning" appendix the agent only reads on demand.
