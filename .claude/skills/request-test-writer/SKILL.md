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
  - Read
  - Write
  - Grep
  - WebFetch(domain:developerdocs.instructure.com)
  - Bash(cp * *.mutation-bak)
  - Bash(cp *.mutation-bak *)
  - Bash(rm *.mutation-bak)
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

Each phase in the `it` block is introduced by a `# Arrange` / `# Act` / `# Assert` header comment (**aaa-headers**), so a reader can locate each clause of the original scenario at a fixed position in the test body without parsing it — even when Arrange itself uses internal blank lines to group setup steps.

Two consequences of this mapping that the skill enforces:

- **A Given clause never becomes a request.** Setup is data, not API traffic — making it an API call collapses Arrange and Act, causes ambiguous failure attribution (**one-request**), and implicitly tests endpoints that aren't the focus.
- **A Then clause never becomes setup.** If the scenario's outcome is "the record now has X", the assertion belongs in Assert and must `.reload` (**reload-assertions**); pre-creating the record in state X verifies nothing.

These tests sit at the **value–cost sweet spot** between unit tests and end-to-end tests. The cost per test is low enough to exercise many behavioral variations — different roles, input combinations, edge paths — while still hitting the real controller, model, serializer, and auth stack. That is coverage unit tests alone don't prove (they can all pass while the integration is broken) and coverage end-to-end tests can't afford in bulk (one end-to-end test is roughly the runtime and flake budget of many request tests).

The goal is **heavy coverage at this layer** — write many of these, not few. Dozens of request tests covering grade-calculation variations is normal and desirable.

**Central principle:** *Exercise the behavior of a single system — and only that system — through its public interface.* For this skill, the single system is Canvas, and the public interface is HTTP.

Key distinctions:

- **System under test = Canvas, and Canvas only.** Other HTTP-served applications (canvas-rcs, Notification Service, pandapub, live events, inst-fs, SIS providers, third-party LTI tools) are *collaborators* whose responses are stubbed at the boundary. This is what separates a request test from an end-to-end test: the end-to-end test exercises the integration; the request test exercises Canvas's behavior given a fixed collaborator contract.
- **Infrastructure ≠ collaborator.** The database, local filesystem, cache, and *locally-faked* storage (fake S3, local file storage) are part of Canvas's runtime — they are real and the test uses them directly. Don't mock them. *Network-served* storage and adjacent services (inst-fs, canvas-rcs, Notification Service, pandapub, live events, SIS providers, third-party LTI tools) are collaborators — stub their HTTP traffic with WebMock and verify with `have_requested`. The dividing line is "does the production code make an HTTP call to reach it?", not "is it called 'storage'".
- **Tests describe use cases, not code.** The `it` description should map to something a user or integrator would recognize ("a teacher publishes a course"), not name a Ruby method or controller action. Refactoring Canvas's internals must not require rewriting the description — only the assertions, and only if the contract changed.
- **Public-interface tests pair with contract tests at the boundary.** This skill does not produce contract tests; it assumes the contract with each collaborator is verified elsewhere. Stubs must match the *current* contract, not a simplified fiction.
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

## The test contract

What a test produced by this skill is and is not allowed to do:

| Capability | Allowed? |
| --- | --- |
| Mocks, fakes, stubs | Allowed (boundary only — WebMock, Timecop, fs, env, randomness; never Canvas internals — see **no-internal-mocks**) |
| Network access | Localhost only (the Canvas app under test). All non-localhost calls must be stubbed with WebMock (see **verify-stubs**). The suite-wide WebMock posture is set centrally in `spec/spec_helper.rb`; tests do not flip it per-example. |
| Database | Yes (real DB; no ActiveRecord mocking) |
| File system access | Yes (uploads, attachments, fixtures, tempfiles all OK) |
| More than one service | No (the test exercises Canvas only — never also hits a sibling HTTP service like inst-fs, canvas-rcs, or pandapub; outbound calls to such services must be stubbed) |

This contract is the source of truth. If a rule or workflow step in this document conflicts with it, the contract wins.

## Workflow

Run the steps in order. Stop the moment any pre-flight refusal triggers.

