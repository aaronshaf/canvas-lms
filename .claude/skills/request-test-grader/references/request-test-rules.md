# Request Test Rules

This file is the canonical source of truth for the rules that define a well-formed Canvas request test and the reasoning behind each rule.

It is `@include`d by:

- `request-test-writer` SKILL.md — to inform write-time decisions.
- `request-test-grader` agent — to enforce rules at grade time.
- `request-test-grader` SKILL.md — to show users what the grader checks.

No other file restates these rules. Edits here are authoritative.

## Goal

Reliable (not flaky) tests that are easy to understand when they fail.

"Easy to understand when they fail" has two halves, and both matter:

1. **The failure message names the defect.** A reader of the rspec output can identify what's wrong without re-running the test or opening the test file. Precise matchers, value (not shape) assertions, and reloaded DB reads all serve this.
2. **The test itself is scannable.** When the failure message isn't enough and the engineer (or LLM) opens the spec, a single `it` reads top-to-bottom as one self-contained story — setup, action, assertions — without requiring the reader to mentally compose state from ancestor `before`s, sibling `let`s, or cross-example shared objects. This is what "each `it` independently scannable" means throughout the rules below.

"Reliable" means the test passes or fails for the right reason, deterministically, across `--order random` runs — no shared-state leaks, no stale in-memory caches, no unverified stubs masking missed branches.

Every rule below serves one or more of these. When a rule's application is ambiguous in an edge case, decide by which interpretation better serves this goal.

## What a request test is

**Central principle:** *Exercise the behavior of a single system — and only that system — through its public interface.* For request tests, the single system is Canvas, and the public interface is HTTP.

A request test sits at the **value–cost sweet spot** between unit tests and end-to-end tests. The cost per test is low enough to exercise many behavioral variations — different roles, input combinations, edge paths — while still hitting the real controller, model, serializer, and auth stack. That is coverage unit tests alone don't prove (they can all pass while the integration is broken) and coverage end-to-end tests can't afford in bulk.

Key distinctions:

- **System under test = Canvas, and Canvas only.** Other HTTP-served applications (canvas-rcs, Notification Service, pandapub, live events, inst-fs, SIS providers, third-party LTI tools) are *collaborators* whose responses are stubbed at the boundary. This is what separates a request test from an end-to-end test: the end-to-end test exercises the integration; the request test exercises Canvas's behavior given a fixed collaborator contract.
- **Infrastructure ≠ collaborator.** The database, local filesystem, cache, and *locally-faked* storage (fake S3, local file storage) are part of Canvas's runtime — they are real and the test uses them directly. Don't mock them. *Network-served* storage and adjacent services are collaborators — stub their HTTP traffic with WebMock and verify with `have_requested`. The dividing line is "does the production code make an HTTP call to reach it?", not "is it called 'storage'".
- **Tests describe use cases, not code.** The `it` description should map to something a user or integrator would recognize ("a teacher publishes a course"), not name a Ruby method or controller action. Refactoring Canvas's internals must not require rewriting the description — only the assertions, and only if the contract changed.
- **Public-interface tests pair with contract tests at the boundary.** Request tests do not produce contract tests; they assume the contract with each collaborator is verified elsewhere. Stubs must match the *current* contract, not a simplified fiction.

**Litmus test for any single rule or test edit:** *Can Canvas's internals be refactored without changing the test?* If yes, the test verifies behavior and provides real confidence. If no, the test is coupled to implementation and will break on refactors that preserve correct behavior — that's an implementation test wearing request-test clothes, and the rules below exist to keep it from happening.

## The test contract

What a request test is and is not allowed to do:

| Capability | Allowed? |
| --- | --- |
| Mocks, fakes, stubs | Allowed (boundary only — WebMock, Timecop, fs, env, randomness; never Canvas internals — see **no-internal-mocks**) |
| Network access | Localhost only (the Canvas app under test). All non-localhost calls must be stubbed with WebMock (see **verify-stubs**). The suite-wide WebMock posture is set centrally in `spec/spec_helper.rb`; tests do not flip it per-example. |
| Database | Yes (real DB; no ActiveRecord mocking) |
| File system access | Yes (uploads, attachments, fixtures, tempfiles all OK) |
| More than one service | No (the test exercises Canvas only — never also hits a sibling HTTP service like inst-fs, canvas-rcs, or pandapub; outbound calls to such services must be stubbed) |

This contract is the source of truth. If a rule below conflicts with it, the contract wins.

## How the grader uses these rules

