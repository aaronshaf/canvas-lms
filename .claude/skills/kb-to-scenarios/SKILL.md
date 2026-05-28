---
name: kb-to-scenarios
description: Browse a Canvas Instructure Community KB (Knowledge Base) index, identify grading workflows that span Canvas and one or more caller-specified external services and are expressible through Canvas REST API calls, and produce Given-When-Then scenario files with a README. Use when the user asks to create an API-expressible grading scenario inventory from a Canvas KB feature area.
argument-hint: "<services-or-profile-file> <output-dir> [kb-index-url]"
disable-model-invocation: true
---

Browse the Canvas Instructure Community KB, identify grading workflows that involve Canvas and the external services specified by `$0`, filter to those expressible through Canvas REST API calls, and produce a directory of Given-When-Then scenario files at `$1/`.

### Argument parsing

- `$0` — **required**: either a comma-separated service list (e.g., `"New Quizzes, Rollcall"`) or a file path to a service profile file
- `$1` — **required**: output directory
- `$2` — optional fallback KB index URL, used for services whose profiles don't specify their own KB URLs (default: `https://community.instructure.com/en/kb/canvas-lms-instructor-guide`)

If `$0` looks like a file path (contains `/` or `.yaml` / `.yml` / `.md`), read it as a service profile file. Otherwise, split on commas and trim whitespace to get the service list.

Bind the resolved list of service names to **`$services`** for use throughout this skill.

**Complete Phase 1 fully before starting Phase 2. Do not write any files until the user approves the plan.**

---

## Service Profiles

Each service in `$services` needs the following context for the agent to apply Gate 2 correctly:

- **Service name** — canonical name (e.g., "New Quizzes")
- **Also known as** — aliases and KB category names (e.g., "Quizzes 2", "Quizzes.Next", KB category: "New Quizzes")
- **Integration type** — how it connects to Canvas (LTI 1.1, LTI 1.3, SIS import, native plugin, etc.)
- **Grading interaction** — how it affects Canvas grades (grade passback, creates assignments, modifies submission state, etc.)
- **Feature flag** — if any (e.g., `quizzes_next`)
- **Exclusion siblings** — related services that should be excluded unless they cross back into this service's scope (e.g., Classic Quizzes for New Quizzes)
- **KB index URLs** — optional; one or more KB category URLs to search for this service's articles. If absent, the agent searches the fallback KB URL (`$2` or default) for categories matching the service's aliases

### Built-in profiles

Built-in profiles are stored as individual files in `.claude/skills/shared/integration-scenarios/service-profiles/`, named `{kebab-case-service-name}.md`.

For each service in `$services`:
1. Normalize the name to kebab-case (e.g., "New Quizzes" → `new-quizzes`, "Rollcall (Attendance)" → `rollcall`)
2. Read `service-profiles/{name}.md` if it exists
3. If no profile file exists, treat the service as unknown — the agent must state its assumptions about the service profile in Phase 1 step 4 and ask the user to confirm before proceeding

Available built-in profiles: New Quizzes, Rollcall (Attendance), Mastery Connect.

---

## Phase 1 — Research and plan

### 1. Discover articles

The Instructure Community site embeds page content as JSON in the raw HTML response (inside `window['vanillaInitialLayout']`). No browser rendering is needed. Use curl for all page fetches:

```
curl -s -L {url} -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
```

- **KB index page:** For each service in `$services`: if the profile specifies **KB index URLs**, use those as starting points for article discovery. Otherwise, search `$2` (or default) for KB categories matching the service's canonical name and "Also known as" aliases. Collect every article title and URL from the matching categories.
- **Individual articles:** Extract the article body from the `"body"` field in the `vanillaInitialLayout` JSON object.

### 1b. Read each candidate article for integration-specific content

For every article that could pass Gate 2 based on its title, navigate to the full article and read its body. The most valuable integration behaviors are not in the procedural step headlines — look in:

- **Notes blocks and warnings** — often document behaviors that differ between the in-scope services and regular assignments (e.g., "grades for concluded enrollments are not sent")
- **Video transcript text** — contains the same content as the steps in narrative form; may include constraints not repeated in the step list
- **Sentences containing "automatically", "will not", "must", "before you can"** — these describe automatic cross-boundary triggers, guards, and preconditions
- **Recovery / error behaviors** — what the system does when something is missing, deleted, or in an unexpected state (e.g., auto-recreation of a deleted assignment)
- **Known limitations** — documented workarounds often reveal the cross-boundary failure mode they are compensating for

For each article, produce a list of **integration-specific behaviors**: individual sentences or phrases that describe something one system does as a consequence of the other. This list drives scenario writing in Phase 2 and the gap analysis in the quality check.

### 2. Triage for grading + integration + API scope

For each article, decide: **does this workflow pass all three gates?**

Read and apply the gate definitions from `.claude/skills/shared/integration-scenarios/gates.md`.

Not all Gate 2 categories apply to all services — use the service profile's **Boundary categories** field to determine which categories are relevant. Only categories listed in the profile are valid matches for that service; a match against an unlisted category is suspect and should be flagged as borderline.

### 3. Plan file organization

- One markdown file per workflow domain (not per article — related articles may share a file)
- Flat directory layout: no subdirectories within the output directory
- File names: `<workflow-domain>.md` in kebab-case
- Plus a `README.md` as an index

### 4. Present the plan and wait for approval

Present the following to the user and **stop**:

1. **Article inventory** — every article found, with title and URL
2. **Triage decisions** — a table with columns: Article, In/Out of Scope, Grading-Related?, Integration ({list `$services` names}/Neither), Active in When/Then? (Yes / No / ?), API-Expressible?, Reasoning. Mark anything borderline explicitly.
3. **Proposed file layout** — the list of `.md` files to be created, each with: filename, domain name, which KB articles it covers, which integration is involved, and an estimated scenario count
4. **Questions or ambiguities** — anything you're uncertain about (scope calls, domain groupings, API-expressibility you couldn't determine from the article alone). For any service without a built-in profile, include the assumed service profile and ask the user to confirm or correct it.
5. **Integration-specific behaviors per article** — for each in-scope article, the specific sentences or behaviors identified in step 1b. This exposes what Phase 2 must cover and lets the user verify nothing was missed before writing begins.

Ask the user to confirm, correct, or redirect before proceeding. Do not begin writing files.

---

## Phase 2 — Write files (only after plan is approved)

### 5. Write scenario files

Each file begins with a header:

```markdown
# Scenarios: {Domain Name}

**Source KB articles:**
- [{id} — {title}]({url})

**Integration:** Canvas LMS ↔ {service name(s) relevant to this file}

---
```

Then write scenarios using this schema:

```markdown
**Scenario {SERVICE-PREFIX}-{file#}.{scenario#} — {Title}**
- **GUID:** `{8-char lowercase hex}`
- **Reason:** {One sentence — the impact if this fails.}
```
Given {stable precondition(s)}
When {action(s) under test}
Then {observable outcome(s)}
```
```

The `SERVICE-PREFIX` is a short uppercase abbreviation for the service (e.g., `NQ` for New Quizzes, `RC` for Rollcall, `MC` for Mastery Connect). Each service's files number independently starting from 1, so `MC-1.x` and `NQ-1.x` can coexist without collision. Add the prefix for any new service to the service's profile file.

Scenarios must be written in plain language describing user actions. Do not reference specific API endpoints, HTTP methods, or URL paths in any scenario step.

Even though scenarios use plain language, every step must correspond to an action achievable through the Canvas REST API. If you cannot identify which API call would accomplish a step, the scenario likely fails Gate 3 and should be excluded.

**GUID rules:**
- 8 lowercase hex characters (e.g., `4e7a2d1f`)
- Generate randomly — do not derive from content or use sequential numbers
- Never reuse a GUID within the output

