# KB Case 08 — Conditional Task Loading with Stale Guard (QE-146)

## Context

This case documents a flaky pattern in rake task specs where a conditional
guard intended for lazy initialization fails because it checks the wrong
condition, leaving the required tasks undefined on some CI workers.

The triggering test was `canvas_operations_rake_spec.rb` (all 16 tests in
file). It is unrelated to Selenium, browser timing, or race conditions.

---

## Failure Signature

```
RuntimeError:
  Don't know how to build task 'canvas_operations:run'
  (See the list of available tasks with `rake --tasks`)
Failure/Error: let(:task) { Rake::Task["canvas_operations:run"] }
```

**Stats signature:** moderate `build_fails`, high `flaky_fails`
(ratio ~7:1). All tests in the file fail together — never individually.

---

## Root Cause

The spec loaded rake tasks conditionally:

```ruby
before do
  Rails.application.load_tasks if Rake::Task.tasks.empty?
end
```

`Rake::Task.tasks` is a process-global registry. On CI, the test-queue
(rspecq) runs many specs on the same worker. If any preceding spec caused
Rake to load *some* tasks (even unrelated ones), `tasks.empty?` returned
`false`, `load_tasks` was skipped, and `canvas_operations:run` was never
defined.

The guard assumes a binary state: either "no tasks loaded" or "all tasks
loaded." In practice, partial loading is common — the Rake registry can
contain tasks from a single `.rake` file loaded by a preceding spec without
the full application task set.

---

## The Fix

Replace the binary guard with a targeted check for the specific task:

```ruby
before do
  unless Rake::Task.task_defined?("canvas_operations:run")
    Rails.application.load_tasks
  end
end
```

### Why `task_defined?` instead of `tasks.empty?`

| Guard | Problem |
|---|---|
| `tasks.empty?` | False negative: unrelated tasks in the registry cause the check to skip loading |
| `task_defined?("canvas_operations:run")` | Only skips when the *specific* task is already available |

### Why `Rails.application.load_tasks` instead of direct `load`

The rake file depends on framework-provided constants and tasks:
- `:environment` prerequisite (defined by Rails)
- `Switchman::Rake.shardify_task` (defined by Switchman's Railtie)

Loading the rake file directly (`load "path/to/file.rake"`) defines the
task but fails on these dependencies. `Rails.application.load_tasks` sets
up the full task graph including all Railtie-contributed tasks.

---

## How to Recognise This Pattern

1. **All tests in a file fail together** — not individual flakiness
2. **Error is `RuntimeError: Don't know how to build task '...'`** — the
   task registry, not the test logic, is the problem
3. **The spec has a conditional `load_tasks` or `rake_require` guard**
   that can be defeated by prior state
4. **The preceding specs vary across runs** — confirming it's worker-state
   dependent, not a specific contaminating test

---

## Unsuccessful Approaches

| Attempt | Why it fails |
|---|---|
| Direct `load` of the `.rake` file + manual `define_task(:environment)` | Rake file calls `Switchman::Rake.shardify_task` at load time, which requires the full Railtie environment |
| Direct `load` of the `.rake` file without `:environment` stub | `RuntimeError: Don't know how to build task 'environment'` — the `:environment` prerequisite is not defined |

---

## Relationship to Other Cases

**Case 05 (Global State Contamination):** Both involve shared process state
that varies between CI workers. Case 05 covers mutable class variables
(`CanvasHttp.blocked_ip_ranges`); this case covers the Rake task registry.
The fix pattern differs: Case 05 resets the variable; this case uses a
targeted existence check.

**Case 07 (Uncontrolled Environment Variable):** Similar "multiple tests
always fail together" symptom, but the root cause is process-level state
(Rake registry) rather than environment variables.