**You MUST NOT narrate transitions between steps; state results as instructed only.** Do not write "Now I'll check X", "Let me run Y", "Moving on to step Z". The reader sees only the specified outputs of each step (dry-run summary, command outputs, self-review checklist, final summary) — anything else is noise. Tool calls speak for themselves; the human-facing text should be the artifact each step is *contracted* to emit, nothing more.

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
| **Resolve route** found no matching route in `config/routes.rb` | Refuse and report the closest matches. **Exception:** the user explicitly signals TDD ("I'm writing the test first"); then proceed. |
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
- If the file exists, plan to append a new `it` inside the existing `describe` block whose convention best fits the new test — see **one-it**.
- If the route maps to multiple plausible spec files (e.g., the controller spans several specs), use `AskUserQuestion`.

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

Insert the new `it` block following the composition rules below.

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

### Mutation check (only when test is green)

Identify production lines that the action's code path actually exercises — controller action, called service methods, policies, model callbacks invoked by the request. Pick mutation targets *after* the **Lint** step's rubocop autofix has run, so the lines you target match what's on disk.

**Before any mutation**, snapshot each candidate file:

```bash
cp <file> <file>.mutation-bak
```

This `.mutation-bak` is the authoritative restore source. Do **not** rely on Edit's `old_string` matching to restore — autofix may have moved the line, and mutations can accidentally collide with similar text elsewhere in the file.

Then, up to a **budget of 5 mutation attempts total** across all candidate files, repeat:

1. Apply one mutation at a time using Edit. Mutation operators:
   - Invert a boolean condition (`if x` → `if !x`).
   - Change a return value (`return foo` → `return nil`).
   - Flip a comparison (`==` → `!=`, `>` → `<=`).
   - Replace a value with a sentinel.
2. Run the spec.
3. **Restore** by `cp <file>.mutation-bak <file>`. Verify by re-reading the mutated line; the file must match the backup before the next attempt.
4. Record the outcome: did the spec fail with an **assertion failure** (`RSpec::Expectations::ExpectationNotMetError`) — not a `NameError`, `NoMethodError`, or other crash?
5. **Stop early** as soon as one mutation produces an assertion failure — that's a pass; further mutations add no signal.

When the check ends (budget exhausted or early pass), delete every `*.mutation-bak` file you created and confirm the originals are intact by re-reading the mutated lines.

**If restoration ever fails** (`cp` errors, backup missing, file modified between snapshot and restore): stop, do not proceed to the next mutation, and clearly tell the user which file is still mutated and where the `.mutation-bak` lives on disk so they can restore manually. Littering is acceptable as long as the user is loudly informed; silent leftovers are not.

The mutation check **passes** if at least one mutation within the 5-attempt budget produces an assertion failure. A crash-on-mutation does not count — that proves the code path runs, not that the assertion catches a behavior change.

If no mutation produces an assertion failure, the test is tautological. Rewrite it with stronger assertions and rerun **Lint → Run → Mutation check**.

> **TODO:** Managing files for mutations should be scripted or outsourced. Until then, give the LLM written instructions.

### Self-review

Walk the checklist below **and emit the result to the user** as a checklist with explicit ✓ / ✗ per item before declaring the test ready. Do not silently "walk it" — externalize the walk so the reader can audit which items were verified. For any ✗, rewrite the test and rerun **Lint → Run → Mutation check**; only proceed to the final summary when every item is ✓.

Output format the model must produce:

```
Self-review:
- ✓ Exactly one `it`, nested in a `describe` that matches the file's convention (**one-it**).
- ✓ Each of the three phases is introduced by an exact `# Arrange` / `# Act` / `# Assert` header comment, with a blank line between phases (**aaa-headers**).
- ✗ Body assertions check both shape and value, not just `have_key` (**shape-and-value**).  ← rewriting
  ...
