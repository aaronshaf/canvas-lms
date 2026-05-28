---
name: request-test-writer
description: Use this skill to write a single Rails request test for Canvas LMS from a Given/When/Then user scenario. The skill enforces opinionated rules to write readable, isolated, thorough, explicit tests that assert behavior over implementation.
when_to_use: Invoke when the user provides a Given/When/Then scenario, asks to "write a request test", or says "test this user scenario".
argument-hint: "[Given <preconditions> When <single HTTP action> Then <observable outcome>]"
arguments:
  - name: scenario
    description: A single Given/When/Then user scenario describing one HTTP request to Canvas and its expected observable outcome. The three clauses map to the test's Arrange / Act / Assert phases respectively (see Purpose). Multi-line input is accepted; the three clauses may appear on one line or three. Only one scenario per invocation — split variations into separate invocations.
    required: false
    default_behavior: If omitted or empty, the skill uses AskUserQuestion to collect Given, then When, then Then — one prompt at a time — and assembles the scenario from the answers before proceeding.
model: inherit
disable-model-invocation: false
user-invocable: true
allowed_tools:
  - AskUserQuestion
  - Agent
  - Read
  - Write
  - Edit
  - Grep
  - WebFetch(domain:developerdocs.instructure.com)
  - Bash(docker ps*)
  - Bash(docker inspect*)
  - Bash(docker cp*)
  - Bash(docker exec canvas-web bin/rubocop*)
  - Bash(docker exec canvas-web bin/rspec*)
  - Bash(docker exec canvas-web bin/rails routes*)
  - Bash(docker compose run --rm web bin/rubocop*)
  - Bash(docker compose run --rm web bin/rspec*)
  - Bash(docker compose run --rm web bin/rails routes*)
---

## Purpose

Generate one high-quality Rails request test for Canvas LMS from a Given/When/Then scenario.

The test must be readable, isolated, thorough, and explicit. It tests **behavior**, never implementation details. The scenario's three clauses map one-to-one onto the three phases of the produced test:

| Scenario clause | Test phase | What it contains | Mechanism |
| --- | --- | --- | --- |
| **Given** *(preconditions)* | **Arrange** | The world the request runs against: records, enrollments, feature flags, session, frozen time, outbound stubs. | Direct DB / model creation via Canvas factory helpers; `user_session`; `enable_feature!`; `Timecop.freeze`; `stub_request`. **Never** API calls unless it's absolutely unavoidable. |
| **When** *(single HTTP action)* | **Act** | Exactly one HTTP request to Canvas — the behavior under test. | `get`/`post`/`put`/`patch`/`delete` with an explicit verb, literal path, and `params:` / `headers:`. One call only. |
| **Then** *(observable outcome)* | **Assert** | Everything an outside observer can see after the request: response status, response body shape *and* values, DB state after `.reload`, and `have_requested` verification of every outbound stub. | `have_http_status`, `response.parsed_body` matchers, `record.reload.attr` matchers, `expect(WebMock).to have_requested(...)`. |

Two consequences of this mapping that the skill enforces:

- **A Given clause never becomes a request.** Setup is data, not API traffic — making it an API call causes ambiguous failure attribution and implicitly tests endpoints that aren't the focus.
- **A Then clause never becomes setup.** If the scenario's outcome is "the record now has X", the assertion belongs in Assert and must `.reload` (**reload-assertions**); pre-creating the record in state X verifies nothing.

The goal is **heavy coverage at this layer** — write many of these, not few. Dozens of request tests covering grade-calculation variations is normal and desirable.

### TDD usage

This skill tests an **existing** controller action — the workflow reads the action body, its `@API` block, scope filters, feature-flag reads, and outbound-HTTP collaborators, all of which require a real action in a real route. There is no TDD-mode branch in the workflow.

To use the skill in red-phase TDD, satisfy the precondition before invoking:

1. **Scaffold the route.** Add the entry to `config/routes.rb`.
2. **Scaffold a stub action.** Add the action method to the controller with a placeholder body — e.g., `render json: { todo: true }, status: :not_implemented`. Three to five lines; no real behavior required.
3. **Invoke `/request-test-writer <Given/When/Then>`.** The pre-flight resolves the route and reads the stub. Write proceeds normally. The Pre-flight summary's *Scope filters*, *Feature flags*, and *Outbound stubs* rows will show `<none — stub>`; that's expected.
4. **Expect the `Run` step to fail.** The test will not pass against the stub. The skill's 3-attempt fix loop will try and stop with `Status: failed (after 3 attempts)`. That failure is the TDD red signal — not a skill malfunction.
5. **Implement the action outside this skill.** Then re-run the test manually (`docker exec canvas-web bin/rspec spec/requests/...`) or via `/rspec` until green.
6. **Audit the green test with `/request-test-grader`.** That skill is purpose-built for grading an existing test against the rules and is the right tool once green.

This contract keeps the writer single-purpose ("test an existing action") and gives TDD users a predictable failure mode (route resolves → write proceeds → Run fails loudly), instead of a half-broken workflow that proceeds into steps that assume controller behavior exists.

The central principle, the test contract, the key distinctions about what is and isn't part of the system under test, and the full rule set this skill enforces are defined in `@../request-test-grader/references/request-test-rules.md` and included below. Two writer-specific operational notes that don't appear there:

- **Encourage breadth.** When a scenario has natural variations, invoke the skill once per variation. The skill does not refuse to add the 27th `it` to a file.
- **Suite-level config beats per-test ceremony for invariants.** If a constraint applies to *every* test of this shape (e.g., outbound HTTP must be stubbed, transactional isolation, time freezing baseline), it belongs in `spec/spec_helper.rb` or a `type:`-scoped hook — not duplicated in every `it`. When this skill is tempted to mandate ceremony in every test, prefer asking "should this be set once at the suite level?" first. Per-test ceremony is appropriate only when the invariant genuinely varies per test (e.g., the specific feature flag the test exercises).

## Divergence from the `rspec` skill

This skill **deliberately diverges** from the repo's general `rspec` skill in one important way: it forbids `let`, `subject`, instance variables, and `before` blocks. Each invocation produces a single `it` block where every value is local and visible inline.

**Why this divergence is intentional:**

The unit this skill protects is the **individual `it` block**, not the file. A spec file may accumulate many `it` blocks over time as new scenarios are tested — that's expected and fine. What the skill refuses to do is hoist setup out of any `it` into shared `let`/`before`/`subject` constructs, even when sibling `it`s would share similar setup.

1. **`let`, `subject`, and `before` trade per-test readability for cross-test DRY.** That trade is rarely worth it for request tests. A reader investigating a failure should be able to read **one `it` block end-to-end** and understand exactly what happened — what was created, what was sent, what was asserted — without scrolling to a `let` block 200 lines above or a `before` block that mutates `@user` in a way the failing line doesn't reveal. Duplicated setup across `it`s is cheap; hidden setup is expensive.
2. **`let` is lazily evaluated, which makes execution order non-obvious.** A reader debugging a failure has to mentally trace which `let`s are forced by which earlier references, in what order, with what side effects. Locals execute in source order; what you read is what runs.
3. **`before` blocks introduce hidden mutation order.** When multiple `before` blocks (top-level, nested `context`, shared examples) compose, the order they fire and the state they leave on `@vars` is hard to reason about. Locals inside one `it` have one obvious order: top to bottom.
4. **Behavior-over-implementation testing rewards localness.** A request test asserts what a user sees when they hit a URL. The Arrange step *is* part of the behavior under test: it defines the world that produces the observed output. Hiding it behind `let` and `subject` divorces cause from effect inside the test the reader is investigating.
5. **The `rspec` skill optimizes for a different shape of file.** Many-`it` describes with one shared `subject` and rich `let` graphs (e.g. unit specs on a single class) genuinely benefit from `let`. Request tests, where each `it` exercises a distinct URL + actor + payload combination, do not. Both skills can coexist; pick by context.

Apply this skill's rules over the `rspec` skill's rules whenever generating a request test from a G/W/T scenario.

@../request-test-grader/references/request-test-rules.md

## Workflow

Run the steps in order. Stop the moment any pre-flight refusal triggers.

**You MUST NOT narrate transitions between steps; state results as instructed only.** Do not write "Now I'll check X", "Let me run Y", "Moving on to step Z". The reader sees only the specified outputs of each step (dry-run summary, command outputs, grader report, final summary) — anything else is noise. Tool calls speak for themselves; the human-facing text should be the artifact each step is *contracted* to emit, nothing more.

