# bug-to-scenarios — Test Cases

Behavioral contract for `/bug-to-scenarios`. Run these whenever the skill, gate definitions, or service profiles are modified. All cases verify end-to-end decision stability: given the same input tickets, the pipeline should produce the same gate pass/fail decisions across multiple runs.

## Fixture tickets

12 fixture files live in `references/fixtures/`, one per ticket. Each file simulates a JIRA ticket with structured fields (Key, Summary, Resolution, Components, Labels) and free-text sections (Description, Comments). The fixtures are version-controlled and never depend on JIRA access.

### Fixture files

| File | Tests | Expected decision |
|------|-------|-------------------|
| `bts-f01-pass-grade-passback.md` | Gate 2: Grade passback category | Tier 1, INCLUDE |
| `bts-f02-pass-passback-constraint.md` | Gate 2: Passback constraint category | Tier 1, INCLUDE |
| `bts-f03-pass-object-creation.md` | Gate 2: Object creation/recovery | Tier 1, INCLUDE |
| `bts-f04-discard-wont-do.md` | Resolution filter (Won't Do) | DISCARD |
| `bts-f05-fail-gate1.md` | Gate 1: not grading-related | Tier 1, EXCLUDE |
| `bts-f06-fail-gate2-apt.md` | Gate 2: APT fail (Canvas-internal) | Tier 1, EXCLUDE |
| `bts-f07-fail-gate2-faillist.md` | Gate 2: fail list match | Tier 1, EXCLUDE |
| `bts-f08-fail-gate3.md` | Gate 3: not API-expressible | Tier 1, EXCLUDE |
| `bts-f09-reframe-pass.md` | Framing Rule: reframe succeeds | Tier 1, INCLUDE |
| `bts-f10-tier2-boundary-signal.md` | Tier 2: boundary signal in description | Tier 2, * |
| `bts-f11-tier2-novel-phrasing.md` | Tier 2: novel phrasing (no jargon) | Tier 2, * |
| `bts-f12-tier2-skip-internal.md` | Tier 2: correctly skipped | neither, EXCLUDE |

`*` = gate decisions are informational; the key invariant is the tier classification.

### Design principles

- **Group A** (F1-F9): Name a profiled service in summary/components. Test gate logic.
- **Group B** (F10-F12): Deliberately omit service names from structured fields. Test Tier 2 identification.
- Fixtures are permanent. Do not modify content after the first baseline run.
- Each fixture is self-contained — read it to get all the information the skill would extract from a JIRA ticket.

## Fixture scenarios

12 existing scenarios live in `references/fixtures/scenarios/`, a frozen subset of `doc/integration-scenarios/`. The QA protocol reads these instead of the live docs so test results are stable as scenarios are added or modified over time.

### Files

| File | Scenarios | Highest ID | What it tests |
|------|-----------|-----------|---------------|
| `grading/new-quizzes.md` | NQ-1.1, 1.3, 1.4, 1.9, 1.10 | NQ-1.10 | Overlap detection (F1→NQ-1.1, F2→NQ-1.3), ID continuity (next = NQ-1.11) |
| `grading/rollcall.md` | RC-1.1, 1.2, 1.8, 1.11 | RC-1.11 | Overlap detection (F3→RC-1.8), ID continuity (next = RC-1.12) |
| `grading/mastery-connect-grade-passback.md` | MC-1.1 | MC-1.1 | Part C content, basic MC passback |
| `grading/mastery-connect-passback-constraints.md` | MC-3.1, 3.5 | MC-3.5 | ID continuity (next = MC-3.6), related data flow to F10 |

### Selection rationale

- **Overlap targets**: NQ-1.1, NQ-1.3, RC-1.8 are functionally similar to what BTS-F1, F2, F3 produce. The skill should detect these overlaps in Part D.
- **Highest IDs**: Establishes the starting point for new scenario numbering. The skill should assign NQ-1.11+, RC-1.12+, MC-3.6+.
- **GUIDs**: 12 existing GUIDs for the collision check. Proposed GUIDs must not match any of them.
- **Part C coverage**: Scenarios from all 3 service areas so Part C has content to list.
- **Different Gate 2 categories**: NQ-1.4 (passback constraint), NQ-1.9 (availability enforcement), RC-1.1 (object creation), MC-3.1 (availability enforcement) — provides variety for Part C ordering by data flow.

---

## Running the suite

Paste the prompt below into Claude Code (with this repo as the working directory) to execute the suite.

````
You are running QA on the bug-to-scenarios skill. Execute the test cases
in `.claude/skills/bug-to-scenarios/references/test-cases.md`.

## Fixture input

**Tickets:** Instead of calling JIRA, read the 12 ticket fixture files
from `.claude/skills/bug-to-scenarios/references/fixtures/bts-f*.md`.
Each file simulates a JIRA ticket with structured fields and free-text
content. Parse the structured fields at the top of each file (Key,
Summary, Resolution, Status, Components, Labels) as ticket metadata.
Parse the Description and Comments sections as the ticket body.

**Scenarios:** Instead of reading `doc/integration-scenarios/`, read the
fixture scenario files from
`.claude/skills/bug-to-scenarios/references/fixtures/scenarios/`. This
is a frozen subset of the real scenario docs — 12 scenarios across 4
files — so that test results are stable as the live docs evolve.

Apply the skill's full pipeline (Tier 1/2 identification, behavior
extraction, framing rule, gate triage) to each ticket fixture exactly
as you would to a real JIRA ticket.