```

- [ ] Exactly one `it`, nested in a `describe` that matches the file's convention (**one-it**).
- [ ] Each of the three phases is introduced by an exact `# Arrange` / `# Act` / `# Assert` header comment, with a blank line between phases (**aaa-headers**).
- [ ] No mocks of Canvas internals; mocks limited to WebMock/Timecop/fs/env/randomness (**no-internal-mocks**).
- [ ] Every `stub_request` is matched by a `have_requested(...)` verification (**verify-stubs**).
- [ ] Body assertions check both shape and value, not just `have_key` (**shape-and-value**).
- [ ] Every DB-state assertion uses `.reload` (**reload-assertions**).
- [ ] No `let`, `subject`, instance variables, or `before` blocks (**no-shared-setup**, **no-before-all**).
- [ ] No `if`/`unless`/`case` whose branch can vary between runs; loops only in Arrange (**no-runtime-branching**).
- [ ] HTTP call uses explicit verb + literal path + `params:` / `headers:`; no route helpers (**literal-path**).
- [ ] Status assertions use Rails symbols (`:ok`, `:forbidden`, ...) (**symbol-statuses**).
- [ ] Exactly one HTTP call to Canvas (**one-request**).
- [ ] `it` description is plain-English user-visible behavior, no method names (**plain-english-it**).
- [ ] Every asserted value appears explicitly in setup; no factory-default magic (**no-magic-values**).
- [ ] Matchers are the most precise available for each target (**precise-matchers**).
- [ ] Numeric type-contract assertions use `eql`; everything else uses `eq` (**eql-for-numerics**).
- [ ] Feature flags (if any) are set before `user_session` and at the right context (`SiteAdmin` / `RootAccount` / `Course`); `state: hidden` flags also enabled at SiteAdmin.
- [ ] Auth matches the request initiator classified during **Parse the scenario** (`human-via-canvas-ui` → `user_session`; `external-api-client-bearer` → Bearer; `sibling-service-as-client(...)` → mirrored from the precedent spec; `anonymous` → no setup with the right route-class assertion).
- [ ] For `sibling-service-as-client(...)` scenarios, the request body, headers, and auth match a precedent spec — nothing synthesized from the controller alone.
- [ ] Every outbound stub's `with(...)` matcher and response shape was mirrored from an existing spec for the same collaborator endpoint — never invented.

### Final summary

Print:

```
File:              <path>
Test description:  <the it string>
Status:            green / failed (after N attempts)
Mutation check:    passed (caught: <mutation>) / passed (N/M mutations caught) / failed
Self-review:       passed / failed (violations: ...)
```

## Composition rules

Each rule below states **what** to do, then *why*. The "why" matters for judgment calls in edge cases — don't follow the rule blindly; understand the failure mode it prevents. Rules are referenced by slug throughout this document.

### one-it

**Exactly one `it`** per scenario. The Given/When/Then collapses into a single example. Nest inside an appropriate `describe` block: when creating a new spec file, use `describe "<VERB> <path>"`; when appending to an existing file, follow that file's existing convention (Canvas request specs commonly use `describe "<Resource Name>"` + nested `describe "<action>"`). Don't fight the file's style.

*Why:* One scenario → one test gives clean failure attribution. When the test breaks, the broken behavior is unambiguous. Splitting into multiple `it`s fragments the signal and creates pressure to share setup — which **no-shared-setup** forbids. Matching the surrounding file's `describe` convention keeps grep, suite listings, and code review unsurprising; deviating only at the seam where this skill's test lands is more cost than signal.

### aaa-headers

**Arrange-Act-Assert layout, labeled with `# Arrange` / `# Act` / `# Assert` comments.** Each phase is introduced by its own header comment on its own line, immediately above the first line of that phase. Use exactly these three labels — no variants (`# Setup`, `# Given`, `# Verify`). Separate phases from each other with a blank line; within Arrange, you may also use blank lines to group related setup steps. Example layout:

```ruby
it "..." do
  # Arrange
  enrollment = course_with_teacher(active_all: true)
  course = enrollment.course

  teacher = enrollment.user
  user_session(teacher)

  # Act
  get "/api/v1/courses/#{course.id}/enrollments"

  # Assert
  expect(response).to have_http_status(:ok)
  expect(response.parsed_body.first["user_id"]).to eq(teacher.id)
end
```

*Why:* The three phases of a test do different jobs and the reader needs to locate each at a glance. Blank-line separation alone is ambiguous because Arrange often benefits from its own internal blank lines (grouping factory setup, then auth, then stubs) — once Arrange has internal blanks, "the next blank line starts Act" stops being a reliable rule. Explicit `# Arrange` / `# Act` / `# Assert` headers make the phase boundaries unambiguous regardless of how much whitespace each phase uses internally, and they let a reader map the `it` body back to the original Given/When/Then clauses without parsing it.

