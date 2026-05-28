---
name: bug-to-scenarios
description: Fetch resolved JIRA bug tickets via JQL, extract cross-boundary integration behaviors, propose new Given-When-Then scenarios, and produce a prioritized list of scenarios for test-writing. Use when the user provides a JQL query for resolved bugs and wants to identify the highest-priority integration scenarios to test.
argument-hint: "<jql>"
disable-model-invocation: true
allowed-tools:
  - AskUserQuestion
  - Read
---

Fetch resolved JIRA bug tickets using the JQL query in `$0`, extract integration-specific behaviors from each ticket, filter them through the shared integration scenario gates, write new Given-When-Then scenarios to `doc/integration-scenarios/`, and present a prioritized list of scenarios for test-writing.

### Argument parsing

- `$0` — **required**: a JQL query string (e.g., `project = CNVS AND issuetype = Bug AND resolution = Fixed AND sprint = 123`)

**Complete Phase 1 fully before starting Phase 2. Do not write scenario files or present priorities until the user approves the proposal.**

---

## Service Profiles

Service profiles provide the context needed to apply Gate 2 correctly — specifically, which cross-boundary behaviors are possible for each integration service, what constitutes "active participation" vs. a passive precondition, and which Gate 2 categories apply.

Built-in profiles are stored in `.claude/skills/shared/integration-scenarios/service-profiles/`. For each service identified in Phase 1, read the corresponding profile file (`new-quizzes.md`, `rollcall.md`, `mastery-connect.md`).

If a ticket involves a service not covered by any built-in profile, state your assumptions about that service's integration type, grading interaction, boundary categories, and ID prefix in the Phase 1 proposal and ask the user to confirm before proceeding.

---

## Phase 1 — Research and propose

### 1. Fetch tickets

Use `mcp__atlassian__searchJiraIssuesUsingJql` with:
- **jql**: the value of `$0`
- **fields**: `summary`, `description`, `resolution`, `components`, `labels`, `comment`, `status`

Fetch all pages if the result set is paginated.