## Protocol

### Run 1 — Baseline

1. Read the test-cases.md file, all ticket fixtures, and all scenario
   fixtures fully.
2. Read the skill file, gate definitions, and service profiles.
3. Execute the bug-to-scenarios Phase 1 pipeline against the fixtures:
   - Step 1 (fetch): read ticket fixture files instead of calling JIRA
   - Step 2 (read existing scenarios): read from `references/fixtures/scenarios/`
     instead of `doc/integration-scenarios/`
   - Steps 3-6: execute normally
4. Produce the full Phase 1 output (Parts A-D). Do NOT proceed to Phase 2.
5. Verify each fixture against its expected decision (section 1 below).
6. Verify all mechanical invariants (section 2 below).
7. Record results in the tables described in the Output section.

### Run 2 — Consistency check

1. Start a **new conversation** (fresh context, no memory of Run 1).
2. Repeat steps 1-7 from Run 1.
3. Compare Run 2's Part A triage table against Run 1's, column by column.
4. Record agreement/disagreement per fixture in the consistency table.

### Run 3 — Tiebreaker (only if needed)

If any fixture has a different gate decision between Run 1 and Run 2,
execute Run 3 to determine the outlier. The majority decision (2 of 3)
is treated as correct.

## Output

### Decision verification (per run)

| Fixture | Expected Match Tier | Actual Match Tier | Expected Decision | Actual Decision | Expected G2 Category | Actual G2 Category | Status | Notes |
|---------|--------------------|--------------------|-------------------|-----------------|--------------------|-------------------|--------|-------|

- **Status**: PASS if all "expected" columns match their "actual" counterparts.
  FAIL if any mismatch.
- For BTS-F4: verify it is absent from the triage table entirely.
- For BTS-F10 and BTS-F11: the key check is Match Tier = `Tier 2` (not `neither`).
  Gate decisions depend on content and are informational.
- For BTS-F12: the key check is Match Tier = `neither`.

### Consistency table (across runs)

| Fixture | Run 1 Match Tier | Run 2 Match Tier | Run 1 Decision | Run 2 Decision | Tier Stable? | Decision Stable? | Notes |
|---------|-----------------|-----------------|----------------|----------------|-------------|-----------------|-------|

### Summary

- `Gate decision accuracy: X/11` (BTS-F1–F3, F5–F12 decisions match expected)
- `Tier classification accuracy: X/12` (all fixtures match expected Match Tier)
- `Cross-run decision stability: X/11`
- `Cross-run tier stability: X/12`
- A final line: `Overall: PASS` or `Overall: FAIL`
  - PASS requires: gate decision accuracy >= 10/11 AND tier classification
    accuracy >= 11/12 AND cross-run decision stability >= 10/11 AND
    cross-run tier stability >= 11/12
- `## Failures` section if any, with analysis
````

---

## 1. Expected decisions

| Fixture | Match Tier | Gate 1 | Gate 2 | Gate 3 | Decision | Key invariant |
|---------|-----------|--------|--------|--------|----------|---------------|
| BTS-F1 | Tier 1 | ✓ | ✓ Grade passback | ✓ | INCLUDE | Scenario in Part B |
| BTS-F2 | Tier 1 | ✓ | ✓ Passback constraint | ✓ | INCLUDE | Scenario in Part B |
| BTS-F3 | Tier 1 | ✓ | ✓ Object creation/recovery | ✓ | INCLUDE | Scenario in Part B |
| BTS-F4 | — | — | — | — | DISCARD | Absent from Part A |
| BTS-F5 | Tier 1 | ✗ | — | — | EXCLUDE | No scenario |
| BTS-F6 | Tier 1 | ✓ | ✗ (APT fail) | — | EXCLUDE | No scenario |
| BTS-F7 | Tier 1 | ✓ | ✗ (fail list) | — | EXCLUDE | No scenario |
| BTS-F8 | Tier 1 | ✓ | ✓ | ✗ | EXCLUDE | No scenario |
| BTS-F9 | Tier 1 | ✓ | ✓ Identity/enrollment | ✓ | INCLUDE | Raw Symptom ≠ Reframed Behavior |
| BTS-F10 | Tier 2 | * | * | * | * | Tier 2 match (not `neither`) |
| BTS-F11 | Tier 2 | * | * | * | * | Tier 2 match — novel phrasing |
| BTS-F12 | neither | — | — | — | EXCLUDE | Correctly skipped by both tiers |

