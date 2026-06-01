# request-test-grader — Test Cases

Behavioral contract for `/request-test-grader`. Run these whenever the skill or its grader agent is modified. All cases are framed as skill invocations and their observable outputs.

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

   Use the lowest `it` per fixture.

2. Spawn all 5 `request-test-grader` agents in **one message**
   (multiple Agent tool calls in a single turn). Prompt for each:
   `<fixture-path>:<line>`

3. Verify each returned report against:

   - §8.2 — `result=` and `failures=` match the expected row.
   - §4 — `<report>` framing and machine-readable trailer shape & consistency.
   - §5 — per-rule slug set in `failures=` and `na=` together (plus the silent `pass` rules) equals the slug set declared in `references/request-test-rules.md` (grep `^### ` for the list).
   - §6 — Failures rows sorted by **source line**, not rules-file order.

4. For §1.1, §1.2, §1.3, §1.4, §1.5, §2.1–§2.4, §3.1, §3.2, and §9.\*,
   verify each case is encoded in SKILL.md or agent.md and cite the
   encoding line in the Note column. §1.4 and §3.2 are *also*
   exercised by step 2's fixture runs — note both. Do not skip this
   step; do not mark these UNTESTED. Do NOT execute §1.1 or §1.2
   manually (no skill invocation with no-args or ambiguous descriptions);
   verify them by encoding citation only.

Output:

- A `Case | Status | Note` table, one row per case. Notes MUST cite the encoding line (e.g., `SKILL.md L51`, `agent.md L24`).
- `## Failures` — case ID, expected vs. observed, `<fixture>:<line>`
  citation pointing at the graded `it`.
- `## Drift observed` (optional, advisory) — drifts no case catches;
  does not affect the verdict.
- A final line: `Overall: PASS` or `Overall: FAIL`.

After the verdict, append a `## Manual follow-up` section reminding
the user that §1.1 and §1.2 require interactive verification and
providing the exact copy-paste prompts below:

  **§1.1 — No argument → interactive collection**

      /request-test-grader

  Expected: the skill prompts you for a target instead of emitting a
  report.

  **§1.2 — Description matches multiple `it` blocks → user picks**

      /request-test-grader spec/apis/v1/courses_api_spec.rb "updates settings"

  Expected: the skill lists candidate `it` blocks disambiguated by
  their `describe`/`context` chain and waits for your selection
  before emitting exactly one report. (`"updates settings"` matches
  lines 5357 and 6223 — one under a course-settings context, one
  under `/quizzes` > `as teacher`.)

Read-only on the codebase. Do not invoke the grader skill to exercise
§1.1 (no-args interactive collection) or §1.2 (ambiguous-description
disambiguation) — verify those by encoding citation only and surface
them in `## Manual follow-up`.
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
No `<report>` block. No machine-readable trailer.

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
Then the skill spawns the agent and produces a report — even if the path doesn't resolve to a Canvas route, and even if the `it` body issues no HTTP call. The skill does not second-guess the file's contents beyond the gate above.

---

## 4. Report framing & machine-readable trailer

The `<report>...</report>` framing and the machine-readable trailer together form the parser contract — these invariants are non-negotiable.

**Framing.**

- [ ] The report opens with a literal `<report>` on its own line and closes with a literal `</report>` on its own line. Both tags appear exactly once per emitted report.
- [ ] The machine-readable trailer appears as the last block inside `<report>`, immediately before the closing `</report>` tag and after `## Rules N/A`.

**Trailer fields.**

- [ ] All three fields present and in order: `result`, `failures`, `na`.
- [ ] Each field appears exactly once.
- [ ] `result` is `pass` or `fail` (lowercase) and matches the bold `**PASS**` / `**FAIL**` in the `## Result` heading.
- [ ] `failures` set equals the set of `fail`-verdict rules; `na` set equals the set of `na`-verdict rules; no slug appears in both.
- [ ] Empty list fields render as `failures=` / `na=` — never `none` or `[]`.
- [ ] When `result=pass`, `failures=` is empty; when `failures=` is empty, `result=pass`.

