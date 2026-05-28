---
name: controller-to-request-spec
description: Convert Canvas controller specs (spec/controllers/*) into request specs by rewriting action-based calls to URL-based calls. Use this when migrating a *_controller_spec.rb to the request style (`type: :request`). After the mechanical port, the skill enters Grading mode by default — pass `--no-grading` to skip.
allowed-tools: Bash(bin/rails routes*), Bash(docker compose run --rm web rails routes*), grep*, rg*, Edit, Read, Write, Agent, AskUserQuestion
argument-hint: "[--no-grading]"
---

Canvas is migrating its `spec/controllers/*_controller_spec.rb` files to the request-spec style (`type: :request`). Request specs make real HTTP requests to the Rails router, so they catch routing bugs that controller specs silently mask. Controller specs have also been deprecated by the rails maintainers.

## What changes

1. **The `describe` block declares `type: :request`:**
   ```ruby
   # before
   describe NewQuizzesController do

   # after
   describe NewQuizzesController, type: :request do
   ```
   The controller constant can stay (it's just a label); what matters is the `type: :request` metadata.

2. **HTTP verb calls switch from referencing controller methods to referencing the full URL.** Controller specs invoke an action by symbol with a `params:` hash; request specs invoke a full URL where some params may be in the URL itself. Path segments that the route declares as dynamic (`:course_id`, `:assignment_id`) must be interpolated into the URL. Remaining params (query string, form body) stay in a `params:` hash:
   ```ruby
   # before
   get :launch, params: { course_id: course.id, assignment_id: assignment.id, path: "settings" }

   # after
   get "/courses/#{course.id}/assignments/#{assignment.id}/launch", params: { path: "settings" }
   ```

3. **Format params can be moved to the URL, or omitted.** The .json extension is optional for our API endpoints.
   ```ruby
   # before
   get :show, params: { id: 1, format: :json }

   # after — either
   get "/api/v1/things/1.json"
   # or
   get "/api/v1/things/1"
   ```

## Finding the right URL

For each `get/post/put/patch/delete :action, params: { ... }` call, you need the URL the router maps to that action. Two ways to find it:

  1. **Read `config/routes.rb`** for the controller.** This is the fastest option — search for the controller's scope and find the line declaring the action. Example for `NewQuizzesController#launch`:
     ```ruby
     scope(controller: :new_quizzes) do
       get "launch", action: :launch, as: :new_quizzes_launch
     ```
     Combined with the enclosing `resources :courses` / `resources :assignments` scopes, this resolves to `/courses/:course_id/assignments/:assignment_id/launch`.

  2. **Run `rake routes`** filtered by controller.** This is authoritative when the routes file is hard to read (deep nesting, constraints, etc.):
    ```bash
    docker compose run --rm web rails routes | grep "new_quizzes#"
    ```
    Look at the URI Pattern column — that's the string to use, with `:param` placeholders replaced by `#{value}` interpolations. Drop the `(.:format)` suffix unless you're actually testing format negotiation.

## Things that don't translate cleanly

Request specs don't expose the controller instance, so these controller-spec idioms need a different approach:

- **`assigns[:foo]` / `assigns(:foo)`** — request specs cannot read controller instance variables. If the test only checks `assigns`, rewrite it to assert on the rendered response (`response.body`, `response.parsed_body`, redirect target, status code) instead. If the assertion has no analog in the response, leave a `# TODO: assigns not available in request specs` and flag it to the user.
- **`controller.instance_variable_get(:@foo)`** — request specs cannot read the instance variables from a controller. Instead, see where the variable is being used in the response, and look for that value in the response. If this request is not an API endpoint, you may need to look at the .erb template for that endpoint in app/views/.
- **`controller.foo` / `allow(controller).to receive(...)`** — there is no `controller` method. Stub at the class level instead (`allow_any_instance_of(NewQuizzesController).to receive(...)`) or rework the test to drive the behavior through the request.
- **`request.path` stubs** — same problem. The real request is built from the URL you pass to `get`, so usually the right fix is to send the actual URL you want rather than stubbing.
- **`response.should render_template(...)`** — works in request specs only when `render_views` is in scope. If the existing assertion fails after conversion, switch to checking `response.body` for a distinguishing string from the template.

`user_session(user)` continues to work — it sets up the session cookie at the Rack level, which both styles honor.

## Process

1. Read the whole spec file before editing — note every distinct action invocation and any uses of `assigns`, `controller`, or `render_template`.
2. Resolve each action to a URL via `config/routes.rb` (preferred) or `rake routes` (fallback). Cache the mapping in your head — most files only hit two or three distinct routes.
3. Add `type: :request` to the top-level `describe`.
4. Rewrite each verb call. Keep the `params:` hash for anything that isn't part of the path; move path segments into the URL string.
5. Address the non-translating idioms listed above. If a test relies on something request specs can't observe, surface it to the user rather than silently weakening the assertion.
6. Run the linter: `docker compose run --rm web rubocop -a <path>`. Accept any changes that it makes. If the linter can't be run or throws an error, skip this part.
7. Run the spec: `docker compose run --rm web bin/rspec <path>`. Failures here usually mean either a wrong URL, a missing `params:` key, or an `assigns`-style assertion that now needs to read the response.
8. Enter **Grading mode** (next section) unless the skill was invoked with `--no-grading`. Grading mode is the default; `--no-grading` exits here and reports the mechanical port as the final output.

## Grading mode

Grading mode brings every converted `it` block to `result=pass` per the grader rules in `.claude/skills/request-test-grader/references/request-test-rules.md` (zero failures). It runs by default after step 7. `--no-grading` skips it entirely.

**Precondition.** Step 7 reported all converted `it`s green. If any spec is still failing, do not enter Grading mode — surface the failures and stop. Grading a broken conversion produces noise.

### Workflow

1. **Load the rules.** Use the `Read` tool to read `.claude/skills/request-test-grader/references/request-test-rules.md` into context at the start of Grading mode. This is the same authoritative rules file the grader subagent applies, and the same one `request-test-writer` consumes.
2. **Pre-alignment pass.** Walk every converted `it` once and apply the cheap per-`it` rules inline before invoking the grader: `literal-path`, `reload-assertions`. Fixing these mechanically avoids burning grader cycles on violations the converter can catch up-front.
3. **Parallel grade.** For each converted `it`, spawn the `request-test-grader` subagent in parallel via the `Agent` tool.
   - **subagent_type:** `request-test-grader`
   - **description:** `Grade <basename>:<line>`
   - **prompt:** `<path>:<line>`
4. **Parse the trailers.** Each report ends with a machine-readable trailer (`result=`, `failures=`, `na=`). Read these — not the prose — to drive the fix loop.
5. **File-wide failure rules.** If any `it` reports `setup-in-it` as `fail` because of file-wide `let` / `before` blocks, batch them into a single `AskUserQuestion` *per file* with two options:
   - *Refactor file-wide* — inline the `let`/`before` setup into every converted `it`. May also touch sibling unconverted `it`s in the same file; warn the user inline.
   - *Leave + TODO comment* — preserve the structure and add `# TODO: grader violation — setup-in-it` to each affected `it`.
6. **Serial fix pass.** For each `it` with `result=fail`, apply the `Failures` fixes from its grader report. Fix in source order to keep diffs reviewable.
7. **Parallel re-grade.** Re-spawn the grader subagent for each fixed `it`. Parse the new trailers.
8. **Cap at 2 fix-and-regrade cycles per `it`.** After two cycles, accept the current state and move to escalation.
9. **Pass condition.** Every converted `it` reaches `result=pass`. If yes, Grading mode is done.
10. **Escalation.** For any `it` still at `result=fail`, print its grader report verbatim and end with a summary list of escalated `it`s. Do not silently mark these as done.

### `--no-grading`

Skips the rules load, pre-alignment, grader spawns, file-wide AskUserQuestion, and fix loop. The skill stops at step 7 of Process and reports the mechanical port as the final output. Use this for batch migrations where grading runs as a separate pass, or for scratch ports where rule compliance isn't the goal.

### Planned: per-file grader

A per-file grading skill is currently in development. When it lands, this workflow can invoke it once per file in place of the N parallel per-`it` subagent spawns — same fix-and-regrade structure, fewer agent invocations. Re-evaluate the grade step (workflow item 3) once that skill is available; the rest of the loop stays the same.

