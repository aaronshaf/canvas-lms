# Request Test Rules

This file is the canonical source of truth for the rules that define a well-formed Canvas request test, the reasoning behind each rule, and the rubric the grader uses to compute a letter grade.

It is `@include`d by:

- `request-test-writer` SKILL.md — to inform write-time decisions.
- `request-test-grader` agent — to enforce rules at grade time.
- `request-test-grader` SKILL.md — to show users what the grader checks.

No other file restates these rules. Edits here are authoritative.

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

## Composition rules

Each rule below states **what** to do, then *why*. The "why" matters for judgment calls in edge cases — don't follow the rule blindly; understand the failure mode it prevents. Rules are referenced by slug throughout this document and by the grader's report.

Each rule has a **severity** indicating its impact when violated:

- **blocker** — silent-pass risk. The test could be lying: passing while not actually verifying the behavior it claims.
- **major** — correctness or attribution risk. The test is reliable but fragile, brittle, or ambiguous.
- **minor** — style or readability. The test works correctly but is harder to read, fail-diagnose, or maintain.

### one-it (major)

**Exactly one `it`** per scenario. The Given/When/Then collapses into a single example. Nest inside an appropriate `describe` block: when creating a new spec file, use `describe "<VERB> <path>"`; when appending to an existing file, follow that file's existing convention (Canvas request specs commonly use `describe "<Resource Name>"` + nested `describe "<action>"`). Don't fight the file's style.

*Why:* One scenario → one test gives clean failure attribution. When the test breaks, the broken behavior is unambiguous. Splitting into multiple `it`s fragments the signal and creates pressure to share setup — which **no-shared-setup** forbids. Matching the surrounding file's `describe` convention keeps grep, suite listings, and code review unsurprising; deviating only at the seam where this skill's test lands is more cost than signal.

### aaa-headers (minor)

**Arrange-Act-Assert layout, labeled with `# Arrange` / `# Act` / `# Assert` comments.** Each phase is introduced by its own header comment on its own line, immediately above the first line of that phase. Use exactly these three labels — no variants (`# Setup`, `# Given`, `# Verify`). Separate phases from each other with a blank line; within Arrange, you may also use blank lines to group related setup steps.

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

### no-internal-mocks (blocker)

**No mocks of Canvas's own code.** No `allow(SomeService).to receive(...)`, no `expect(SomeClass).to have_received(...)` against Canvas internals. The only allowed mocks are boundary mocks: WebMock (outbound HTTP), Timecop (time), filesystem stubs, ENV stubs, randomness stubs.

*Why:* Mocking internals couples the test to *how* Canvas implements behavior, not *what* it does. An internal refactor then breaks tests that never observed a behavior change. The test contract requires Canvas itself to run; mocking its code violates that.

### verify-stubs (blocker)

**WebMock stubs are verified.** Every `stub_request` must be paired with `expect(WebMock).to have_requested(...).with(...)`.

*Why:* A stub that never fires is a silent test gap — the production code may have skipped the call entirely (wrong branch, early return, feature-flag off) and the test still passes. Verifying the stub was hit proves the path under test actually ran.

### shape-and-value (blocker)

**Body assertions check shape AND value.** `expect(response.parsed_body["id"]).to eq(course.id)`, never just `have_key("id")`.

*Why:* Shape-only assertions pass when the response is wrong but well-formed (e.g. the endpoint returned the wrong record with the right keys, or an empty array where data was expected). Value assertions catch correctness regressions; shape catches structural regressions; both matter.

### reload-assertions (blocker)

**DB-state assertions always `.reload`.** `expect(course.reload.workflow_state).to eq("available")`.

*Why:* ActiveRecord caches attributes on the in-memory object. Without `.reload` you may assert against the *pre-request* state — passing when the DB actually changed (false positive) or failing when the request correctly persisted a different value (false negative). `.reload` guarantees you're checking what was actually saved.

### no-shared-setup (major)

**No `let`, no `subject`, no `@instance_vars`, no `before` blocks.** All setup is local to the `it` block.

*Why:* A reader investigating a failure should read one `it` block top-to-bottom and see every value the assertions depend on, in source order, with no scrolling and no lazy-evaluation surprises. `let` is lazily evaluated, which makes execution order non-obvious. `before` blocks introduce hidden mutation order — when multiple `before` blocks compose (top-level, nested `context`, shared examples), the order they fire and the state they leave on `@vars` is hard to reason about. Request specs, where each `it` exercises a distinct URL + actor + payload combination, do not benefit from the cross-test DRY that `let`/`subject`/`before` provides.

### no-runtime-branching (major)