---

## 5. Per-rule coverage

- [ ] The union of `failures=`, `na=`, and the silent `pass` rules (computed by subtracting the first two from the full rule set in `references/request-test-rules.md`) equals the full rule set. No invented slugs; no omissions.
- [ ] `na` is explicit, listed in the `## Rules N/A` section with a brief reason per rule. Silence never implies `pass` for an `na` rule.

---

## 6. Failures

### 6.1 Zero `fail` verdicts → "No failures."

Given a graded `it` with no `fail` verdicts
Then the `## Failures` body is exactly `No failures.` — no table, no row markers.

### 6.2 Any `fail` verdicts → Failures table

Given a graded `it` with at least one `fail`-verdict rule
Then the `## Failures` section is a single table with columns `# | Location | Rule | Excerpt | Fix`, one row per `fail`-verdict rule. There are no severity sub-sections — every failure is equally a failure.

### 6.3 One row per `fail`-verdict rule

Given a rule violated at multiple locations within one `it`
Then the rule contributes a single row whose Location cites the lowest violating line; the Fix may mention secondary locations inline.

### 6.4 Source-line order

Given a report with multiple `fail`-verdict rules
Then rows appear in source line order (ascending). Row numbers are assigned continuously *after* sorting.

### 6.5 Locations use the caller's path form

Given the skill was invoked with a relative `path:line`
Then every Location in the report is relative — never rewritten to an absolute filesystem path.

---

## 7. (reserved)

The previous RITE Evaluation section has been removed along with the rest of the rubric.
This section number is reserved so existing references to §8 keep their meaning.

---

## 8. Pass/fail verdict

### 8.1 Verdict derives mechanically from counts

Given the per-rule verdict
Then `result=pass` iff zero rules are marked `fail`; otherwise `result=fail`. There is no gradient, no severity, no curve.

### 8.2 Spot-check fixtures

Hand-crafted `it` blocks under `fixtures/` produce a specific per-rule signature when graded. They are not real tests — they live outside `spec/` so Canvas's suite never picks them up. Each fixture declares `type: :request` (so the skill's request-test guard accepts it) and uses an intentionally unresolvable path (`/api/v1/grader_fixture/...`) so controller-context rules deterministically grade `na — controller not resolved`, keeping the verdict independent of Canvas's routing table.

To verify: invoke the grader agent on each fixture (target the first `it` line) and confirm the returned trailer matches the table below.

| Fixture | Expected `result=` | Expected `failures=` (slug set) | Notes |
|---------|---------|-----------|----------|
| `fixtures/clean_pass.rb` | `pass` | (empty) | Pass-floor: every applicable rule `pass` or `na`. |
| `fixtures/one_failure.rb` | `fail` | `reload-assertions` | Single `fail`. Verifies the pass→fail transition at one failure. |
| `fixtures/multi_failures.rb` | `fail` | `no-before-once,shape-and-value,reload-assertions,precise-matchers` | Multi-`fail`. `precise-matchers` co-fires with `shape-and-value` per its independence clause. |
| `fixtures/auth_mismatch.rb` | `fail` | `auth-matches-initiator` | Single `fail`. Description names an external-API-client-bearer initiator but setup uses `user_session`. |
| `fixtures/magic_values.rb` | `fail` | `no-magic-values` | Single `fail`. Assertion checks `"Unnamed Course"`, which is never set explicitly in setup. |

The `failures=` and `na=` trailer fields are **unordered sets**. Any permutation of the expected slugs is correct — do not compare the comma lists as strings.

---

## 9. Boundaries

- [ ] No file edits occur during a grading invocation.
- [ ] No shell commands, Rails tasks, or specs are executed.
- [ ] Exactly one `it` is graded per invocation — never multiple `it`s, a whole file, or a directory in one call.
- [ ] No file- or suite-level recommendations appear in the report.