### no-internal-mocks

**No mocks of Canvas's own code.** No `allow(SomeService).to receive(...)`, no `expect(SomeClass).to have_received(...)` against Canvas internals. The only allowed mocks are boundary mocks: WebMock (outbound HTTP), Timecop (time), filesystem stubs, ENV stubs, randomness stubs.

*Why:* Mocking internals couples the test to *how* Canvas implements behavior, not *what* it does. An internal refactor then breaks tests that never observed a behavior change. The Test contract requires Canvas itself to run; mocking its code violates that.

### verify-stubs

**WebMock stubs are verified.** Every `stub_request` must be paired with `expect(WebMock).to have_requested(...).with(...)`.

*Why:* A stub that never fires is a silent test gap — the production code may have skipped the call entirely (wrong branch, early return, feature-flag off) and the test still passes. Verifying the stub was hit proves the path under test actually ran.

### shape-and-value

**Body assertions check shape AND value.** `expect(response.parsed_body["id"]).to eq(course.id)`, never just `have_key("id")`.

*Why:* Shape-only assertions pass when the response is wrong but well-formed (e.g. the endpoint returned the wrong record with the right keys, or an empty array where data was expected). Value assertions catch correctness regressions; shape catches structural regressions; both matter.

### reload-assertions

**DB-state assertions always `.reload`.** `expect(course.reload.workflow_state).to eq("available")`.

*Why:* ActiveRecord caches attributes on the in-memory object. Without `.reload` you may assert against the *pre-request* state — passing when the DB actually changed (false positive) or failing when the request correctly persisted a different value (false negative). `.reload` guarantees you're checking what was actually saved.

### no-shared-setup

**No `let`, no `subject`, no `@instance_vars`, no `before` blocks.** All setup is local to the `it` block.