The grader checks each rule binary (`pass` / `fail` / `na`) and the test's grade is `pass` (zero `fail` verdicts) or `fail` (one or more `fail` verdicts). There is no severity gradient, no letter grade, no curve — just the list of failing rules with their fixes. Rules whose trigger condition is absent from the test are `na` (see **Trigger conditions and N/A** below); `na` does not count as a failure.

The rules below are the residual that RuboCop and similar static linters cannot enforce — they require reading the test's intent, the route, and the controller context together. The grader is the complement to RuboCop, not a replacement: RuboCop-enforceable concerns belong in `.rubocop.yml`, not here.

## Composition rules

Each rule below states **what** to do, then *why*. The "why" matters for judgment calls in edge cases — don't follow the rule blindly; understand the failure mode it prevents. Rules are referenced by slug throughout this document and by the grader's report.

### no-internal-mocks

**No mocks of Canvas's own code.** No `allow(SomeService).to receive(...)`, no `expect(SomeClass).to have_received(...)` against Canvas internals. The only allowed mocks are boundary mocks: WebMock (outbound HTTP), Timecop (time), filesystem stubs, ENV stubs, randomness stubs.

*Why:* Mocking internals couples the test to *how* Canvas implements behavior, not *what* it does. An internal refactor then breaks tests that never observed a behavior change. Worse, a mock that returns a "happy" value can silently mask a real bug — the test verifies the mock, not Canvas. The test contract requires Canvas itself to run; mocking its code violates that.

### verify-stubs

**WebMock stubs are verified.** Every `stub_request` must be paired with `expect(WebMock).to have_requested(...).with(...)`.

*Why:* A stub that never fires is a silent test gap — the production code may have skipped the call entirely (wrong branch, early return, feature-flag off) and the test still passes. Verifying the stub was hit proves the path under test actually ran.

### shape-and-value

**Body assertions check shape AND value.** `expect(response.parsed_body["id"]).to eq(course.id)`, never just `have_key("id")`.

*Why:* Shape-only assertions pass when the response is wrong but well-formed (e.g. the endpoint returned the wrong record with the right keys, or an empty array where data was expected). Value assertions catch correctness regressions; shape catches structural regressions; both matter.

### reload-assertions

**DB-state assertions always `.reload`.** `expect(course.reload.workflow_state).to eq("available")`.

*Why:* ActiveRecord caches attributes on the in-memory object. Without `.reload` you may assert against the *pre-request* state — passing when the DB actually changed (false positive) or failing when the request correctly persisted a different value (false negative). `.reload` guarantees you're checking what was actually saved.

### literal-path

**The path argument to the HTTP call is a string literal, not a Rails route helper or `process`.**

This rule grades exactly one thing: the *expression form* of the path argument at the call site. Fail the rule only when one of these two forms appears:

- **Route helper call** as the path argument: `*_path(...)` or `*_url(...)` (e.g. `api_v1_course_url(course)`, `course_assignments_path(course)`).
- **`process(action, ...)`** in place of a verb + path call.

A string literal (with or without `#{...}` interpolation) passes. Any other expression form — a local variable, a method call returning a string, an instance variable — is **out of scope for this rule**. Where a non-literal variable is declared (in the `it`, in a `let`, in a `before`) is not graded here.

*Why:* The path the user actually hits is part of the contract under test. A renamed route silently still passes when the test calls it via a Rails route helper — and the test no longer documents the URL. Literal paths also make grep-by-route trivial during route audits and incident triage. The two failure forms above are the ones that destroy that property; nothing else does.

*Canvas `api_call` helper:* `api_call(:verb, path, params, body, headers, opts)` is graded the same way — the `path` argument (second positional) is the target. A literal string passes; a route helper there fails.

### no-before-once

**No `before(:once)` blocks.** Use `before(:each)` instead. `before(:all)` and `before(:context)` are also banned but are caught by RuboCop's `RSpec/BeforeAfterAll`; this grader rule covers the Canvas-specific `:once` alias that RuboCop doesn't catch.

