# Integration Scenario Gates

Three gates filter candidate behaviors to those suitable for integration scenarios. A behavior must pass all three gates to become a scenario.

## Gate 1 — Grading-related

The behavior must involve grading, scoring, grade passback, rubric evaluation, attendance marking that flows to grades, or gradebook interaction.

Examples of grading-related behaviors:
- Submitting a quiz and receiving a grade
- Marking attendance that flows to the gradebook
- Viewing or exporting grades originating from quizzes or attendance
- Applying rubrics to graded assignments backed by an external service
- Grade posting and muting for assignments backed by an external service

**Lean toward inclusion** — a borderline grading-related behavior costs little to include.

## Gate 2 — Active boundary crossing

The external service must be **actively participating** in the action (`When`) or outcome (`Then`) — not merely providing a precondition (`Given`).

**When applied to bug-derived behaviors:** Gate 2 must operate on the **reframed** behavior (after the Framing Rule), not the raw bug description. If the calling skill includes a Framing Rule step, complete it before entering this gate.

Apply the following steps **in order**. Stop as soon as a step produces a definitive answer.

### Step 1 — Category match (sufficient to pass)

Check the behavior against each row in the category table below. If the behavior clearly matches **any** row, it **passes Gate 2**. Record which category matched. **Stop — do not proceed to Step 2 or Step 3.**

| Category | What it looks like |
|----------|---|
| **Grade passback** | External service sends a score to Canvas (auto-graded, manually graded, fudge points, re-attempt, bulk regrade) |
| **Object creation / recovery** | External service creates or recreates a Canvas assignment |
| **Settings propagation** | A setting change in one system flows to the other (e.g., anonymous flag removed on grade post, exclude-from-grade flag set by the external service) |
| **Availability enforcement** | Canvas constraints (due dates, availability windows) are honored by the external service (e.g., auto-submit on Until date expiry) |
| **Passback constraint** | Canvas state prevents or modifies what the passback does (manual posting policy blocks auto-post; excused status, manual grade, or concluded enrollment rejects passback) |
| **Outcome / mastery result passback** | External service sends learning outcome results to Canvas |
| **Identity / enrollment validation** | LTI launch or passback is affected by Canvas's anonymous grading or enrollment state |

Use the service profile's **Boundary categories** field to confirm which categories are applicable to the service under analysis. All categories listed in the profile are valid matches; a match against an unlisted category is suspect and should be flagged as borderline.

**Near-miss example:** "Gradebook sort order is wrong for NQ assignments" — this involves an NQ assignment but the sort behavior is Canvas-internal. No category matches because no cross-boundary data flow is in the When/Then.

### Step 2 — Fail-list check (sufficient to fail)

If **no** category matched in Step 1, check whether the behavior matches any of these patterns. If it does, it **fails Gate 2**. **Stop.**

- Canvas gradebook operations (post, hide, default grade, export, status change) applied to an assignment backed by any in-scope service
- Canvas grade calculations (weighted groups, final grade override) that apply regardless of assignment type
- Canvas submission status changes (excused, late, missing) where Canvas acts unilaterally with no passback involved
- Workflows involving an exclusion sibling of an in-scope service — unless the workflow also involves grade passback from the in-scope service itself

### Step 3 — Active Participation Test (tiebreaker)

Only if Steps 1 and 2 were both inconclusive, apply this test:

If you replaced the external-service assignment with an ordinary Canvas assignment and seeded the same precondition data via Canvas API, would the `When` fail or the `Then` be different? If the scenario would play out identically, the external service is only a precondition — it **fails Gate 2**.

If the APT result is ambiguous, **lean toward exclusion** — a Canvas-only scenario disguised as an integration test gives false coverage confidence.

### Borderline analysis requirement

When a Gate 2 judgment is not immediately clear — the behavior partially matches a category, or the APT result is ambiguous — produce a brief argument **for inclusion** and a brief argument **for exclusion** before deciding. Record both arguments in the triage table's Notes column. This prevents anchoring on whichever heuristic was applied first.

### Anti-patterns

Do not use these reasoning shortcuts — they produce incorrect Gate 2 judgments:

- **Fix location as proxy:** A bug fixed in Canvas code can still represent an integration boundary behavior. Gate 2 asks whether the external service is active in the *scenario's When/Then*, not whether the fix was in the external service's codebase. Example: "Canvas rejects passback for concluded enrollment" is fixed in Canvas, but NQ is active in the When (sending the passback). All "Passback constraint" scenarios are fixed in Canvas by definition.
- **APT before categories:** Applying the Active Participation Test before checking the category table violates the step order and leads to incorrect rejections. The categories are sufficient conditions — they override the APT, not the other way around.
- **Symptom-level framing:** Evaluating Gate 2 against the raw UI symptom ("student names visible in SpeedGrader") instead of the reframed API-boundary behavior ("passback exposes identifying data through the submissions API") will cause valid integration scenarios to be rejected as Canvas-internal rendering bugs.

## Gate 3 — API-expressible

The entire workflow — preconditions, action, and verification — must be achievable through Canvas REST API calls without requiring browser interaction.

- **Preconditions** can be set up via API (create course, enroll users, create assignment, create quiz, configure attendance tool, etc.)
- **Action** can be performed via API (submit quiz, mark attendance, post grades, etc.)
- **Outcome** can be verified via API (read grade from gradebook endpoint, check submission state, read enrollment scores, etc.)

If any step *requires* clicking through a UI with no API equivalent (e.g., a drag-and-drop quiz builder interaction that has no API counterpart), the scenario is **out of scope**.

**Lean toward inclusion** — a borderline API-expressible scenario costs little to include.
