**Archived:** Merged into Case 12 — Process-Level State Contamination (QE-147).

# KB Case 05 — Global State Contamination via Mutable Class Variables (QE-142)

## Context

This case documents a flaky pattern in pure Ruby (non-Selenium) tests where
a mutable class-level instance variable is modified by one test and not
properly restored, causing a later test to see unexpected state.

The triggering test was `web_post_plugin_spec.rb:52`. It is unrelated to
`SpecTimeLimit::Error`, browser timing, or race conditions.

---

## Failure Signature

```
RSpec::Expectations::ExpectationNotMetError:
  expected CanvasHttp::InsecureUriError but nothing was raised
```

**Stats signature:** very low `build_fails`, high `flaky_fails`
(ratio ~50:1). The contamination depends on test execution order, which
varies across CI workers.

---

## Root Cause

`CanvasHttp.blocked_ip_ranges` is backed by a mutable class instance
variable with a hardcoded fallback:

```ruby
def self.blocked_ip_ranges
  @blocked_ip_ranges || [
    "127.0.0.0/8",
    "169.254.0.0/16",  # link-local + cloud metadata
    ...
  ]
end

def self.blocked_ip_ranges=(range)
  @blocked_ip_ranges = range
end
```

When `@blocked_ip_ranges` is `nil`, the getter returns the default list
(which includes `169.254.0.0/16`). When `@blocked_ip_ranges` is set to
`[]`, the getter returns `[]` and `resolve_and_validate_host` skips all
validation:

```ruby
def self.resolve_and_validate_host(host)
  return nil if blocked_ip_ranges.empty?  # ← exits immediately
  ...
end
```

The contaminating test (`spec/initializers/canvas_http_spec.rb:24`) sets
`CanvasHttp.blocked_ip_ranges = []` in a `before` hook to test
circuit-breaker behaviour. Its `after` hook restores to `nil`. But if test
ordering places our test between that spec's `before` and `after` (or the
`after` fails), the blocklist is empty.

---

## The Fix Pattern

Reset the class variable to its default state at the start of the test:

```ruby
it "rejects an insecure URI without posting" do
  CanvasHttp.blocked_ip_ranges = nil # ensure default blocklist is active
  ...
  expect { ... }.to raise_error(CanvasHttp::InsecureUriError)
end
```

Setting to `nil` makes the getter fall through to the hardcoded default
list. This is safe because `nil` IS the default state.

---

## When to Recognise This Pattern

1. **Error type:** `ExpectationNotMetError` — "expected X but nothing was
   raised" or "expected X but got Y" — where the test passes in isolation
   but fails in CI with random test ordering.

2. **The test depends on global configuration** that has a
   getter-with-fallback pattern: `@var || DEFAULT`. Any test that sets
   `@var` to a non-nil value bypasses the default.

3. **The contaminating test uses `before`/`after` hooks** to set and restore
   the variable. The `after` hook is the fragile link — if it doesn't run
   (exception, CI interruption) or if test-queue interleaving places another
   test mid-execution, the contamination leaks.

## How to Find the Contaminating Test

```bash
git grep "CanvasHttp.blocked_ip_ranges ="
# or more generally:
git grep "ClassName.mutable_setting ="
```

Look for tests that set the value in `before` and restore in `after`. The
restoration might use `ensure` (safer) or `after` hooks (fragile to
ordering).

---

## Prevention

For the contaminating test, prefer RSpec stubs over direct mutation:

```ruby
# FRAGILE — depends on after hook running
before { CanvasHttp.blocked_ip_ranges = [] }
after  { CanvasHttp.blocked_ip_ranges = nil }

# SAFE — stub is auto-cleaned by RSpec after each example
allow(CanvasHttp).to receive(:blocked_ip_ranges).and_return([])
```

For the affected test, the defensive reset (`= nil`) is a pragmatic fix
when you can't change the contaminating test (different team, different
change).

---

## Other Canvas Examples of This Pattern

Any class with a `self.setting=` writer and a `self.setting` getter that
falls back to a default is susceptible. Common candidates:

- `CanvasHttp.blocked_ip_ranges`
- `DynamicSettings` configuration
- `ConfigFile` overrides
- Feature flag caches (`Account.site_admin` state)

### Files affected (QE-142)

- `spec/lib/canvas/plugins/ticketing_system/web_post_plugin_spec.rb:52`