**No conditional logic whose branch can vary between runs. Loops only in Arrange, only for creating N similar records.** Banned: `if`/`unless`/`case` whose path depends on time, randomness, or external state. Allowed: deterministic filtering — `Array#detect`/`#find`/`#select` to pick a specific record out of a fixed collection (the response order is the only path).

*Why:* Non-deterministic branching makes failure reproduction become "which branch did I hit?". Loops in assertions hide which iteration broke. Loops in Arrange (creating N similar records) are tolerated because each iteration is identical and the failure points to data setup, not assertion logic. Deterministic filtering is the legitimate way to address one element inside a list response — banning it would force fragile index-based assertions instead.

### literal-path (major)

**Explicit verb + literal path + params/headers.** `get "/api/v1/courses/#{course.id}", params: {...}, headers: {...}`. No route helpers, no `process`.

*Why:* The path the user actually hits is part of the contract under test. Hiding it behind `api_v1_course_url(course)` means a renamed route silently still passes — and the test no longer documents the URL. Literal paths also make grep-by-route trivial during route audits and incident triage.

### symbol-statuses (minor)

**Status assertions use Rails symbols.** `have_http_status(:ok)`, `:forbidden`, `:not_found`. Integer literal only when no symbol exists for that status code.

*Why:* Symbols encode intent — `:forbidden` reads as "403 was the right answer", while `403` requires the reader to translate. In code review, `:ok` vs. `:created` is unmistakable; `200` vs. `201` is a one-character diff easy to miss. Typo'd symbols (`:okk`) raise loudly; typo'd integers (`405` instead of `404`) silently change the assertion.

### no-before-all (blocker)

**No `before(:all)` / `before(:context)`.**

*Why:* `before(:all)` runs once per group and persists records *outside* the per-example transaction wrapper, so they leak across examples. If any example mutates them, downstream examples see undefined state — producing order-dependent failures that are notoriously hard to reproduce. **no-shared-setup** already forbids all `before` blocks; this rule pins the worst variant specifically because the failure mode (cross-test leakage) is categorically different from "hidden setup."

### one-request (blocker)

**Exactly one HTTP call to Canvas per test.** Setup happens via direct model creation and Canvas helpers, not via API calls.

*Why:* A test with two requests has ambiguous failure attribution — when the second fails, was it the bug under test, or did the first request leave state the second didn't expect? One call = one behavior under test. API-driven setup also slows the test and implicitly tests endpoints that aren't the focus.

### stub-outbound (blocker)

**Every outbound HTTP call the production code makes must be stubbed with WebMock** and verified with `have_requested` (per **verify-stubs**). The suite-wide WebMock posture (whether unstubbed non-localhost calls raise or pass through) is configured centrally in `spec/spec_helper.rb`; do not flip it from inside the `it` block.

*Why:* Real outbound calls make the test slow, flaky, and dependent on services outside the system under test — directly violating the test contract's "single service" guarantee. Stubs at the boundary keep the test deterministic while still proving Canvas's contract with each collaborator. Flipping the global net-connect flag inside one `it` leaks the change to every subsequent example in the process — that's a suite-wide setting, not a per-test one.

### plain-english-it (minor)

**`it` description = plain-English Then.** No "should", no method names, no `#method_name` syntax. Describe observable behavior.

*Why:* The description is what shows up in failure output and the suite's printed listing — a reader scanning failures should see the *user-visible behavior* that broke, not a Ruby symbol or implementation hint. Decoupling descriptions from method names also means internal refactors don't churn test names.

### no-magic-values (blocker)

**No magic values.** Every value an assertion checks must appear explicitly in setup. If the test asserts `name == "Algebra 101"`, the course was created with `name: "Algebra 101"` — never relying on a helper's default.

*Why:* When an assertion's expected value silently comes from a factory default, the reader can't tell whether the assertion is meaningful (verifying a real behavior) or vacuous (verifying that the default echoes itself). Explicit setup makes the cause-effect link auditable and survives helper-default changes.

### precise-matchers (minor)

**Assertions must produce informative failure messages.** Pick the most precise matcher and target available so a failure shows exactly what differed — never just "true/false" or a wall of HTML. Prefer `eq` on a specific field over `include` on a whole body. Prefer `have_http_status(:ok)` over `response.successful?`. Prefer `expect(course.reload.workflow_state).to eq("available")` over `expect(course.reload).to be_available`.

*Why:* A reader of the rspec failure output should be able to identify the bug without re-running the test or reading the test code. Generic matchers like `be_truthy` or `include` produce failure messages that hide the difference between expected and actual; precise matchers surface it.