*Why:* See the full reasoning in the [Divergence](#divergence-from-the-rspec-skill) section. Short version: a reader investigating a failure should read one `it` block top-to-bottom and see every value the assertions depend on, in source order, with no scrolling and no lazy-evaluation surprises.

### no-runtime-branching

**No conditional logic whose branch can vary between runs. Loops only in Arrange, only for creating N similar records.** Banned: `if`/`unless`/`case` whose path depends on time, randomness, or external state. Allowed: deterministic filtering — `Array#detect`/`#find`/`#select` to pick a specific record out of a fixed collection (the response order is the only path).

*Why:* Non-deterministic branching makes failure reproduction become "which branch did I hit?". Loops in assertions hide which iteration broke. Loops in Arrange (creating N similar records) are tolerated because each iteration is identical and the failure points to data setup, not assertion logic. Deterministic filtering is the legitimate way to address one element inside a list response — banning it would force fragile index-based assertions instead.

### literal-path

**Explicit verb + literal path + params/headers.** `get "/api/v1/courses/#{course.id}", params: {...}, headers: {...}`. No route helpers, no `process`.

*Why:* The path the user actually hits is part of the contract under test. Hiding it behind `api_v1_course_url(course)` means a renamed route silently still passes — and the test no longer documents the URL. Literal paths also make grep-by-route trivial during route audits and incident triage.

### symbol-statuses

**Status assertions use Rails symbols.** `have_http_status(:ok)`, `:forbidden`, `:not_found`. Integer literal only when no symbol exists for that status code.

*Why:* Symbols encode intent — `:forbidden` reads as "403 was the right answer", while `403` requires the reader to translate. In code review, `:ok` vs. `:created` is unmistakable; `200` vs. `201` is a one-character diff easy to miss. Typo'd symbols (`:okk`) raise loudly; typo'd integers (`405` instead of `404`) silently change the assertion.

### no-before-all

**No `before(:all)` / `before(:context)`.**

*Why:* `before(:all)` runs once per group and persists records *outside* the per-example transaction wrapper, so they leak across examples. If any example mutates them, downstream examples see undefined state — producing order-dependent failures that are notoriously hard to reproduce. **no-shared-setup** already forbids all `before` blocks; this rule pins the worst variant specifically.

### one-request

**Exactly one HTTP call to Canvas per test.** Setup happens via direct model creation and Canvas helpers, not via API calls.

*Why:* A test with two requests has ambiguous failure attribution — when the second fails, was it the bug under test, or did the first request leave state the second didn't expect? One call = one behavior under test. API-driven setup also slows the test and implicitly tests endpoints that aren't the focus.

### stub-outbound

**Outbound HTTP** — every external call the production code makes must be stubbed with WebMock and verified with `have_requested` (per **verify-stubs**). The suite-wide WebMock posture (whether unstubbed non-localhost calls raise or pass through) is configured centrally in `spec/spec_helper.rb`; do not flip it from inside the `it` block.

*Why:* Real outbound calls make the test slow, flaky, and dependent on services outside the system under test — directly violating the Test contract's "single service" guarantee. Stubs at the boundary keep the test deterministic while still proving Canvas's contract with each collaborator. Flipping the global net-connect flag inside one `it` leaks the change to every subsequent example in the process — that's a suite-wide setting, not a per-test one.

### plain-english-it

**`it` description = plain-English Then.** No "should", no method names, no `#method_name` syntax. Describe observable behavior.

*Why:* The description is what shows up in failure output and the suite's printed listing — a reader scanning failures should see the *user-visible behavior* that broke, not a Ruby symbol or implementation hint. Decoupling descriptions from method names also means internal refactors don't churn test names.

### no-magic-values

**No magic values.** Every value an assertion checks must appear explicitly in setup. If the test asserts `name == "Algebra 101"`, the course was created with `name: "Algebra 101"` — never relying on a helper's default.

*Why:* When an assertion's expected value silently comes from a factory default, the reader can't tell whether the assertion is meaningful (verifying a real behavior) or vacuous (verifying that the default echoes itself). Explicit setup makes the cause-effect link auditable and survives helper-default changes.

### precise-matchers

**Assertions must produce informative failure messages.** Pick the most precise matcher and target available so a failure shows exactly what differed — never just "true/false" or a wall of HTML. Prefer `eq` on a specific field over `include` on a whole body. Prefer `have_http_status(:ok)` over `response.successful?`. Prefer `expect(course.reload.workflow_state).to eq("available")` over `expect(course.reload).to be_available`.

*Why:* A reader of the rspec failure output should be able to identify the bug without re-running the test or reading the test code. Generic matchers like `be_truthy` or `include` produce failure messages that hide the difference between expected and actual; precise matchers surface it.

### eql-for-numerics

**Use `eql` for numeric assertions where Integer-vs-Float matters; `eq` everywhere else; `be` only for `true` / `false` / `nil` / object-identity.** `eq` uses `==`, which treats `5` and `5.0` as equal — fine for strings, IDs, arrays, hashes, and custom objects. For numeric fields whose type is part of the response contract (scores, points_possible, percentages), use `eql` — it uses `.eql?` and refuses to call `5` and `5.0` equal. Example: `expect(response.parsed_body["points_possible"]).to eql(10)` catches a serializer regression that flips the value to `10.0`; `eq(10)` would silently pass.

*Why:* Request specs are the layer that pins the serialized contract, including its types. Integer↔Float drift is a silent-regression class: invisible under `eq`, visible under `eql`. `be` checks object identity and is not a substitute for value equality.

**Linter conflict.** If a cop (e.g., `RSpec/BeEql`) autocorrects `eql(...)` to `be(...)`, do not accept the autocorrect on these assertions — override with a single-line disable: `expect(body["score"]).to eql(8.0) # rubocop:disable RSpec/BeEql`. The comparison rule wins; the linter is silenced narrowly where it conflicts.

## Canvas-specific defaults

Each default below has a "why" line for the same reason as the composition rules — judgment matters when the default doesn't quite fit.

- **Factories — Canvas helpers first.** Prefer Canvas helpers (`course_with_teacher`, `student_in_course`, `account_admin_user`, `course_with_student`). Drop to `Model.create!(...)` only when no helper fits.
  *Why:* Canvas helpers wire up the full related-record graph (course + account + enrollment + role + workflow_state transitions) that Canvas's endpoints, policies, and serializers expect. Bare `Model.create!` produces records in default/created states with no related records — so endpoints that filter to published courses, look up enrollments, or check role memberships return empty/404, looking like product bugs but really setup bugs.

- **Factory chaining — pass the link explicitly and verify the helper accepts it.** When a second factory helper should attach to a record produced by the first (e.g., adding a student to the *same* course the teacher was enrolled in), pass the linking record explicitly as a keyword: `course_with_student(course: teacher_enrollment.course, active_all: true)`. Then quickly verify the helper actually consumes the keyword — read its definition in `spec/factories/`, or assert post-setup that the records are linked (`expect(student_enrollment.course).to eq(teacher_enrollment.course)`).
  *Why:* Several Canvas factory helpers set `@course` / `@user` / `@enrollment` as instance variables and *also* read them as fallbacks when an opts hash is missing the key. A helper that silently ignores an unknown keyword (no `course:` parameter) will create a *second* course, leaving the test with two unrelated courses and a teacher and student split across them. The URL in the request then references one course while the student is on another — endpoint returns 404 or 403, the failure looks like a permissions or product bug, but the real bug is in setup. Explicit linking + a quick sanity check eliminates this class of silent-pass.

- **Feature flags — always explicit, set before any code path that reads them.** When the controller action checks a feature flag (grep the action for `feature_enabled?`), set it in the test with `enable_feature!` / `disable_feature!`, even if the dev default already matches. Set the flag *before* `user_session` and before the request — `RequestCache` and `Rails.cache` memoize `feature_enabled?` lookups within a request, so flipping a flag after the first lookup leaves the controller acting on stale state.

  **Pick the enable site by the flag's `applies_to` (check `config/feature_flags/*.yml`):**
  - `SiteAdmin` → `Account.site_admin.enable_feature!(:flag_name)`
  - `RootAccount` → `Account.default.enable_feature!(:flag_name)` (or `course.root_account.enable_feature!` if the test created its own root)
  - `Course` → `course.enable_feature!(:flag_name)`

  **Hidden-flag gotcha:** flags declared `state: hidden` in their YAML are invisible at lower contexts until enabled at SiteAdmin first. Grep the flag's YAML entry for `state: hidden` and, if present, also call `Account.site_admin.enable_feature!(:flag_name)` *before* the root/course enable — otherwise the lower call silently no-ops and the controller takes the flag-off branch.

  *Why:* Feature-flag defaults flip over time. A test that relied on the implicit default silently changes meaning the day the default flips, with no test edit. Explicit setting locks the test to the behavior it verifies. Pinning the right context prevents the "enabled on default account but the flag is SiteAdmin" silent miss, and setting before `user_session`/the request prevents stale memoization from masking the change.

- **Sharding — only when the scenario mentions cross-shard behavior.** Add `specs_require_sharding` only then.
  *Why:* The sharding helper spins up multiple databases and runs the test against each — substantially slower. Enabling it when no shard behavior is under test wastes CI minutes for no signal.

- **Time — Timecop.** Use `Timecop.freeze(time) { ... }` or `Timecop.travel`. Do not use Rails `travel_to`.
  *Why:* Canvas's existing suite is Timecop-based. Mixing in `travel_to` splits time control across two mechanisms with subtly different semantics (`travel_to` doesn't stack the way Timecop does), making time-bug debugging harder. Consistency over micro-preference.

