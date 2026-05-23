# request-test-grader — Test Cases

Behavioral contract for `/request-test-grader`. Run these whenever the skill or its grading agent is modified. All cases are framed as skill invocations and their observable outputs.

## Running the suite

Paste the prompt below into Claude Code (with this repo as the working directory) to execute every case and get a single PASS/FAIL verdict.

````
You are running QA on the request-test-grader skill. Execute the cases
in the .claude/skills/request-test-grader/references/test-cases.md file
and report PASS / FAIL / UNTESTED for each.

## Status discipline (read first)

- **PASS** — case verified by execution OR by reading the encoding
  line in `.claude/skills/request-test-grader/SKILL.md` /
  `.claude/agents/request-test-grader.md`. For non-execution PASSes,
  the Note column MUST cite the file and line (e.g., `SKILL.md L51`).
- **FAIL** — observed behavior contradicts the case.
- **UNTESTED** — not used. All cases are verifiable by execution or by reading the encoding line.

## Steps

1. Find each fixture's target line:

       grep -nE '^  it ' .claude/skills/request-test-grader/references/fixtures/*.rb

   Use the lowest `it` per fixture (some have a second `it` to trip
   the `one-it` rule — not the target).

2. Spawn all 9 `request-test-grader` agents in **one message**
   (multiple Agent tool calls in a single turn). Prompt for each:
   `Target: <fixture-path>:<line>`.

3. Verify each returned report against:

   - §8.2 — `grade=` matches the expected row.
   - §4 — trailer shape and consistency.
   - §5 — per-rule table slug set equals the slugs declared in
     `references/request-test-rules.md` (grep `^### ` for the list).
   - §6 — Top fixes rows sorted by **source line**, not rules-file
     order, within each sub-section.
   - §7 — each RITE verdict traced to its contributing-rules set in
     the rules file, not eyeballed.

4. For §1.3, §1.4, §1.5, §2.1–§2.4, §3.1, §3.2, and §9.\*, verify
   each case is encoded in SKILL.md or agent.md and cite the encoding
   line in the Note column. §1.4 and §3.2 are *also* exercised by
   step 2's fixture runs — note both. Do not skip this step; do not
   mark these UNTESTED.

Output:

- A `Case | Status | Note` table, one row per case. Notes MUST cite the encoding line (e.g., `SKILL.md L51`, `agent.md L24`).
- `## Failures` — case ID, expected vs. observed, `<fixture>:<line>`
  citation pointing at the graded `it`.
- `## Drift observed` (optional, advisory) — drifts no case catches;
  does not affect the verdict.
- A final line: `Overall: PASS` or `Overall: FAIL`.

Read-only on the codebase. Invoking the grader skill via the Skill
tool to execute §1.1 and §1.2 is part of QA execution, not a
mutation.
````

## Conventions

- Given/When/Then cases describe a user-visible behavior — not how the system reaches it.
- Checklists capture structural invariants of the output.

---

## 1. Input parsing & disambiguation

### 1.1 No argument → interactive collection

Given the user invokes `/request-test-grader` with no arguments
Then the user is prompted to supply the target. No report is emitted until a single `path:line` is resolved.

### 1.2 Description matches multiple `it` blocks → user picks

Given a `path` + description matching more than one `it`
Then the user is offered the candidates disambiguated by their enclosing `describe`/`context` chain. After selection, exactly one report is emitted.

### 1.3 Description matches zero `it` blocks → stop

Given a description matching no `it`
Then the user is told nothing matched and offered the option to pass `path:line` directly. No report is emitted.

### 1.4 `path:line` → report

Given a valid `path:line` pointing inside an `it` block
Then a report is emitted for that `it`.

### 1.5 `path` + description matching exactly one `it` → report

Given a `path` + description matching exactly one `it`
Then a report is emitted for that `it`. No disambiguation prompt is shown.

---

## 2. Bad targets

For every case in this section, the output is a single diagnostic line.
No report. No machine-readable trailer.

### 2.1 Malformed target

Given a target that is not `path:line` and not a recognized `path` + description form (e.g. missing line, non-integer line, extra tokens)
Then a single diagnostic line explains the problem.

### 2.2 File does not exist

Given a `path:line` whose file does not exist
Then a single diagnostic line explains the problem.

### 2.3 Line past end of file

Given a `path:line` whose line number exceeds the file length
Then a single diagnostic line explains the problem. No nearby `it` is silently graded.

### 2.4 Line not inside an `it` block

Given a `path:line` that points at a `describe`, blank line, comment, or other location outside any `it` block
Then a single diagnostic line explains the problem. No nearby `it` is silently graded.

---

## 3. Non-request spec targets

### 3.1 Path outside allowed dirs and no `type: :request` → refusal

Given a `path:line` whose file is *not* under `spec/requests/`, `spec/integration/`, or `spec/apis/`, *and* does not declare `type: :request` (model spec, service spec, controller spec, etc.)
Then the skill prints a single diagnostic line stating that the grader applies only to request tests. No agent invocation, no report.

### 3.2 Acceptance gate is path OR `type: :request`

Given a `path:line` whose file is under `spec/requests/`, `spec/integration/`, or `spec/apis/`, OR declares `type: :request`
Then the skill spawns the agent and produces a report — even if the path doesn't resolve to a Canvas route, and even if the `it` body issues no HTTP call (in which case `one-request` ✗ blockers against the missing call). The skill does not second-guess the file's contents beyond the gate above.

---

## 4. Trailer (machine-readable)

The trailer is the parser contract — these invariants are non-negotiable.

- [ ] All seven fields present and in order: `grade`, `blockers`, `majors`, `minors`, `fail`, `na`, `rite`.
- [ ] Each field appears exactly once.
- [ ] `grade` matches the bold `**Grade: <X>**` in the Executive Summary and uses ASCII hyphen (`A-`, never `A−`).
- [ ] `blockers` / `majors` / `minors` match the Executive Summary count tally and count distinct rule slugs (not Top fixes rows).
- [ ] `fail` set equals the set of ✗ rules; `na` set equals the set of N/A rules; no slug appears in both.
- [ ] `rite` has four pairs in the order `readable`, `isolated`, `thorough`, `explicit`, with lowercase verdicts matching the `## RITE Evaluation` table.
- [ ] Empty list fields render as `fail=` / `na=` — never `none` or `[]`.

---

## 5. Per-rule verdict table

- [ ] Rows appear in the order rules are defined in `request-test-rules.md`. Each applicable rule appears exactly once.
- [ ] The set of slugs in the Rule column equals the set of rule slugs declared in `request-test-rules.md` (Composition rules + Canvas-specific gradable rules). No invented slugs (e.g., `adequate-coverage`); no omissions. This is the integrity check against the model fabricating or skipping rules.
- [ ] N/A is explicit, with a reason in the Note cell. Silence never implies ✓.

---

## 6. Top fixes

### 6.1 Zero ✗ rules → "No fixes required."

Given a graded `it` with no ✗ rules
Then the `## Top fixes` body is exactly `No fixes required.` — no sub-section headings, no `(none)` markers.

### 6.2 Any ✗ rules → all three sub-section headers

Given a graded `it` with at least one ✗ rule
Then `### Blockers`, `### Majors`, `### Minors` all appear in that order. Empty sub-sections render `(none)` (no table). Populated sub-sections render the standard table.

### 6.3 One row per ✗ rule

Given a rule violated at multiple locations within one `it`
Then the rule contributes a single row whose Location cites the lowest violating line; the Fix may mention secondary locations inline.

### 6.4 Continuous numbering, source-order within sub-sections

Given a report with rows across multiple severity sub-sections
Then the `#` column counts continuously across sub-sections, and rows within each sub-section appear in source line order.

### 6.5 Locations use the caller's path form

Given the skill was invoked with a relative `path:line`
Then every Location in the report is relative — never rewritten to an absolute filesystem path.

---

## 7. RITE evaluation

- [ ] All contributing rules `✓` or `N/A` → `Good`; Notes cell is `—` (em dash).
- [ ] Any non-blocker `✗` → `Mixed`; Notes cell lists contributing ✗ rules.
- [ ] Any blocker `✗` → `Poor`; Notes cell lists contributing ✗ rules.
- [ ] Dimension verdicts derive from rules only — never from overall "feel" of the test.

---

## 8. Letter grade rubric

### 8.1 Grade derives mechanically from counts

Given the per-rule verdict counts
Then the grade is the first row in the rubric (in `request-test-rules.md`) whose condition matches.

### 8.2 Spot-check rubric rows

Hand-crafted `it` blocks under `fixtures/` produce a specific per-rule count signature when graded. They are not real tests — they live outside `spec/` so Canvas's suite never picks them up. Each fixture declares `type: :request` (so the skill's request-test guard accepts it) and uses an intentionally unresolvable path (`/api/v1/grader_fixture/...`) so controller-context rules deterministically grade `N/A — controller not resolved`, keeping the grade signal independent of Canvas's routing table.

To verify: invoke the grader agent on each fixture (target the first `it` line) and confirm the returned trailer's `grade=` matches the table below.

| Fixture | Expected `grade=` | Failing rules → boundary verified |
|---------|-------------------|-----------------------------------|
| `fixtures/rubric_a.rb` | `A` | (none) — A floor. |
| `fixtures/rubric_a_minus_one_minor.rb` | `A-` | `aaa-headers` — A- lower bound (not A). |
| `fixtures/rubric_a_minus.rb` | `A-` | `aaa-headers`, `symbol-statuses` — A- upper bound (not B). |
| `fixtures/rubric_b.rb` | `B` | `literal-path` — B via the majors arm. |
| `fixtures/rubric_b_minors.rb` | `B` | `aaa-headers`, `symbol-statuses`, `use-parsed-body` — B via the minors arm (not A-). |
| `fixtures/rubric_c.rb` | `C` | `reload-assertions` — C (not F). |
| `fixtures/rubric_d.rb` | `D` | `shape-and-value`, `reload-assertions`, `precise-matchers` — D via the 2-blockers arm; `have_key` co-fires `precise-matchers` per its independence clause. |
| `fixtures/rubric_f.rb` | `F` | `shape-and-value`, `reload-assertions`, `one-request`, `precise-matchers` — F via the blockers arm; `have_key` co-fires `precise-matchers` per its independence clause. |
| `fixtures/rubric_f_majors.rb` | `F` | `one-it`, `no-shared-setup`, `no-runtime-branching`, `literal-path`, `auth-matches-initiator` — F via the majors arm (not D or C). |

---

## 9. Boundaries

- [ ] No file edits occur during a grading invocation.
- [ ] No shell commands, Rails tasks, or specs are executed.
- [ ] Exactly one `it` is graded per invocation — never multiple `it`s, a whole file, or a directory in one call.
- [ ] No file- or suite-level recommendations appear in the report.