### eql-for-numerics (blocker)

**Use `eql` for numeric assertions where Integer-vs-Float matters; `eq` everywhere else; `be` only for `true` / `false` / `nil` / object-identity.** `eq` uses `==`, which treats `5` and `5.0` as equal — fine for strings, IDs, arrays, hashes, and custom objects. For numeric fields whose type is part of the response contract (scores, points_possible, percentages), use `eql` — it uses `.eql?` and refuses to call `5` and `5.0` equal. Example: `expect(response.parsed_body["points_possible"]).to eql(10)` catches a serializer regression that flips the value to `10.0`; `eq(10)` would silently pass.

*Why:* Request specs are the layer that pins the serialized contract, including its types. Integer↔Float drift is a silent-regression class: invisible under `eq`, visible under `eql`. A grade-calculation change that flips integer points to floats (or vice versa) can cascade through downstream consumers — gradebooks, exports, analytics — without breaking any test that uses `eq`. `be` checks object identity and is not a substitute for value equality.

**Linter conflict.** If a cop (e.g., `RSpec/BeEql`) autocorrects `eql(...)` to `be(...)`, do not accept the autocorrect on these assertions — override with a single-line disable: `expect(body["score"]).to eql(8.0) # rubocop:disable RSpec/BeEql`. The comparison rule wins; the linter is silenced narrowly where it conflicts.

### feature-flag-setup (major)

**When the controller action reads a feature flag, the test sets the flag explicitly, *before* `user_session`, at the correct context, even if the dev default already matches.** Grep the action for `feature_enabled?` to find which flags it reads.

Pick the enable site by the flag's `applies_to` (check `config/feature_flags/*.yml`):

- `SiteAdmin` → `Account.site_admin.enable_feature!(:flag_name)`
- `RootAccount` → `Account.default.enable_feature!(:flag_name)` (or `course.root_account.enable_feature!` if the test created its own root)
- `Course` → `course.enable_feature!(:flag_name)`

**Hidden-flag gotcha:** flags declared `state: hidden` in their YAML are invisible at lower contexts until enabled at SiteAdmin first. Grep the flag's YAML entry for `state: hidden` and, if present, also call `Account.site_admin.enable_feature!(:flag_name)` *before* the root/course enable — otherwise the lower call silently no-ops and the controller takes the flag-off branch.

*Why:* Feature-flag defaults flip over time. A test that relied on the implicit default silently changes meaning the day the default flips, with no test edit. Explicit setting locks the test to the behavior it verifies. Pinning the right context prevents the "enabled on default account but the flag is SiteAdmin" silent miss. `RequestCache` and `Rails.cache` memoize `feature_enabled?` lookups within a request, so flipping a flag after the first lookup (e.g., after `user_session` has triggered any feature check) leaves the controller acting on stale state.

### auth-matches-initiator (major)

**The auth pattern matches the request initiator.** Same Canvas endpoint (e.g. `/api/v1/conversations/unread_count`) is exercised by both the Canvas web UI (cookie/session) and external API clients (Bearer token), so route prefix alone is not enough.

| Initiator | Auth pattern |
| --- | --- |
| `human-via-canvas-ui` | `user_session(user)`. Default for any actor described as a Canvas UI user, including UI-driven `/api/v1/` calls. |
| `external-api-client-bearer` | Bearer access token in the `Authorization` header. |
| `sibling-service-as-client(<service>)` | Whatever auth the precedent spec uses (LTI Advantage JWT, inst-fs HMAC, etc.). Mirror the precedent; do not re-derive. |
| `anonymous` | No session setup. HTML routes redirect (302) to `login_url`; `/api/v1/...` routes return `:unauthorized` (401). Picking the wrong half is a common silent-pass. |

*Why:* The same route can have entirely different auth semantics depending on who's calling. A teacher in the UI hitting `/api/v1/courses` uses session cookies; a script with a Bearer token hitting the same path is auth'd differently and may exercise different controller paths (e.g., masquerading-as-user logic). Picking the wrong pattern produces tests that either silently pass against the wrong code path or fail for reasons unrelated to the behavior under test.

### precedent-matched (major) — when applicable

**For `sibling-service-as-client(<service>)` scenarios, the request body, headers, and auth must match a precedent spec — nothing synthesized from the controller alone. For outbound stubs, the `with(...)` matcher and response shape must be mirrored from an existing spec for the same collaborator endpoint — never invented.**

This rule applies *only* when:

- the request initiator is a sibling service, *or*
- the controller makes an outbound HTTP call that the test must stub.

When neither condition holds, this rule is N/A (not graded).