- **Account — `Account.default` unless isolation is required.** Use `Account.default`; switch to `Account.create!(name: "...")` only when the test mutates account-level settings (sub-accounts, account-scoped feature flags, root-account configs).
  *Why:* Most Canvas helpers hardcode `Account.default`. Creating a fresh account is slower and silently breaks helpers that don't accept an account override. Only pay the cost when the test genuinely needs account-level isolation.

- **JSON parsing — `response.parsed_body`.** Never `JSON.parse(response.body)`.
  *Why:* `parsed_body` is the Rails 7+ idiom, respects Content-Type, and produces clearer failure messages when the response isn't actually JSON (e.g. HTML error page).

- **CSRF protection — off by default in the test env; don't fight it.** `config/environments/test.rb` sets `config.action_controller.allow_forgery_protection = false`. Don't add CSRF tokens, `X-CSRF-Token` headers, or `enable_forgery_protection` to a normal request spec.
  *Why:* The env default is correct for nearly every request spec. Manually re-enabling forgery protection or constructing CSRF tokens adds ceremony that fails open (the test passes but proves nothing about CSRF). Only reach for `enable_forgery_protection` when the scenario is specifically "this endpoint must reject a request without a CSRF token."

- **HTTP body — default to a plain `params:` hash; set JSON headers only when needed.** Most Canvas controllers accept `params: { ... }` regardless of content type — that's the prevailing Canvas request-spec idiom. Use `headers: { "CONTENT_TYPE" => "application/json", "ACCEPT" => "application/json" }` with `params: payload.to_json` only when the controller meaningfully distinguishes JSON-body from form-encoded (e.g., it reads `request.raw_post` / `JSON.parse(request.body.read)` directly) or when the endpoint content-negotiates such that HTML would redirect.
  *Why:* Defaulting to the plain-hash form keeps tests indistinguishable from the surrounding Canvas suite. The JSON-headers form is correct but heavier, and reserving it for endpoints that actually require it concentrates the ceremony where it matters. Without `CONTENT_TYPE: application/json`, a controller that *does* parse the raw body will see your `to_json` payload as a single string param instead of a hash — symptom is "params look empty"; in that case, switch to the JSON form.