**Discard tickets whose resolution is not "Done".** Only "Done" reliably indicates the behavior was corrected — other resolutions (Won't Do, Cannot Reproduce, Duplicate, etc.) mean the bug was not fixed and the current behavior is intentional or unconfirmed.

For each remaining ticket, collect:
- **Ticket ID** (e.g., `CNVS-12345`)
- **Summary** — the one-line bug title
- **Description** — full bug report including steps to reproduce
- **Resolution description** — what was fixed and how
- **Components and labels** — used to identify the external service involved
- **Comments** — resolution context and root-cause notes. **Fix-description comments (Gerrit merge messages, PR titles/links) are the highest-value signal** — they reveal what data or contract was actually broken, which drives the Framing Rule in Step 4b. Read the most recent 3–5 comments for every candidate ticket; do not treat comments as optional.

If `mcp__atlassian__searchJiraIssuesUsingJql` is unavailable or returns an auth error, stop and ask the user to verify their Atlassian MCP connection.

### 2. Read existing scenario files

Before extracting behaviors, read the following to establish context:

1. `doc/integration-scenarios/README.md` — schema reference (field rules, GUID format, Reason rules)
2. All `.md` files under `doc/integration-scenarios/` — collect:
   - All existing GUIDs (for uniqueness enforcement in Phase 2)
   - The highest scenario number per file per service prefix (for ID continuity in Phase 2)
   - All existing scenario IDs, titles, and GUIDs (for the Output 2 prioritization list)

### 3. Identify candidate tickets

Use a **two-tier strategy** to find integration-relevant tickets.

#### Tier 1 — Service identification (applied to summaries, components, labels)

Build the keyword list from service profiles — do not use ad-hoc keyword lists:
- Use the **Service name** and all **Also known as** aliases from each profile
- Include component names that correspond to each service (e.g., "Roll Call" component → Rollcall service)
- **Do NOT include** generic terms like "LTI", "external tool", "quiz", or "assignment" — these produce false positives without identifying a specific service

#### Tier 2 — Boundary-relevance skim (applied to remaining Done tickets)

Tier 2 catches tickets that describe a cross-boundary behavior without naming a specific service. It always runs, regardless of result set size.

For each remaining ticket (not matched by Tier 1), read its **summary and first paragraph** of the description. Flag it as a Tier 2 candidate if either:
- It describes data flowing between Canvas and an external system (scores, grades, assignments, settings, outcomes, enrollment state)
- It describes a constraint or condition that affects cross-system behavior (due dates, posting policies, enrollment status, anonymity)

Use the Gate 2 category table in `gates.md` as your reference for what constitutes boundary-relevant behavior. Do not use a fixed keyword list.

Tickets flagged by Tier 2 still need service identification during the deep-read step (Step 4a) — the signal only flags them as candidates worth reading in full.

**Reporting:** For every run, report the counts: how many matched Tier 1, how many matched Tier 2, and how many matched neither. This is for auditing and debugging purposes.

### 4a. Extract integration-specific behaviors

**Candidate tickets** are those matched by Tier 1 or Tier 2. Tickets matching neither tier are excluded from deep-read and appear in the Part A triage table with Match Tier = `neither` and Decision = EXCLUDE.

For each candidate ticket, read the full description and recent comments, then identify the **integration-specific behavior** that failed:
- **What cross-boundary trigger or guard was broken?** (from description / steps to reproduce)
- **What is the correct behavior?** (from resolution description and comments)
- **Which system initiated the failing action?** (external service → Canvas, or Canvas → external service)
- **What does the fix commit/PR title tell you about the root cause?** (from Gerrit merge messages or PR links in comments)

The most valuable signals are:
- Sentences describing an automatic cross-boundary action that did not occur ("grade was not sent", "assignment was not created")
- Constraints that were bypassed or not enforced ("passback occurred even though…", "grade posted despite…")
- Recovery or error behaviors that are now correctly handled ("when the assignment is deleted, MC now…")
- Identity or enrollment conditions that blocked or corrupted a passback

Produce a concise **behavior summary** for each ticket (1–3 sentences). This is the raw extraction — the Framing Rule in the next step may revise it.

### 4b. Apply the Framing Rule

This step is **mandatory** for every candidate ticket. It must be completed before entering gate triage (Step 5).

When a bug manifests in the external service's UI or internal logic, determine whether the same failure also violates a contract at the Canvas API boundary. Apply this procedure:

1. **Identify the UI symptom** — what the bug report describes (e.g., "student names visible in SpeedGrader for anonymous NQ survey")
2. **Identify the root cause** — what the fix actually changed (e.g., "NQ passback included participant ordering data that allowed de-anonymization"). Fix-description comments are the primary signal here.
3. **Check API observability** — would the root cause produce an incorrect, missing, or leaked result observable through the Canvas REST API? (e.g., "yes — the submissions API exposes user IDs for an anonymous assignment")
4. **Reframe or declare internal**:
   - If yes → rewrite the behavior summary at the API-boundary level
   - If no → record "No API-boundary reframing — genuinely service-internal" with a brief reason

**Positive examples** (reframe succeeds):
- "Student identity visible in NQ grading UI" → "NQ passback exposes identifying data through the Canvas submissions API"
- "NQ migration produces wrong point value" → "NQ sends incorrect score to Canvas via grade passback"

**Negative examples** (no reframing possible):
- "NQ print preview button doesn't work in SpeedGrader" → no grade or identity data is affected; the print action has no API-boundary equivalent. **Genuinely service-internal.**
- "Rollcall slider has insufficient color contrast" → the slider's visual rendering doesn't affect any data flowing through the Canvas API. **Genuinely service-internal.**

For each ticket, record both:
- **Raw symptom**: the original bug description framing
- **Reframed behavior**: the API-boundary version (or "no reframing")

The **reframed behavior** (not the raw symptom) is what enters gate triage.

### 5. Triage: apply the three gates

For each ticket's **reframed behavior** (from Step 4b), decide whether it passes all three gates.

Read and apply the gate definitions from `.claude/skills/shared/integration-scenarios/gates.md`.

**Critical: follow the Gate 2 step order.** Check the category table first. Only apply the Active Participation Test if no category matched and the fail list was inconclusive. See the anti-patterns section in gates.md for common errors.

### 6. Present the proposal and wait for approval

Present the following and **stop**. Do not write any files.

#### Part A — Ticket inventory and triage

A table with columns:

| Ticket | Summary | Match Tier | Service | Raw Symptom | Reframed Behavior | Gate 2 Category | Gates 1/2/3 | Decision | Notes |

- **Match Tier**: how the ticket was identified — `Tier 1` (service name match), `Tier 2` (boundary-relevance skim), or `neither` (not matched by either tier — excluded from deep-read)
- **Raw Symptom**: 1-line description of the bug as reported
- **Reframed Behavior**: the API-boundary version from Step 4b, or "no reframing"
- **Gate 2 Category**: which category matched (if any), or "APT: pass/fail", or "fail list: {pattern}"
- **Notes**: for borderline Gate 2 calls, include both the inclusion argument and the exclusion argument

Mark borderline decisions explicitly.

#### Part B — Proposed new scenarios

For each ticket that passed all three gates, show a fully-drafted scenario block using the schema below. Use tentative IDs and GUIDs at this stage (finalized in Phase 2).

```markdown
**Scenario {PREFIX}-{fileN}.{scenarioN} — {Title}**
- **GUID:** `{8-char lowercase hex}`
- **Reason:** {One sentence — the impact if this fails.}
\```
Given {precondition(s)}
When {action(s) under test}
Then {observable outcome(s)}
\```
```

Group proposed scenarios by service and target file.

For each proposed scenario, include a one-line annotation beneath it:
> _Source: {TICKET-ID} — {what this scenario captures from the bug}_

#### Part C — Existing scenarios to prioritize for test-writing

List all existing scenarios from the same service area(s) as the triaged tickets. These are candidates for test-writing focus because they share the integration boundary where bugs were found.

Format as a table:

| Scenario ID | Title | GUID | File |
|-------------|-------|------|------|

Order: same service first, then scenarios sharing the same data flow (grade passback, assignment lifecycle, constraints, etc.) as the proposed new scenarios.

#### Part D — Questions and ambiguities

- Any tickets where the service could not be identified
- Any Gate 2 calls that were borderline (with both arguments shown)
- Any unknown services requiring profile confirmation
- Any steps that might not be achievable through the Canvas REST API

Then ask the user to confirm, correct, or redirect before proceeding.

**After the user confirms an unknown service:** proceed using the confirmed assumptions as an ad-hoc profile for this run. Do not create a new profile file in `.claude/skills/shared/integration-scenarios/service-profiles/` unless the user explicitly requests it. Record the confirmed service name, integration type, grading interaction, and ID prefix in the Phase 2 file header's `**Integration:**` line for traceability.

---

## Phase 2 — Write scenarios and present priorities (only after proposal is approved)

### 7. Finalize IDs and GUIDs

For each approved scenario:
1. **Scenario ID** — two components to determine:
   - **File number** (the middle number in `{PREFIX}-{fileN}.{scenarioN}`):
     - For an **existing** target file: use that file's existing file number.
     - For a **new** file: find the highest file number already used by that service prefix across all existing files and increment by 1. Example: if Mastery Connect already has `MC-1.x`, `MC-2.x`, and `MC-3.x`, the new file gets file number `4`.
   - **Scenario number** (the last number): find the highest scenario number already in the target file and increment by 1. For a brand-new file, start at `1`.
   - Full example: first scenario in a new fourth Mastery Connect file → `MC-4.1`.
2. **GUID:** generate a random 8-character lowercase hex string. Verify it does not appear in any of the existing GUIDs collected in step 2. Regenerate if there is a collision.

### 8. Append to scenario files

All scenario files live under `doc/integration-scenarios/grading/`. This is the target directory for both existing files and any new files created in this phase.

For each target file:
- If the file already exists: append the new scenario blocks after the last existing scenario in the file
- If no file exists for the service yet: create a new file at `doc/integration-scenarios/grading/{domain}.md` using this header format:

  ```markdown
  # Scenarios: {Domain Name}

  **Source tickets:**
  - {TICKET-ID} — {Summary}

  **Integration:** Canvas LMS ↔ {service name}

  ---
  ```

  If the new scenarios span a genuinely different grading subdomain that warrants a new directory (not just a new file under `grading/`), ask the user before creating it.

Do not modify any existing scenario. Only append.

### 9. Present the test-writing priority list

**Do not write this to a file.** Present the prioritized list directly to the user.

Assign each approved scenario (new from Part B) and each existing scenario (from Part C) to a tier:

1. **Bug-backed** — scenarios derived from actual production bugs with customer cases; proven fragile. These are the new scenarios written in Step 8, plus any existing scenarios that overlap with a bug (identified in Part D).
2. **Same-data-flow** — existing scenarios that share a boundary interaction (e.g., passback constraints, identity validation) with a bug-backed scenario; adjacent fragility.
3. **Core happy-path** — existing fundamental behaviors (basic grade passback, assignment creation) that other scenarios depend on.
4. **Remaining** — existing edge cases and less critical behaviors.

Present the ranked list grouped by tier. Within each tier, order by number of bug citations (more = higher), then by data-flow criticality.

```markdown
## Bug-backed — proven fragile

- **{ID}** — {Short title} · `{TICKET-ID}`

## Same data flow — adjacent to a bug

- **{ID}** — {Short title} · related to `{TICKET-ID}`

## Core — happy-path behaviors

- **{ID}** — {Short title}

## Remaining

- **{ID}** — {Short title}
```

For bug-backed scenarios that overlap with an existing scenario (identified in Part D), list the existing scenario in the bug-backed tier with the source ticket citation rather than proposing a duplicate.

### 10. Quality checks before finishing

- Every proposed scenario has a unique GUID not present in any existing scenario file
- Every `Reason` is a direct statement of business impact (no "Verifies that..." prefix)
- Every `Then` clause describes an outcome verifiable through the Canvas REST API
- No scenario step references a specific API endpoint, HTTP method, or URL path
- Every approved ticket's behavior summary has a corresponding scenario — nothing silently dropped
- Scenario IDs continue correctly from the existing highest number per file per service prefix
