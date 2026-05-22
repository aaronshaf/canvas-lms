# Grader report template

Canonical output contract for the `request-test-grader` agent. `@include`d into the agent's prompt; nothing else describes the output format. Edits here are authoritative.

## Output modes

The grader emits one of two reports per invocation. The choice is determined by the agent's Input resolution step 2 (shape check). The modes do not mix — emit exactly one report, in full, and stop.

| Mode | When | Sections |
|------|------|----------|
| Shape-check refusal | Target is not a request test (no HTTP call in the `it` body) | Next step → Machine-readable trailer |
| Standard grading | Shape check passed | Title → Executive Summary → RITE Evaluation → Per-rule verdict → Top fixes → Machine-readable trailer |

Only standard grading mode emits the full report scaffolding (title, Executive Summary, etc.). Shape-check refusal is deliberately minimal — a `## Next step` section telling the caller what to do, followed by the machine-readable trailer. Nothing else. The trailer is the literal last block of every report. Nothing follows the trailer.

The agent assumes its caller resolved the target to a single `it` block before invoking — disambiguation of `it "..."` descriptions across multiple `describe`/`context` blocks happens upstream in the calling skill, not here.

## Shape-check refusal mode

Emit when the target's `it` body contains no HTTP call (`get`, `post`, `put`, `patch`, `delete` as the first non-comment token on a line) — the request-spec rules don't apply to this shape.

Emit verbatim:

```
## Next step

`<path>:<line>` ("<it description>") is not a request test — no HTTP call in the `it` body. Likely shape: <unit / model / service / other>, based on <one short signal, e.g. "described_class.new on line N, no response.parsed_body anywhere">. This grader is request-spec-only; use a different reviewer for this spec shape.

=== machine-readable ===
grade=N/A
refusal=true
=== end ===
```

## Standard grading mode

Emit using this section structure, in this order:

```
# Canvas Request-Test Grader Report

## Executive Summary

**Grade: <X>** — <Bn> blocker(s), <Mn> major(s), <Mn> minor(s)

| Field | Value |
|-------|-------|
| Target | `<path>:<line>` — "<it description>" |
| Route | `<verb> <path>` → `<Controller#action>` (or: route-unresolvable) |

## RITE Evaluation

| Dimension | Verdict | Notes |
|-----------|---------|-------|
| Readable | <Good / Mixed / Poor> | <one-line summary citing contributing ✗ rules, or `—` if Good> |
| Isolated | <Good / Mixed / Poor> | <...> |
| Thorough | <Good / Mixed / Poor> | <...> |
| Explicit | <Good / Mixed / Poor> | <...> |

## Per-rule verdict

| Rule | Result | Note |
|------|--------|------|
| <rule-slug> | ✓ | — |
| <rule-slug> | ✗ <severity> | <one-line specific finding> |
| <rule-slug> | N/A | <reason> |
| ... | ... | ... |

## Top fixes

Ordered blockers first (in source order), then majors, then minors.

| # | Severity | Location | Rule | Excerpt | Fix |
|---|----------|----------|------|---------|-----|
| 1 | <severity> | `<path>:<N>` | <rule-slug> | `<verbatim source line>` | <specific actionable rewrite> |
| 2 | ... | ... | ... | ... | ... |

(If the grade has no ✗ rows, this section emits a single line: `No fixes required.` — no table.)

## Machine-readable trailer

=== machine-readable ===
grade=<X>
blockers=<N>
majors=<N>
minors=<N>
fail=<comma-separated rule slugs marked ✗, or empty>
na=<comma-separated rule slugs marked N/A, or empty>
rite=readable:<v>,isolated:<v>,thorough:<v>,explicit:<v>
=== end ===
```

## Machine-readable trailer

Every report — both modes — ends with this block. It exists for non-LLM consumers (eval harnesses, CI hooks, scripts) that parse the grader's output programmatically. Humans reading the report ignore it; LLM consumers prefer the prose above.

The two modes emit different trailer contents (shown in their respective sections above), but the framing markers are identical: opening `=== machine-readable ===` and closing `=== end ===` on their own lines. A parser splits the output on these markers and reads the inner `key=value` lines.

Mode dispatch for parsers: standard mode has `blockers=`; refusal mode has `refusal=true`. A parser that finds neither has received malformed output.

### Field rules

| Field | Type | Format | Notes |
|-------|------|--------|-------|
| `grade` | enum | one of `A`, `A-`, `B`, `C`, `D`, `F`, `N/A` | ASCII hyphen-minus (U+002D), never Unicode minus (U+2212). Same value as Executive Summary's bold `**Grade: <X>**`. |
| `blockers` | integer | bare digits, no padding | Mirrors Executive Summary's count tally. |
| `majors` | integer | bare digits, no padding | Mirrors Executive Summary's count tally. |
| `minors` | integer | bare digits, no padding | Mirrors Executive Summary's count tally. |
| `fail` | slug list | comma-separated kebab-case, no surrounding spaces | Set of rule slugs marked ✗ in the per-rule verdict. Empty value (`fail=`) means the empty list. |
| `na` | slug list | comma-separated kebab-case, no surrounding spaces | Set of rule slugs marked N/A in the per-rule verdict. Empty value means the empty list. |
| `rite` | dimension verdicts | exactly four pairs `readable:<v>,isolated:<v>,thorough:<v>,explicit:<v>` where `<v>` is `good`, `mixed`, or `poor` | One pair per RITE dimension, in this order, comma-separated, no surrounding spaces. Lowercase verdicts. Mirrors the `## RITE Evaluation` table. Standard mode only. |
| `refusal` | bool | literal `true` | Present only in shape-check refusal trailers. |

