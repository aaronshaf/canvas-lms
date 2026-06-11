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

## Pattern E — Same-File RSpec Stub Leak (QE-155)

### Example: `web_post_plugin_spec.rb` — sibling tests stub `CanvasHttp.post`

A test file contains multiple examples. Some stub a class method; a later
example (in randomized order) depends on the real method. When stub cleanup
between examples fails intermittently, the stub leaks.

```ruby
# Test 2 — stubs CanvasHttp.post to a no-op
it "truncates become_user_uri" do
  allow(CanvasHttp).to receive(:post)         # ← stub: returns nil
  plugin.export_error(report, config)
  expect(CanvasHttp).to have_received(:post) { |_, opts| ... }
end

# Test 3 — needs the REAL CanvasHttp.post to call through
it "rejects an insecure URI without posting" do
  expect { plugin.export_error(report, endpoint_uri: "http://169.254.169.254/latest/") }
    .to raise_error(CanvasHttp::InsecureUriError)
end
```

RSpec randomizes test order. When test 3 runs after test 2 and the stub on
`.post` is not fully cleaned up, `post` returns `nil` without calling
`request` → `validate_url` → `resolve_and_validate_host`. No validation
runs, no error is raised.

### How to recognise

- Error: "expected SomeError but nothing was raised"
- The same spec file has other tests that stub the method in the call chain
- High flaky_fails, low build_fails, no common preceding test across reports
  (the contaminator is INSIDE the file, not from a preceding file)
- Failure rate ≈ K/N! where K is the number of orderings where the victim
  runs immediately after a stubbing test and N is the number of tests in the
  describe group (e.g. ~33% for a 3-test group with 1 stubbing test)

### Fix — at the source (S-12)

Add `ensure` blocks to the contaminating tests that save and restore the
original method using pure Ruby, bypassing `RSpec::Mocks.teardown`:

```ruby
it "truncates become_user_uri" do
  original_post = CanvasHttp.singleton_class.instance_method(:post)
  allow(CanvasHttp).to receive(:post)
  plugin.export_error(report, config)
  expect(CanvasHttp).to have_received(:post) { |_, opts| ... }
ensure
  CanvasHttp.singleton_class.define_method(:post, original_post) if original_post
end
```

`singleton_class.instance_method(:post)` captures the real method as an
`UnboundMethod` before the RSpec stub replaces it. `define_method` in
`ensure` restores it unconditionally. This is idempotent with RSpec's own
teardown — both restore the same method.

**Do not fix the victim.** Adding defensive overrides (`.and_call_original`)
to the victim means every new test added to the file that depends on the
real method would also need the defense. Fixing at the source protects all
sibling tests — present and future.

### Contributing factor: Ruby 3.x `...` delegation

`CanvasHttp.post` is defined with `def self.post(...)`. The `...` delegation
syntax in Ruby 3.x may interact poorly with rspec-mocks' method
save/restore mechanism (`singleton_class.instance_method` + `define_method`),
causing intermittent failure to restore the original. The explicit
`ensure` in the contaminating test provides a second restore that runs
regardless of rspec-mocks' internal state.

### Eliminated hypothesis: `spec_helper.rb:96`

`spec/spec_helper.rb:96` stubs `resolve_and_validate_host` → nil in
describe groups that `include WebMock::API`. Analysis proved this stub is
correctly scoped to its describe group via `before(:each)` and cannot leak
to tests that do not include `WebMock::API`.

### Difference from Pattern A

Pattern A: a mutable class variable leaks a DATA value across examples.
Fixed by resetting the variable in `ensure`.

Pattern E: an RSpec method stub leaks a METHOD OVERRIDE across examples
within the same file. The class's data is correct, but the method itself
is replaced with a no-op. Fixed by saving and restoring the original method
via `ensure` in the contaminating tests.

Both can co-exist on the same test (as in `web_post_plugin_spec.rb:52`),
requiring separate defenses for each vector.

---

## Files affected

- `spec/lib/canvas/plugins/ticketing_system/web_post_plugin_spec.rb:52` (Pattern A — QE-142, QE-147; Pattern E — QE-155)
- `spec/initializers/canvas_http_spec.rb` (Pattern A source — QE-147)
- `spec/controllers/application_controller_spec.rb:1513` (Pattern B source — QE-147)
- `spec/selenium/context_modules/shared_examples/context_modules_teacher_shared_examples.rb:843,:797` (Pattern B — QE-147)
- `spec/lib/canvas_operations_rake_spec.rb` (Pattern C — QE-146)
- `gems/plugins/multiple_root_accounts/spec_canvas/lib/tasks/cloudfront_transition_spec.rb` (Pattern D — QE-144)
