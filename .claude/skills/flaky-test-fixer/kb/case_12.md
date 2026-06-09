# KB Case 12 — Process-Level State Contamination

Consolidated from archived Cases 05, 07 (companion pattern), and 08
during the QE-147 KB review. Originals preserved in `archive/`.

## Context

This case documents flaky patterns where process-global state — set by a
preceding test or the CI environment — causes deterministic, consistent
failures on some workers but not others.

**Recognition signals (shared across all patterns):**
- Multiple tests fail together (all-or-nothing)
- Failures are consistent across all retries (Initial + Rerun_1 + Rerun_2)
- The same tests pass on other CI workers
- Stats: very low `build_fails`, high `flaky_fails` (ratio ≥10:1)
- The test passes in isolation (`bin/rspec path/to/spec.rb:LINE`)

**Fix principle:** See S-12. Fix at the contamination source, not the
victim. Use `ensure` blocks or framework-level resets.

---

## Pattern A — Mutable Class Variable (QE-142, QE-147)

### Example: `CanvasHttp.blocked_ip_ranges`

A class with a `self.setting=` writer and a `self.setting` getter that
falls back to a default:

```ruby
def self.blocked_ip_ranges
  @blocked_ip_ranges || [ "127.0.0.0/8", "169.254.0.0/16", ... ]
end
```

A contaminating test sets `@blocked_ip_ranges = []` in a `before` hook.
If the `after` hook doesn't run, the empty blocklist leaks — downstream
tests that expect IP validation find it silently disabled.

### How to find the contaminator

```bash
git grep "ClassName.mutable_setting ="
```

Look for tests that set in `before` and restore in `after`. The `after`
hook is the fragile link.

### Fix

Replace `before`/`after` with inline setup + `ensure`:

```ruby
it "tests the circuit breaker" do
  CanvasHttp.blocked_ip_ranges = []
  # ... test body ...
ensure
  CanvasHttp.blocked_ip_ranges = nil
end
```

### Common candidates in Canvas

- `CanvasHttp.blocked_ip_ranges`
- `DynamicSettings` configuration
- `ConfigFile` overrides
- Feature flag caches (`Account.site_admin` state)
- `I18n.locale` (see Pattern B)

---

## Pattern B — I18n Locale Leak (QE-147)

### Example: `application_controller_spec.rb` "resets the localizer"

A test calls `I18n.set_locale_with_localizer` which sets `I18n.locale`
to `:ru`. The Canvas test framework has no global `I18n.locale` reset
between examples. Downstream tests that compare `datetime_string()` output
(now Russian) against browser-rendered dates (always English) fail:

```
expected: "6 Июн 2021 r. в 1:38"
     got: "Jun 6, 2021 at 1:38am"
```

### How to find the contaminator

```bash
git grep "I18n.locale\s*=" spec/
git grep "set_locale_with_localizer" spec/
```

### Fix

Add `ensure I18n.locale = I18n.default_locale` to the contaminating test.

---

## Pattern C — Process-Global Registry (QE-146)

### Example: `Rake::Task` registry

A spec loads rake tasks conditionally:

```ruby
before do
  Rails.application.load_tasks if Rake::Task.tasks.empty?
end
```

`Rake::Task.tasks` is process-global. If a preceding spec loaded *some*
tasks (not all), `tasks.empty?` returns false, `load_tasks` is skipped,
and the required task is never defined.

### Fix

Replace the binary guard with a targeted check:

```ruby
before do
  unless Rake::Task.task_defined?("canvas_operations:run")
    Rails.application.load_tasks
  end
end
```

---

## Pattern D — Uncontrolled Environment Variable (QE-144)

### Example: `ApplicationController.test_cluster?`

`test_cluster?` reads from the CI worker's environment. On some workers
it returns true, causing `effective_host` to rewrite domain names. Three
tests always fail together because they depend on original host names.

### Fix

Stub the environment-sensitive method in the shared `before`:

```ruby
allow(ApplicationController).to receive(:test_cluster?).and_return(false)
```

### How to recognise

- Multiple tests in the same file always fail together
- Error values contain environment-specific data (cluster names, hostnames)
- Test setup mocks most dependencies but misses one env-sensitive method

---

## Files affected

- `spec/lib/canvas/plugins/ticketing_system/web_post_plugin_spec.rb:52` (Pattern A — QE-142, QE-147)
- `spec/initializers/canvas_http_spec.rb` (Pattern A source — QE-147)
- `spec/controllers/application_controller_spec.rb:1513` (Pattern B source — QE-147)
- `spec/selenium/context_modules/shared_examples/context_modules_teacher_shared_examples.rb:843,:797` (Pattern B — QE-147)
- `spec/lib/canvas_operations_rake_spec.rb` (Pattern C — QE-146)
- `gems/plugins/multiple_root_accounts/spec_canvas/lib/tasks/cloudfront_transition_spec.rb` (Pattern D — QE-144)
