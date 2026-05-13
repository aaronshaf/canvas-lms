---
name: controller-to-request-spec
description: Convert Canvas controller specs (spec/controllers/*) into request specs by rewriting action-based calls to URL-based calls. Use this when migrating a *_controller_spec.rb to the request style (`type: :request`).
allowed-tools: Bash(bin/rails routes*), Bash(docker compose run --rm web rails routes*), grep*, rg*, Edit, Read, Write
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