`*` = depends on specific ticket content; gate decisions are informational for Tier 2 fixtures. The invariant being tested is the tier classification, not the gate outcome.

---

## 2. Mechanical invariants

These must hold on every run, regardless of prose variation.

### 2a. Triage table completeness

- [ ] Every Done fixture (BTS-F1–F3, BTS-F5–F12) appears as a row in the Part A triage table.
- [ ] The non-Done fixture (BTS-F4) does NOT appear in the Part A table.
- [ ] All columns are present: Ticket, Summary, **Match Tier**, Service, Raw Symptom, Reframed Behavior, Gate 2 Category, Gates 1/2/3, Decision, Notes.

### 2b. Match Tier column

- [ ] Every row has a Match Tier value: `Tier 1`, `Tier 2`, or `neither`.
- [ ] Tier 1 fixtures (BTS-F1–F9) show Match Tier = `Tier 1`.
- [ ] BTS-F10 and BTS-F11 show Match Tier = `Tier 2`.
- [ ] BTS-F12 shows Match Tier = `neither`.
- [ ] Tickets with Match Tier = `neither` have Decision = EXCLUDE (they were not deep-read).

### 2c. Gate decision → scenario mapping

- [ ] Every ticket with Decision = INCLUDE has exactly one corresponding scenario in Part B.
- [ ] No ticket with Decision = EXCLUDE has a scenario in Part B.
- [ ] Part B scenarios are grouped by service and target file.

### 2d. Scenario structure

- [ ] Each proposed scenario has: ID (`{PREFIX}-{fileN}.{scenarioN}`), GUID (8-char lowercase hex), Reason (one sentence, no "Verifies that..." prefix), and Given/When/Then block.
- [ ] Each scenario has a `_Source: {TICKET-ID}` annotation.
- [ ] No scenario step references a specific API endpoint, HTTP method, or URL path.
- [ ] Every `Then` clause describes an outcome verifiable through the Canvas REST API.

### 2e. Gate 2 traceability

- [ ] Gate 2 Category is populated for every ticket that reached Gate 2 (passed Gate 1).
- [ ] Passing tickets name a specific category from the Gate 2 table.
- [ ] Failing tickets show "fail list: {pattern}" or "APT: fail".

### 2f. Framing rule evidence

- [ ] BTS-F9's Raw Symptom and Reframed Behavior columns contain different content.
- [ ] BTS-F9's Reframed Behavior describes an API-boundary behavior, not a UI symptom.

### 2g. Tier count reporting

- [ ] The skill reports tier counts: how many matched Tier 1, how many matched Tier 2, and how many matched neither.
- [ ] The sum of these three counts equals the total number of Done tickets in the result set.

### 2h. Part C and Part D

- [ ] Part C lists existing scenarios from the fixture scenario files (not the live docs), as a table with Scenario ID, Title, GUID, and File columns.
- [ ] Part D exists (even if empty).

### 2i. Scenario ID continuity

- [ ] New NQ scenarios start at NQ-1.11 (the fixture file's highest is NQ-1.10).
- [ ] New RC scenarios start at RC-1.12 (the fixture file's highest is RC-1.11).
- [ ] New MC passback-constraints scenarios start at MC-3.6 (the fixture file's highest is MC-3.5).
- [ ] No proposed scenario ID collides with an existing fixture scenario ID.

### 2j. GUID uniqueness

- [ ] No proposed GUID matches any of the 12 GUIDs in the fixture scenario files: `7e2b4f91`, `3d2f9e74`, `a0b5c81f`, `4d7e2b93`, `17a60e2d`, `9c4b3e17`, `e5a82d4f`, `7e4c1d90`, `8c6d4f15`, `3a7f1c4e`, `6e2b8d4f`, `ae824d1f`.

### 2k. Overlap detection

- [ ] Part D flags that BTS-F1's proposed scenario overlaps with NQ-1.1.
- [ ] Part D flags that BTS-F2's proposed scenario overlaps with NQ-1.3.
- [ ] Part D flags that BTS-F3's proposed scenario overlaps with RC-1.8.

---

## 3. Cross-run consistency expectations

### 3a. Must be identical across runs

- **Match Tier** — same tier for each fixture in every run.
- **Service identification** — same service for each ticket in every run.
- **Gate 1 verdict** — same ✓/✗ in every run.
- **Gate 3 verdict** — same ✓/✗ in every run.
- **Final decision** (INCLUDE/EXCLUDE) — same in every run.
- **Resolution filter** — same tickets discarded in every run.

### 3b. Should be identical (>=90%)

- **Gate 2 verdict** — may occasionally disagree on borderline cases.
- **Gate 2 category** — may vary if a ticket legitimately matches multiple categories.

### 3c. Expected to vary (not a failure)

- **Prose** — Raw Symptom wording, Reframed Behavior wording, scenario GWT phrasing.
- **Scenario titles and Reason sentences**.
- **Part C ordering**.
- **Notes column phrasing**.