*Why:* The controller accepts a permissive superset of what the collaborator actually sends. A synthesized request only proves Canvas handles *some* shape — not the one the collaborator actually sends. The same logic applies to outbound stubs: an invented response body proves Canvas handles *some* response, not the one the collaborator actually returns. Mirroring from a precedent spec is how this skill ensures the contract under test matches reality.

## Canvas-specific gradable rules

These are Canvas-idiom-specific patterns with a mechanical right/wrong, so the grader checks them. They share the severity scheme above.

### use-parsed-body (minor)

**JSON response parsing uses `response.parsed_body`, never `JSON.parse(response.body)`.**

*Why:* `parsed_body` is the Rails 7+ idiom, respects Content-Type, and produces clearer failure messages when the response isn't actually JSON (e.g., HTML error page). Mixing both forms in a suite makes failure-mode diagnosis inconsistent.

### use-timecop (minor)

**Time manipulation uses `Timecop.freeze(time) { ... }` or `Timecop.travel`, never Rails `travel_to` / `travel`.**

*Why:* Canvas's existing suite is Timecop-based. Mixing in `travel_to` splits time control across two mechanisms with subtly different semantics (`travel_to` doesn't stack the way Timecop does), making time-bug debugging harder. Consistency over micro-preference.

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

- **File size — soft cap at 500 lines per spec file.** When a request-spec file at the writer's chosen target path is already at or above 500 lines, surface a warning before adding the next `it` and recommend splitting. Suggested split axes, in preference order: by sub-resource (e.g., peel `_enrollments_spec.rb` off `_courses_spec.rb`), by HTTP verb (`_courses_index_spec.rb` vs. `_courses_update_spec.rb`), or by initiator (UI vs. API-client specs as sibling files). The cap is a soft signal, not a refusal — adding the 28th `it` is allowed when the user accepts the warning. The "encourage breadth" stance the writer holds still applies; this cap addresses *file scannability and context cost*, not test count.

  *Why:* request-spec files grow naturally as scenarios accumulate. Past ~500 lines a file becomes hard to scan during review, expensive to load into context when grading or refactoring, and a magnet for cross-`it` coupling pressure — even though **no-shared-setup** forbids the `let`/`before` shortcuts that pressure would normally take, the temptation to refactor toward shared helpers grows with file size. Splitting at sub-resource / verb / initiator seams keeps each file purpose-coherent and each `it` independently scannable.

## Severity classification (summary)

**Blocker** (silent-pass risks — the test could be lying):

- `no-internal-mocks`
- `verify-stubs`
- `shape-and-value`
- `reload-assertions`
- `no-before-all`
- `one-request`
- `stub-outbound`
- `no-magic-values`
- `eql-for-numerics`

**Major** (correctness or attribution risk):

- `one-it`
- `no-shared-setup`
- `no-runtime-branching`
- `literal-path`
- `feature-flag-setup`
- `auth-matches-initiator`
- `precedent-matched` (when applicable)

**Minor** (style / readability):

- `aaa-headers`
- `symbol-statuses`
- `plain-english-it`
- `precise-matchers`
- `use-parsed-body`
- `use-timecop`

## Letter grade rubric

The grader computes one letter grade per `it` it grades. The grade is determined by the **worst-fitting condition** that applies — i.e., evaluate top to bottom and stop at the first match.

| Grade | Condition |
|---|---|
| **A** | Zero ✗ across all applicable rules. |
| **A-** | 1–2 minor ✗, no major or blocker ✗. |
| **B** | 1 major ✗ and no blockers, OR 3+ minor ✗ and no blockers/majors. |
| **C** | 2–3 major ✗ and no blockers, OR exactly 1 blocker ✗. |
| **D** | Exactly 2 blocker ✗. |
| **F** | 3+ blocker ✗, OR 5+ major ✗. |

**N/A handling.** Many rules have a *trigger condition* — circumstances under which the rule has something concrete to check. When a rule's trigger is absent from the test, mark it `N/A` rather than `✓`. The distinction matters: `✓` means "the rule applied and the test passed it"; `N/A` means "the rule never had a chance to fire here." Both are valid outcomes but carry different signal — a `✓` on `reload-assertions` reflects a real check on a real DB assertion, while `N/A` means the test simply didn't touch DB state. An eval harness reading the trailer's `na=` field can also assert which rules were *expected* to be out of scope for a fixture.

Rules with trigger conditions, and when each is `N/A`:

| Rule | Trigger condition | `N/A` when |
|------|-------------------|------------|
| `verify-stubs` | Test contains `stub_request(...)` calls | Test has zero WebMock stubs |
| `reload-assertions` | Test asserts on DB state after the request | Test makes no DB-state assertions |
| `stub-outbound` | Controller action makes outbound HTTP calls | Controller (and its directly-called helpers) make no outbound HTTP |
| `eql-for-numerics` | Test makes numeric assertions on response or DB values | Test makes no numeric assertions |
| `feature-flag-setup` | Controller action reads a feature flag whose default affects the branch under test | Controller does not read a relevant feature flag in the path the test exercises |
| `use-timecop` | Test manipulates time (`Timecop.freeze` / `Timecop.travel`) | Test does not manipulate time |
| `precedent-matched` | Initiator is a sibling service, or controller makes an outbound HTTP call requiring a stub | Neither condition is present |

All other rules (`one-it`, `aaa-headers`, `no-internal-mocks`, `shape-and-value`, `no-shared-setup`, `no-runtime-branching`, `literal-path`, `symbol-statuses`, `no-before-all`, `one-request`, `plain-english-it`, `no-magic-values`, `precise-matchers`, `auth-matches-initiator`, `use-parsed-body`) apply to every test and never receive `N/A`.

**`N/A` does not count toward the letter grade in either direction.** The letter grade is computed only from `✗` counts. **`N/A` also does not push RITE dimension verdicts toward Mixed or Poor** — a dimension whose only non-✓ rules are `N/A` is graded `Good`.

**Why this curve, not a smoother numeric one:** Blockers represent silent-pass failures — the test claims to verify behavior it does not actually verify. A test that lies should never receive an A or B no matter how many other rules it follows. The strict cap encodes that judgment directly into the grade.

## RITE dimensions

Beyond the per-rule verdict and the letter grade, every request test is assessed along four orthogonal quality dimensions: **Readable**, **Isolated**, **Thorough**, **Explicit**. The dimensions are an *additional lens* — they do not change the letter grade. They surface clusters of trouble that the per-rule list can hide. (A test with three minor ✗s scattered across all four dimensions tells a different story than a test with three minor ✗s all in the *Explicit* dimension; the second one has a coherent problem worth a refactor, the first reads as "small inconsistencies.")

Each rule contributes to one or more dimensions. Some rules contribute to multiple — that's expected; the dimensions describe what the *test as a whole* delivers, not what each rule individually proves.

| Dimension | What it means for a request test | Contributing rules |
|-----------|----------------------------------|-------------------|
| **Readable** | A reader can follow the `it` top-to-bottom without scrolling, knows what the test does from its description, and can locate Arrange/Act/Assert at fixed positions. | `aaa-headers`, `plain-english-it`, `literal-path`, `no-shared-setup`, `one-it`, `use-parsed-body` |
| **Isolated** | The test stands alone — no order dependencies, no cross-`it` state leakage, no hidden setup that varies between runs, exactly one HTTP call to Canvas. | `one-it`, `one-request`, `no-before-all`, `no-shared-setup`, `no-runtime-branching`, `stub-outbound`, `use-timecop` |
| **Thorough** | The test proves behavior, not coincidence — full-shape assertions, every collaborator verified, DB state reloaded, deterministic numeric types, feature flags pinned. | `shape-and-value`, `verify-stubs`, `reload-assertions`, `eql-for-numerics`, `feature-flag-setup`, `no-internal-mocks` |
| **Explicit** | Every value the assertions depend on appears in setup; matchers carry intent (`:ok`, not `200`); auth pattern matches initiator; nothing inferred from defaults or precedent-by-convention. | `literal-path`, `no-magic-values`, `symbol-statuses`, `precise-matchers`, `auth-matches-initiator`, `eql-for-numerics`, `precedent-matched`, `feature-flag-setup`, `no-internal-mocks` |

### Dimension verdict

For each dimension, the grader emits one of three verdicts based on the contributing rules' results in *this* test:

| Verdict | Condition |
|---------|-----------|
| **Good** | All contributing rules are ✓ or N/A. |
| **Mixed** | At least one ✗ among contributing rules, but no blocker ✗. |
| **Poor** | At least one blocker ✗ among contributing rules. |

The verdict is mechanical from the per-rule result, not a separate judgment call. A rule marked N/A counts as "no signal in either direction" — it does not push the dimension toward Mixed or Poor.

## Common anti-patterns

Patterns the grader catches via existing rules. This table is for users coming from other testing cultures who want to map their vocabulary onto this skill's rules. The grader does not emit findings against these names directly — it emits findings against the rule slug.

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
| Order-dependent tests via `before(:all)` | Records persist across examples; downstream tests see undefined state. | `no-before-all` |