### Parse the scenario

Extract:
- **Actor / role** (teacher, student, admin, observer, anonymous, etc.) — *who the scenario is about*.
- **Request initiator** — *who makes the HTTP request to Canvas*. This is distinct from the actor and dictates auth pattern, setup, and which precedent specs apply. One of:
  - `human-via-canvas-ui` — actor is using Canvas's web UI (default for browser scenarios; the UI uses cookie/session auth even when hitting `/api/v1/`).
  - `external-api-client-bearer` — actor is a script, integration, or LTI 1.x tool calling Canvas's REST API directly.
  - `sibling-service-as-client(<service>)` — a Canvas-adjacent Instructure service is the client (New Quizzes posting an AGS score, inst-fs upload callback, Notification Service webhook, canvas-rce calling back). The actor (student, teacher) is usually downstream of the service, not the requester. Signal phrases in the Given/When: "New Quizzes submits/posts...", "inst-fs callback...", "<service> notifies Canvas...".
  - `anonymous` — no auth context (testing redirect-to-login or `:unauthorized`).
- **Route** — HTTP verb + path.
- **Body/params** the request sends.
- **Expected status code, response shape, and DB-state changes** from the Then.

### Resolve route and read controller

Map the route to its controller and action:
1. `grep -rn '<path-pattern>' config/routes.rb config/routes/` first — fast and cheap.
2. Fall back to `docker compose run --rm web bin/rails routes | grep <path>` only when grep is ambiguous (path built via `resources` where the exact string doesn't appear).

Then **read the controller action** — the action method body plus its `@API` annotation block. Record for the **Pre-flight summary** step:

- **Params accepted** (from `@API` and the action body).
- **Scope filters** the action applies before the assertion-relevant work (`api_find`, `course.shard.activate`, `enrollments.active.where(...)`, `authorized_action`, policy gates). These determine what setup records must look like for the action to find them — most "test passes but proves nothing" failures trace to a scope filter the test didn't satisfy.
- **Feature flags read** — grep the action and its callees for `feature_enabled?`. Each flag found must be set explicitly in Arrange.
- **Outbound HTTP calls** — grep the action and its callees for `CanvasHttp`, `HTTParty`, `Net::HTTP`, `Faraday`, and known service clients (`InstFS`, `CanvasRce`, `NotificationService`, `LiveEvents`). Each call site is a collaborator that needs a `stub_request` + `have_requested`.

When the `@API` block is sparse and the route is `/api/v1/...`, you may `WebFetch` `https://developerdocs.instructure.com/...` **only** to disambiguate intent between two plausible candidates already found in-tree — never as the primary source. The docs lag master; the controller is authoritative.

### Locate precedent specs

Run this step when **either**:
- the initiator is `sibling-service-as-client(<service>)`, **or**
- the controller read in **Resolve route and read controller** surfaced outbound HTTP calls.

For each precedent need:

| Trigger | What to find | How |
| --- | --- | --- |
| Initiator is a sibling service | An existing spec where the same service is the client of Canvas. Mirror its developer-key setup, tool registration, scope grants, JWT minting, and request shape. | Consult the precedent map below first; if the service isn't listed, `grep -rn '<service>' spec/apis/ spec/requests/ spec/controllers/`. |
| Action makes an outbound call | An existing spec that stubs the same collaborator endpoint. Mirror the stub's `with(...)` matcher and response body. | `grep -rn 'stub_request.*<host-or-path-fragment>' spec/`. |

**Precedent map** (start here; expand as new scenarios uncover more):

| Sibling service | Inbound pattern (service → Canvas) | Precedent specs |
| --- | --- | --- |
| New Quizzes (AGS) | LTI Advantage AGS Score / Result POSTs | `spec/apis/lti/ims/scores_controller_spec.rb`, `spec/apis/lti/ims/results_controller_spec.rb` |
| LTI Advantage NRPS | Names & Roles Provisioning requests | `spec/apis/lti/ims/names_and_roles_controller_spec.rb` |
| LTI Advantage Line Items | Line-item CRUD by tools | `spec/apis/lti/ims/line_items_controller_spec.rb` |
| inst-fs | Upload-finished callback | `spec/controllers/files_controller_spec.rb` (s3 callback contexts) |

Do **not** synthesize a wire format from the controller alone. The controller accepts a permissive superset, so a synthesized request only proves Canvas handles *some* shape — not the one the collaborator actually sends. When no precedent exists, the refusal in **Pre-flight refusal checks** fires.

### Pre-flight refusal checks

Refuse and explain — do not silently proceed — when any of these are true:

| Condition | What to do |
| --- | --- |
| Actor or role is ambiguous (e.g. "a user") | Use `AskUserQuestion` to ask which role; do not guess. |
| **Resolve route** found no matching route in `config/routes.rb` | Refuse and report the closest matches. For TDD usage, see the **TDD usage** note in **Purpose**. |
| Scenario implies more than one HTTP call to Canvas | Refuse. Use `AskUserQuestion` to ask the user to split into separate scenarios or re-frame so setup is done via DB/factories instead of API calls. |
| Then is purely UI (tooltip, animation, DOM state, modal animation) | Attempt a response-body assertion first (HTML matchers if HTML response, JSON matchers if JSON). Only if no response-level assertion meaningfully proves the Then, refuse and point the user to a Selenium/JS test. |
| Near-duplicate `it` already exists in the target spec file or directory (fuzzy match: same route + similar Then text) | Refuse and print the existing test. Use `AskUserQuestion` to ask the user to decide: update, write a variant, or abandon. |
| Initiator is `sibling-service-as-client(<service>)` and **Locate precedent specs** found no precedent | Refuse. Use `AskUserQuestion` to ask for a captured wire sample (headers + body + JWT claims) or a precedent spec path. Do not synthesize the contract from the controller alone — the controller's accepted superset is not the collaborator's actual request. |
| Action makes an outbound HTTP call and **Locate precedent specs** found no precedent stub for that collaborator endpoint | Refuse. Use `AskUserQuestion` to ask for the collaborator's response contract or a precedent stub. Do not invent a plausible-looking response body. |

### Pick auth pattern

The auth pattern follows directly from the **request initiator** classified during **Parse the scenario**, not from the route prefix. The same Canvas endpoint (e.g. `/api/v1/conversations/unread_count`) is exercised by both the Canvas web UI (cookie/session) and external API clients (Bearer token), so route prefix alone is not enough.

| Initiator | Auth pattern |
| --- | --- |
| `human-via-canvas-ui` | `user_session(user)`. Default for any actor described as a Canvas UI user, including UI-driven `/api/v1/` calls. |
| `external-api-client-bearer` | Bearer access token in the `Authorization` header (see Authentication helpers). |
| `sibling-service-as-client(<service>)` | Whatever auth the precedent spec uses (LTI Advantage JWT for AGS/NRPS/Line Items, inst-fs HMAC for upload callbacks, etc.). Mirror the precedent; do not re-derive. |
| `anonymous` | No session setup. Pick the right assertion for the route class: HTML routes redirect (302) to `login_url`; `/api/v1/...` routes return `:unauthorized` (401). Picking the wrong half is a common silent-pass. |

No prompt — the chosen pattern is shown in the dry-run **Pre-flight summary**, where the user can object before any code is written. If the initiator is ambiguous (e.g. "a teacher requests..." without specifying UI vs. API client), default to `human-via-canvas-ui` and note the assumption in the summary.

### Resolve target spec file

Pick the spec file by following precedent:

- `human-via-canvas-ui` and `external-api-client-bearer` → `spec/requests/<resource>_spec.rb`.
- `sibling-service-as-client(<service>)` → the precedent spec's directory (typically `spec/apis/lti/ims/` for LTI Advantage; the collaborating directory for other services).
- If the file exists, plan to append a new `it` inside the existing `describe` block whose convention best fits the new test. When creating a new file, use `describe "<VERB> <path>"`; when appending, follow that file's existing convention (Canvas request specs commonly use `describe "<Resource Name>"` + nested `describe "<action>"`). Don't fight the file's style.
- If the route maps to multiple plausible spec files (e.g., the controller spans several specs), use `AskUserQuestion`.

When the chosen target file already exists and is at or above the **500-line soft cap** defined in `@../request-test-grader/references/request-test-rules.md`, surface a `File size:` row in the **Pre-flight summary** with a split recommendation. Do not refuse the write.

### Pre-flight summary

Print the summary below, then proceed immediately to **Write the test**. Do **not** wait for confirmation unless there is something you cannot resolve from the scenario and context — for example, the route is ambiguous between two controllers, or the initiator is unclear. When you do need to ask, use `AskUserQuestion` with one targeted question at a time; do not list multiple questions at once.

```
Target file:       <path>
Append/Create:     <append to existing block / create new file>
Initiator:         <human-via-canvas-ui / external-api-client-bearer / sibling-service-as-client(<service>) / anonymous>
Actor:             <role and helper>
Auth pattern:      <user_session / Bearer token / LTI Advantage JWT / inst-fs HMAC / none>
Controller:        <ClassName#action>
  Apipie params:   <one-line gist>
  Scope filters:   <one-line gist>
Precedent specs:   <paths — when initiator is sibling-service or stubs are mirrored>
Feature flags:     <flags to enable; site (SiteAdmin / RootAccount / Course); reason>
Outbound stubs:    <each stub with what it returns; "(mirrored from <precedent>)" where applicable>
HTTP call:         <verb> <path> params=<...> headers=<...>
Planned assertions:
  - response status: :ok
  - response body: <fields and expected values>
  - DB state: <records, columns, expected values>
  - outbound: have_requested(<stub>) times <n>
```

### Write the test

Insert the new `it` block following the composition rules defined in `@../request-test-grader/references/request-test-rules.md` (loaded above).

### Detect the run environment

Canvas engineers develop in Docker. **Refuse to declare a test green if you cannot reach a working environment** — produce a clear "environment not set up" message and stop instead.

> **TODO:** Running a test, running a linter, etc should be scripted. Until then, the model probes manually.

### Lint

```bash
docker exec <container> bin/rubocop -a spec/requests/<file>_spec.rb
```

### Run

```bash
docker exec <container> bin/rspec spec/requests/<file>_spec.rb:<line>
```

If failing, iterate up to **3 attempts** to fix. Each attempt:
1. Read the failure output.
2. Fix one root cause (do not patch symptoms).
3. Re-run.

If still failing after 3 attempts, stop and report. Do not declare success.

This skill verifies the test runs green. It does **not** verify the test catches behavior changes — that's mutation testing's job, and it belongs in a separate workflow that operates at module scope, not per-test. The Final summary nudges the user toward the `/test-mutation` command from the [claude-swe-workflows](https://github.com/chrisallenlane/claude-swe-workflows) plugin (not installed by default in this repo) as an optional follow-up.

### Self-review (delegated to the request-test-grader agent)

Before invoking the grader, confirm the Given/When/Then scenario produced exactly one `it` block. When creating a new spec file, use `describe "<VERB> <path>"`; when appending to an existing file, follow that file's existing convention (Canvas request specs commonly use `describe "<Resource Name>"` + nested `describe "<action>"`). Don't fight the file's style. *Why:* one scenario → one test gives clean failure attribution (when it breaks, the broken behavior is unambiguous). The grader sees one `it` at a time and structurally can't enforce this; it's the writer's check.

Invoke the `request-test-grader` subagent via the Agent tool to grade the new `it` block. The grader is the canonical enforcer of every rule defined in `@../request-test-grader/references/request-test-rules.md`; this skill does not re-implement the checklist.

Invocation:

- **subagent_type:** `request-test-grader`
- **description:** `Grade <basename>:<line>`
- **prompt:** `<path>:<line>`

The agent owns its own input contract, workflow, and output schema — do not restate them in the prompt. If you find yourself tempted to add instructions, edit the agent file instead.

Relay the agent's report to the user verbatim. The report contains a pass/fail result, the list of failing rules with fixes, and the list of N/A rules.

**Acting on the verdict:**

- **`result=pass`** (zero failures): proceed to **Final summary**.
- **`result=fail`** (one or more failures): every failure is a required rewrite. Apply the `Failures` fixes in order, then **re-invoke the grader** on the same `it`. Repeat until `result=pass` or **3 rewrite iterations** have been attempted.

The result is read from the agent's machine-readable trailer — the `result=` field inside the `=== machine-readable === ... === end ===` block at the bottom of every report. Possible values: `pass`, `fail`. The `## Result` heading's bold `**PASS**` / `**FAIL**` is the human-readable redundant copy; the trailer is canonical for the rewrite loop. If the trailer is missing or malformed, that is a bug in the agent file, not something to paper over here.
- If still failing after 3 iterations: stop, surface the latest grader report in the Final summary, and let the user decide.

Emit the grader's report at each iteration, the diff applied between reports, and the next report. Do not narrate transitions between iterations beyond what the reports themselves convey.

### Final summary

Print:

```
File:              <path>
Test description:  <the it string>
Status:            green / failed (after N attempts)
Grader verdict:    <pass / fail> (after <N> rewrite iteration(s))
```

When `Status: green`, append a nudge that explains *why* the user should follow up:

```
Next: a green test only proves the spec runs — not that it would catch a bug. Only mutation testing proves the assertions actually fail when production behavior changes. Consider running `/test-mutation` from the claude-swe-workflows plugin (https://github.com/chrisallenlane/claude-swe-workflows) against this module. Not installed by default in this repo.
```

Omit the nudge when the run failed.

## Authentication helpers

| Auth pattern | When to use | Setup |
| --- | --- | --- |
| `user_session` (cookie/session) | Default for any actor described as a Canvas UI user (teacher, student, admin in the web UI). Works for both page routes and `/api/v1/` endpoints — the Canvas UI calls `/api/v1/` with the same session cookie. | `user_session(user)` where `user` is set up via a Canvas helper. If the code under test reads attributes off the pseudonym beyond identity (`pseudonym.account`, `pseudonym.sis_user_id`, `pseudonym.unique_id`), pass the real pseudonym as the second arg: `user_session(user, user.pseudonym)`. The default builds a stub pseudonym with `account: nil` that misbehaves when the controller reaches past identity. |
| Bearer access token | Actor is an external API client, integration, script, or LTI 1.x tool calling Canvas's REST API (i.e., not the Canvas UI). | `token = user.access_tokens.create!(purpose: "test")`, then `headers: { "Authorization" => "Bearer #{token.full_token}" }`. **Note:** `.full_token` is populated only on the in-memory instance returned by `create!`; after a reload it returns `nil` (only the crypted form is persisted). Use the token immediately. The shared helper `access_token_for_user(user)` in `spec/apis/api_spec_helper.rb` encapsulates this pattern when it's already in scope. |
| LTI service auth | Route is under `/api/lti/...` (LTI Advantage services). | JWT signed with the tool's developer key, sent as a Bearer token. The minting pattern is `Lti::OAuth2::AccessToken.create_jwt(aud:, sub:)`; the `lti2_api_spec_helper` shared context (`spec/apis/lti/lti2_api_spec_helper.rb`) provides `access_token` / `request_headers` lets. Consult existing `spec/apis/lti/ims/...` specs and confirm with the user — pattern varies by endpoint. |
| Anonymous | Actor is unauthenticated (testing redirect-to-login or `:unauthorized`). | No session setup. HTML routes: assert `expect(response).to redirect_to(login_url)` (302). `/api/v1/...` routes: assert `have_http_status(:unauthorized)` (401) with a JSON body. Picking the wrong half is a common silent-pass. |

## Failure handling

- **Spec file:** left in place on disk for the user to inspect, regardless of outcome. The user can `git rm` or edit it manually.
- **Always print the final summary**, even on failure. Tell the user what state the working tree is in (e.g., "spec file written but failing — last failure attached").

## Example output

For the scenario:

```
Given a teacher in a published course
When the teacher requests the course's enrollments
Then the response succeeds and adheres to the API specification
```

The skill produces something like:

```ruby
# spec/requests/courses_api_spec.rb
require_relative "../support/request_helper"

describe "GET /api/v1/courses/:id/enrollments" do
  it "returns the requesting teacher's TeacherEnrollment" do
    # Arrange
    enrollment = course_with_teacher(active_all: true)
    course = enrollment.course
    teacher = enrollment.user

    user_session(teacher)

    # Act
    get "/api/v1/courses/#{course.id}/enrollments"

    # Assert
    expect(response).to have_http_status(:ok)
    enrollments = response.parsed_body
    expect(enrollments.size).to eq(1)
    expect(enrollments.first["user_id"]).to eq(teacher.id)
    expect(enrollments.first["type"]).to eq("TeacherEnrollment")
    expect(enrollments.first["course_id"]).to eq(course.id)
  end
end
```