## Authentication helpers

| Auth pattern | When to use | Setup |
| --- | --- | --- |
| `user_session` (cookie/session) | Default for any actor described as a Canvas UI user (teacher, student, admin in the web UI). Works for both page routes and `/api/v1/` endpoints — the Canvas UI calls `/api/v1/` with the same session cookie. | `user_session(user)` where `user` is set up via a Canvas helper. If the code under test reads attributes off the pseudonym beyond identity (`pseudonym.account`, `pseudonym.sis_user_id`, `pseudonym.unique_id`), pass the real pseudonym as the second arg: `user_session(user, user.pseudonym)`. The default builds a stub pseudonym with `account: nil` that misbehaves when the controller reaches past identity. |
| Bearer access token | Actor is an external API client, integration, script, or LTI 1.x tool calling Canvas's REST API (i.e., not the Canvas UI). | `token = user.access_tokens.create!(purpose: "test")`, then `headers: { "Authorization" => "Bearer #{token.full_token}" }`. **Note:** `.full_token` is populated only on the in-memory instance returned by `create!`; after a reload it returns `nil` (only the crypted form is persisted). Use the token immediately. The shared helper `access_token_for_user(user)` in `spec/apis/api_spec_helper.rb` encapsulates this pattern when it's already in scope. |
| LTI service auth | Route is under `/api/lti/...` (LTI Advantage services). | JWT signed with the tool's developer key, sent as a Bearer token. The minting pattern is `Lti::OAuth2::AccessToken.create_jwt(aud:, sub:)`; the `lti2_api_spec_helper` shared context (`spec/apis/lti/lti2_api_spec_helper.rb`) provides `access_token` / `request_headers` lets. Consult existing `spec/apis/lti/ims/...` specs and confirm with the user — pattern varies by endpoint. |
| Anonymous | Actor is unauthenticated (testing redirect-to-login or `:unauthorized`). | No session setup. HTML routes: assert `expect(response).to redirect_to(login_url)` (302). `/api/v1/...` routes: assert `have_http_status(:unauthorized)` (401) with a JSON body. Picking the wrong half is a common silent-pass. |

## Failure handling

- **Mutation cleanup:** restore each mutated file by `cp <file>.mutation-bak <file>`, then delete the `.mutation-bak` snapshot. No `git checkout`, no stash — Claude undoes its own edits in-process, scoped to the specific file. This avoids ever touching the user's uncommitted work in unrelated files.
- **If a restore fails** (cp errors, backup missing, file modified between snapshot and restore): stop immediately. Tell the user exactly which file is still mutated and where the `.mutation-bak` lives on disk, so they can restore manually. Littering is acceptable as long as it is loudly reported; silent leftovers are not.
- **Spec file:** left in place on disk for the user to inspect, regardless of outcome. The user can `git rm` or edit it manually.
- **Always print the final summary**, even on failure. Tell the user what state the working tree is in (e.g., "spec file written but failing; production code restored", or "spec file written; mutation still applied to `app/controllers/foo.rb:123` — please revert manually").

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