**Reason rules:**
- One sentence. Direct statement of the observable outcome, not a process description.
- Do not start with "Verifies that..." — state the outcome as fact
- Focus on impact: what breaks for the user if this scenario fails?

**GWT rules:**
- `Given` = stable preconditions (what must be true before the action)
- `When` = the action under test (what the user does)
- `Then` = observable outcomes (what the system does in response)
- Use `And` for additional lines within any clause
- Each `Then` outcome on its own `And` line if multiple

### 6. Write the README

The README must include:

1. **Opening paragraph** (no heading) — explain that these scenarios cover grading workflows at the integration boundary between Canvas LMS and the services in `$services`, and that all scenarios are expressible through the Canvas REST API
2. **Scenario Files table** — columns: File, Domain, Source KB Articles, Integration (no scenario count)
3. **Scenario Schema** — copy the following section verbatim, including the Example block
4. **Notes** — for each service in `$services`, include any caveats from the service profile (feature flags, exclusion siblings, integration type notes). For built-in profiles, use these notes where the relevant service is in scope:
   - **New Quizzes:** New Quizzes requires the `quizzes_next` feature flag to be enabled
   - **New Quizzes:** Classic Quizzes (quiz engine v1) is out of scope unless the workflow also involves New Quizzes grade passback
   - **Rollcall:** Rollcall is an LTI tool; attendance marks become grade values on a Canvas assignment

**Schema section to include in the README (copy verbatim):**

````markdown
## Scenario Schema

Each scenario follows this structure:

```markdown
**Scenario {SERVICE-PREFIX}-{file#}.{scenario#} — {Short imperative title}**
- **GUID:** `{8-char lowercase hex}`
- **Reason:** {One sentence — the impact if this fails.}
\```
Given {precondition(s)}
When {action(s)}
Then {expected outcome(s)}
\```
```

**Field rules:**

| Field | Rule | Explanation |
|-------|------|-------------|
| **ID** | `{SERVICE-PREFIX}-{file#}.{scenario#}` — service prefix (e.g. `NQ`, `RC`, `MC`) + file number + scenario number. Each service's files number independently from 1. | Collision-proof across services; new services never need a global counter. |
| **Title** | Imperative phrase describing the action and its result (e.g., "Teacher posts grades → students see score"). Unique within the file. | |
| **GUID** | 8-character lowercase hex string (e.g., `4e7a2d1f`). Assigned once, never changed. | Used to trace scenarios to test implementations. |
| **Reason** | One sentence — the impact if this fails. | Enables informed business decisions when a test is missing, failing, or flaky. Also helps LLMs understand *why* a scenario exists, which produces better test implementations and gives them a way to verify their tests fulfill their stated purpose. |
| **GWT block** | Standard Gherkin. `Given` = stable preconditions. `When` = the action under test. `Then` = observable outcome(s), each on its own line beginning with `And` if multiple. | |

**Example:**

```markdown
**Scenario NQ-1.1 — Auto-graded New Quizzes score flows to Canvas gradebook**
- **GUID:** `{8-char lowercase hex}`
- **Reason:** {One sentence — the impact if this fails.}
\```
Given {precondition}
And {additional precondition}
When {action}
And {additional action}
Then {outcome}
And {additional outcome}
\```
```
````

---

## Quality checks before finishing

- Every scenario has a unique GUID
- Every `Reason` is a direct statement (no "Verifies that..." prefix)
- Every `Then` clause describes an outcome verifiable through the Canvas REST API (a grade value readable from the gradebook, a submission state queryable from submissions, an enrollment score visible through enrollments)
- No scenario step references a specific API endpoint, HTTP method, or URL path — steps use plain language only
- The triage decisions presented in Phase 1 account for every article found — nothing is silently skipped
- **Article gap analysis**: for each KB article marked In Scope, every integration-specific behavior identified in step 1b has a corresponding scenario — no identified cross-boundary behavior is left undocumented