*Why:* `before(:once)` (Canvas's test-prof `before_all` alias) wraps the block in a savepoint, so DB rows roll back per example — but the **same Ruby objects** are reused across every example in the group. Any in-example mutation of an `@ivar` that isn't immediately persisted-and-reloaded leaves the next example reading a stale value. The hazard extends to WebMock stub state (not transaction-scoped) and ActiveRecord association caches (not cleared by `.reload`). The result is `--order random` flake where the symptom (stale value) and the cause (shared in-memory graph across a transaction boundary that *looks* like it isolates state) are separated, so the fix that comes to mind (`.reload`) treats the symptom while leaving the mechanism in place. `before(:each)` is safe because it re-executes per example, producing a fresh object each time.

*Evidence honesty:* This rule is a prophylactic against a real-but-unobserved-on-record mechanism, justified by exposure (~52 controller spec files use `before(:once)` with no current protections) and the high debugging cost when it does hit (symptom and cause are separated by a transaction boundary that *looks* like it isolates state). Absence of logged flakes is weak evidence of absence: the failure mode shows up as `--order random` intermittency that often gets retried-green and never filed.

*Trigger:* The test or its enclosing group contains a `before(:once)` block. If not, mark `na`.

### stub-outbound

**Every outbound HTTP call the production code makes must be stubbed with WebMock** and verified with `have_requested` (per **verify-stubs**). The suite-wide WebMock posture (whether unstubbed non-localhost calls raise or pass through) is configured centrally in `spec/spec_helper.rb`; do not flip it from inside the `it` block.

*Why:* Real outbound calls make the test slow, flaky, and dependent on services outside the system under test — directly violating the test contract's "single service" guarantee. They can also reach real environments. Stubs at the boundary keep the test deterministic while still proving Canvas's contract with each collaborator. Flipping the global net-connect flag inside one `it` leaks the change to every subsequent example in the process — that's a suite-wide setting, not a per-test one.

### no-magic-values

**No magic values.** Every value an assertion checks must appear explicitly in setup. If the test asserts `name == "Algebra 101"`, the course was created with `name: "Algebra 101"` — never relying on a helper's default.

*Why:* When an assertion's expected value silently comes from a factory default, the reader can't tell whether the assertion is meaningful (verifying a real behavior) or vacuous (verifying that the default echoes itself). Explicit setup makes the cause-effect link auditable and survives helper-default changes.

### precise-matchers

**Assertions must produce informative failure messages.** Pick the most precise matcher and target available so a failure shows exactly what differed — never just "true/false" or a wall of HTML. Prefer `eq` on a specific field over `include` on a whole body. Prefer `have_http_status(:ok)` over `response.successful?`. Prefer `expect(course.reload.workflow_state).to eq("available")` over `expect(course.reload).to be_available`.

*Why:* A reader of the rspec failure output should be able to identify the bug without re-running the test or reading the test code. Generic matchers like `be_truthy` or whole-body `include` produce failure messages that hide the difference between expected and actual; precise matchers surface it.

*Independence from `shape-and-value`:* These two rules cover distinct concerns — assertion *completeness* (does it check the value?) and assertion *precision* (does the matcher produce an informative failure message?) — and fire independently. A shape-only body matcher like `have_key("id")` violates both: `shape-and-value fail` for skipping the value check, `precise-matchers fail` for the uninformative true/false failure message. A single fix (e.g. switching to `expect(body["id"]).to eq(course.id)`) typically resolves both.

### eql-for-numerics

**Use `eql` for numeric assertions where Integer-vs-Float matters; `eq` everywhere else; `be` only for `true` / `false` / `nil` / object-identity.** `eq` uses `==`, which treats `5` and `5.0` as equal — fine for strings, IDs, arrays, hashes, and custom objects. For numeric fields whose type is part of the response contract (scores, points_possible, percentages), use `eql` — it uses `.eql?` and refuses to call `5` and `5.0` equal. Example: `expect(response.parsed_body["points_possible"]).to eql(10)` catches a serializer regression that flips the value to `10.0`; `eq(10)` would silently pass.

*Why:* Request specs are the layer that pins the serialized contract, including its types. Integer↔Float drift is a silent-regression class: invisible under `eq`, visible under `eql`. A grade-calculation change that flips integer points to floats (or vice versa) can cascade through downstream consumers — gradebooks, exports, analytics — without breaking any test that uses `eq`. `be` checks object identity and is not a substitute for value equality.

**Linter conflict.** If a cop (e.g., `RSpec/BeEql`) autocorrects `eql(...)` to `be(...)`, do not accept the autocorrect on these assertions — override with a single-line disable: `expect(body["score"]).to eql(8.0) # rubocop:disable RSpec/BeEql`. The comparison rule wins; the linter is silenced narrowly where it conflicts.

### auth-matches-initiator

**The auth pattern matches the request initiator.** Same Canvas endpoint (e.g. `/api/v1/conversations/unread_count`) is exercised by both the Canvas web UI (cookie/session) and external API clients (Bearer token), so route prefix alone is not enough.

| Initiator | Auth pattern |
| --- | --- |
| `human-via-canvas-ui` | `user_session(user)`. Default for any actor described as a Canvas UI user, including UI-driven `/api/v1/` calls. |
| `external-api-client-bearer` | Bearer access token in the `Authorization` header. |
| `sibling-service-as-client(<service>)` | Whatever auth the precedent spec uses (LTI Advantage JWT, inst-fs HMAC, etc.). Mirror the precedent; do not re-derive. |
| `anonymous` | No session setup. HTML routes redirect (302) to `login_url`; `/api/v1/...` routes return `:unauthorized` (401). Picking the wrong half is a common silent-pass. |

*Why:* The same route can have entirely different auth semantics depending on who's calling. A teacher in the UI hitting `/api/v1/courses` uses session cookies; a script with a Bearer token hitting the same path is auth'd differently and may exercise different controller paths (e.g., masquerading-as-user logic). Picking the wrong pattern produces tests that either silently pass against the wrong code path or fail for reasons unrelated to the behavior under test.

## Trigger conditions and N/A

Many rules have a *trigger condition* — circumstances under which the rule has something concrete to check. When a rule's trigger is absent from the test, mark it `na` rather than `pass`. The distinction matters: `pass` means "the rule applied and the test passed it"; `na` means "the rule never had a chance to fire here." Both are valid outcomes but carry different signal — a `pass` on `reload-assertions` reflects a real check on a real DB assertion, while `na` means the test simply didn't touch DB state.

`na` does not count as a failure. The test's pass/fail verdict is computed only from `fail`-verdict counts.

Rules with trigger conditions:

| Rule | Trigger condition | `na` when |
|------|-------------------|------------|
| `verify-stubs` | Test contains `stub_request(...)` calls | Test has zero WebMock stubs |
| `reload-assertions` | Test asserts on DB state after the request | Test makes no DB-state assertions |
| `stub-outbound` | Controller action makes outbound HTTP calls | Controller (and its directly-called helpers) make no outbound HTTP |
| `eql-for-numerics` | Test makes numeric assertions on response or DB values | Test makes no numeric assertions |
| `no-before-once` | Test or its enclosing group contains a `before(:once)` block | No `before(:once)` declarations present |

All other rules (`no-internal-mocks`, `shape-and-value`, `literal-path`, `no-magic-values`, `precise-matchers`, `auth-matches-initiator`) apply to every test and never receive `na`.

## Canvas-specific defaults (guidance, not graded)

These inform write-time judgment but the grader does not produce report violations for them. They live here so the writer has them in working context at write time.

- **Factories — Canvas helpers first.** Prefer Canvas helpers (`course_with_teacher`, `student_in_course`, `account_admin_user`, `course_with_student`). Drop to `Model.create!(...)` only when no helper fits.

  *Why:* Canvas helpers wire up the full related-record graph (course + account + enrollment + role + workflow_state transitions) that Canvas's endpoints, policies, and serializers expect. Bare `Model.create!` produces records in default/created states with no related records — so endpoints that filter to published courses, look up enrollments, or check role memberships return empty/404, looking like product bugs but really setup bugs.

- **Factory chaining — pass the link explicitly and verify the helper accepts it.** When a second factory helper should attach to a record produced by the first (e.g., adding a student to the *same* course the teacher was enrolled in), pass the linking record explicitly as a keyword: `course_with_student(course: teacher_enrollment.course, active_all: true)`. Then quickly verify the helper actually consumes the keyword.

  *Why:* Several Canvas factory helpers set `@course` / `@user` / `@enrollment` as instance variables and *also* read them as fallbacks when an opts hash is missing the key. A helper that silently ignores an unknown keyword will create a *second* course, leaving the test with two unrelated courses — the URL in the request references one while the student is on another. Symptom looks like a permissions or product bug; real bug is in setup.

- **Sharding — only when the scenario mentions cross-shard behavior.** Add `specs_require_sharding` only then.

  *Why:* The sharding helper spins up multiple databases and runs the test against each — substantially slower. Enabling it when no shard behavior is under test wastes CI minutes for no signal.

- **Account — `Account.default` unless isolation is required.** Use `Account.default`; switch to `Account.create!(name: "...")` only when the test mutates account-level settings (sub-accounts, account-scoped feature flags, root-account configs).

  *Why:* Most Canvas helpers hardcode `Account.default`. Creating a fresh account is slower and silently breaks helpers that don't accept an account override. Only pay the cost when the test genuinely needs account-level isolation.

- **CSRF protection — off by default in the test env; don't fight it.** `config/environments/test.rb` sets `config.action_controller.allow_forgery_protection = false`. Don't add CSRF tokens, `X-CSRF-Token` headers, or `enable_forgery_protection` to a normal request spec.

  *Why:* The env default is correct for nearly every request spec. Manually re-enabling forgery protection adds ceremony that fails open (the test passes but proves nothing about CSRF). Only reach for `enable_forgery_protection` when the scenario is specifically "this endpoint must reject a request without a CSRF token."

- **HTTP body — default to a plain `params:` hash; set JSON headers only when needed.** Most Canvas controllers accept `params: { ... }` regardless of content type — that's the prevailing Canvas request-spec idiom. Use `headers: { "CONTENT_TYPE" => "application/json", "ACCEPT" => "application/json" }` with `params: payload.to_json` only when the controller meaningfully distinguishes JSON-body from form-encoded (e.g., it reads `request.raw_post` / `JSON.parse(request.body.read)` directly) or when the endpoint content-negotiates such that HTML would redirect.

  *Why:* Defaulting to the plain-hash form keeps tests indistinguishable from the surrounding Canvas suite. The JSON-headers form is correct but heavier, and reserving it for endpoints that actually require it concentrates the ceremony where it matters.

- **File size — soft cap at 500 lines per spec file.** When a request-spec file at the writer's chosen target path is already at or above 500 lines, surface a warning before adding the next `it` and recommend splitting. Suggested split axes, in preference order: by sub-resource (e.g., peel `_enrollments_spec.rb` off `_courses_spec.rb`), by HTTP verb (`_courses_index_spec.rb` vs. `_courses_update_spec.rb`), or by initiator (UI vs. API-client specs as sibling files). The cap is a soft signal, not a refusal — adding the 28th `it` is allowed when the user accepts the warning.

  *Why:* request-spec files grow naturally as scenarios accumulate. Past ~500 lines a file becomes hard to scan during review, expensive to load into context when grading or refactoring, and a magnet for cross-`it` coupling pressure — and even though `Specs/NoNestedSetup` blocks the nested-`let`/`before` shortcut, the temptation to refactor toward shared helpers grows with file size. Splitting at sub-resource / verb / initiator seams keeps each file purpose-coherent and each `it` independently scannable.

## Common anti-patterns

Patterns the grader catches via existing rules. This table is for users coming from other testing cultures who want to map their vocabulary onto this skill's rules. The grader does not emit failures against these names directly — it emits failures against the rule slug.

| Anti-pattern | Why it's bad | Rule that catches it |
|--------------|--------------|----------------------|
| Testing implementation details (mocking internals to assert calls) | Couples the test to *how* Canvas does the work, not *what* it returns. Breaks on internal refactors. | `no-internal-mocks` |
| Over-mocking | Tests don't validate real behavior; collaborator stubs proliferate until you're testing the stubs. | `no-internal-mocks` + `verify-stubs` |
| Brittle whole-body assertions | Asserting the entire response or DB state matches a literal blob; breaks on any unrelated field change. | `shape-and-value` (asserts on specific fields and values, not whole blobs) |
| Testing private/internal state | Reaching into Canvas's instance variables, ivars, or unexported helpers to verify behavior. | `no-internal-mocks` (covers the broader principle) |
| Asserting on the count of internal method calls | An implementation detail — the same outcome can be produced with one call or three. | `no-internal-mocks` |
| Vacuous assertions echoing factory defaults | The test asserts `name == "Course 1"` because a factory default created `"Course 1"`; the assertion proves nothing about Canvas. | `no-magic-values` |
| Stale DB reads (forgot `.reload`) | Asserts against the in-memory ActiveRecord cache, not what was persisted. | `reload-assertions` |
| Unverified stubs (defined but never hit) | The production code took a different branch; the stub never fired; the test silently passes. | `verify-stubs` |
| `eq` on numeric serializer fields | `5` and `5.0` are equal under `eq`; an Integer-to-Float regression is silent. | `eql-for-numerics` |
| Nested setup composition (`before`/`let`/`subject` declared at depth ≥ 2 in `describe`/`context` nests) | Reader has to mentally compose hooks outside-in across ancestors; composition errors don't point at any single hook. | RuboCop `Specs/NoNestedSetup` (enabled in `spec/requests/`; see `gems/rubocop-canvas/lib/rubocop_canvas/cops/specs/no_nested_setup.rb`) |
| `before(:all)` / `before(:context)` at any depth | Reuses Ruby object identity *and* DB rows across examples; mutation leaks combine with stale stubs and association caches to produce `--order random` flake. | RuboCop `RSpec/BeforeAfterAll` (enabled globally) |
| `before(:once)` (test-prof alias) at any depth | Same in-memory object reuse as `before(:all)`; DB rows roll back per example but Ruby objects don't. | `no-before-once` (grader rule; no RuboCop equivalent because `Specs/NoBeforeOnceStubs` only flags stub calls *inside* `before(:once)` blocks) |