Additional constraints:

- Fields appear in the order shown. Each field appears at most once.
- Standard-mode trailer has all of `grade`, `blockers`, `majors`, `minors`, `fail`, `na`, `rite`, and lacks `refusal`.
- Refusal-mode trailer has `grade=N/A` and `refusal=true`, and lacks the count/slug/rite fields entirely.
- All values are ASCII. No quoting, no escaping, no Unicode.
- Slugs come from `_shared/request-test-rules.md`. No slug appears in both `fail` and `na` for the same report.

## Emission rules (standard grading mode only)

- **Title is the literal first line.** The standard-grading report begins with `# Canvas Request-Test Grader Report` on its own line. No preamble, no leading whitespace, no alternate phrasing, no prose before the title. Reasoning emitted as plain text ahead of the title pollutes the report and is forbidden. (Shape-check refusal has no title — it opens directly with `## Next step`.)
- **Sections appear in the documented order.** `## Executive Summary` → `## Per-rule verdict` → `## Top fixes` → `## Machine-readable trailer`. No reordering, no omissions (use `No fixes required.` body when `Top fixes` has nothing).
- **Executive Summary opens with bold grade.** The Executive Summary's first non-blank line is exactly `**Grade: <X>** — <Bn> blocker(s), <Mn> major(s), <Mn> minor(s)`. `<X>` is one of `A`, `A-`, `B`, `C`, `D`, `F`, `N/A`. ASCII hyphen-minus in `A-`, never Unicode minus.
- **Executive Summary's Target/Route table is two columns.** `| Field | Value |`. The Route row reads `route-unresolvable` (verbatim) when the route couldn't be grepped from `config/routes.rb`.
- **Machine-readable trailer is mandatory and is the canonical machine target.** Every report ends with the trailer block. The trailer's `grade=` MUST match the Executive Summary's bold grade. The trailer's count fields MUST match the Executive Summary's count tally. The trailer's `fail=` slug list MUST equal the set of rule slugs marked ✗ in the per-rule verdict (same multiset; order doesn't matter). The trailer's `na=` slug list MUST equal the set of rule slugs marked N/A. If the prose and trailer disagree, the report is malformed — re-emit until they match. The writer skill's rewrite loop and the eval harness both read the trailer; mismatches silently break both.
- **RITE Evaluation is a four-row markdown table.** Columns: `Dimension | Verdict | Notes`. Rows in order: Readable, Isolated, Thorough, Explicit (one row each, no others). Verdict is exactly one of `Good`, `Mixed`, `Poor` (capitalized, no other forms). Apply the mechanical mapping from `_shared/request-test-rules.md` under **RITE dimensions / Dimension verdict** — all contributing rules ✓/N/A → Good; any non-blocker ✗ → Mixed; any blocker ✗ → Poor. Notes is a short citation of the contributing ✗ rules (e.g., `reload-assertions ✗, eql-for-numerics ✗`) for Mixed/Poor, or `—` for Good. The `rite=` field in the trailer MUST match this table's verdicts; mismatches are malformed.
- **Per-rule verdict is a markdown table.** Columns: `Rule | Result | Note`. `Result` is one of `✓`, `✗ blocker`, `✗ major`, `✗ minor`, or `N/A` literally — severity is folded into the cell for ✗ rows. For `✓` rows, fill `Note` with `—` (em dash, U+2014). For `✗` rows, `Note` is a one-line specific finding. For `N/A` rows, `Note` is a short reason (e.g., `no DB assertions`).
- **Order of `Per-rule verdict` rows:** follow the order rules appear in the shared rules file (Composition rules first, then Canvas-specific gradable rules). Stable ordering matters because the writer skill consumes this report and stable order keeps its rewrite loop deterministic.
- **One row per rule.** Every applicable rule appears exactly once. Long context goes in `Top fixes`, not in the `Note` cell.
- **No line numbers in the per-rule table.** Line citations belong in `Top fixes` under `Location`. The per-rule table answers "what fired and what didn't"; `Top fixes` answers "where and how to fix." For violations whose root is on a multi-line construct (e.g., a `before do ... end` block), append `(multi-line)` to the `Note` cell.
- **Top fixes is a markdown table.** Columns: `# | Severity | Location | Rule | Excerpt | Fix`. Rows ordered blockers first (in source order), then majors, then minors. `Location` is `<path>:<line>` in inline backticks. `Excerpt` is the cited source line in inline backticks, verbatim from disk. `Fix` is one or two sentences, actionable, referencing the rule slug.
- **Verbatim source-line excerpts** must match disk byte-for-byte (after any rubocop autofix the writer ran before grading). Backticks in the source line are rare in Ruby but, if present, do not need escaping in a markdown table cell — markdown handles inline-code-with-backticks fine. If the line contains a literal pipe `|` that would break the table, escape it as `\|`.
- **Empty Top fixes.** When grade is `A` (zero ✗ rows), emit the literal text `No fixes required.` as the only body of the `## Top fixes` section. No table, no placeholder rows.
- **`N/A` is a real verdict, not silence.** Rules that don't apply (`precedent-matched` when there's no sibling-service initiator and no outbound stub; controller-context rules when route is unresolvable) appear as `N/A` rows with a brief reason in `Note`. Silence implies ✓; if a rule doesn't apply, say so explicitly with a row.
- **No editorializing.** No "this is a good test" or "consider also..." beyond what the rules and rubric prescribe. The report is mechanical; judgment lives in the rules file.
- **No `Self-review` block at the end.** The grader is not self-reviewing its own work; it is reviewing someone else's test. Don't emit a meta-checklist.
