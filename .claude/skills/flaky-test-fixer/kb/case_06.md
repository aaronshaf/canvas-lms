# KB Case 06 — JS Bundle Init Race and Browser HTTP Cache (QE-144)

## Context

Two independent race conditions caused `NoSuchElementError` on an
AJAX-populated tool list in the "Add Item to Module" dialog. Both had to be
fixed for the test to pass reliably.

---

## Pattern A — JS Bundle Not Initialised When Change Event Fires

### Failure signature

```
Selenium::WebDriver::Error::NoSuchElementError:
  Unable to locate element: "#context_external_tools_select .tools .tool:contains('Test LTI Tool')"
```

Rails log shows zero `Processing by Lti::LtiAppsController` — the AJAX was
never sent.

### Root cause

The `select_content_dialog` JS bundle loads asynchronously. During init it:
1. Detaches a `.tool` template element from the DOM (line 946)
2. Binds `$('#add_module_item_select').change()` (line 947)

If the test selects "External Tool" before step 2, the native change event
fires before the handler is bound. The AJAX never starts.

### Fix

Wait for the template detach as a signal that the handler is bound:

```ruby
expect(f("#context_external_tools_select .tools")).not_to contain_css(".tool")
```

Since JS is single-threaded, template removal on line 946 guarantees the
handler on line 947 has been bound by the time Selenium regains control.

### How to recognise

- `NoSuchElementError` on an element populated by AJAX
- Zero corresponding `Processing by` entries in the Rails log
- The AJAX is triggered by a JS event handler bound during bundle init
- The test interacts with the trigger element immediately after page load

---

## Pattern B — Browser HTTP Cache Serving Stale AJAX Response

### Failure signature

Same `NoSuchElementError`, but diagnostic logging shows:

```
hasLoaded: true, toolCount: 0, messageText: nil
```

The AJAX success callback ran (class `loaded` set, message removed), but
zero tools were rendered. No `Processing by` entry in the Rails log —
Chrome served the response from its HTTP cache.

### Root cause

The `launch_definitions` endpoint responds with `expires_in 10.minutes`.
Earlier tests in the same shared examples select "External Tool" and
trigger the same AJAX URL before the test tool exists in the DB. Chrome
caches that empty response. When the target test runs, Chrome serves the
stale cache.

### Diagnostic signal

1. `hasLoaded: true` — the JS success callback ran
2. `toolCount: 0` — no tools in the response
3. `messageText: nil` — the `.message` element was removed (success path)
4. No `Processing by Lti::LtiAppsController` in the Rails log

The combination of 1+4 confirms a cache hit: the AJAX completed from
Chrome's perspective, but the server never saw the request.

### Fix

Move the test data creation to a `before(:once)` that runs before any test
in the shared examples can trigger the cached AJAX:

```ruby
shared_examples_for "context modules for teachers" do
  before(:once) do
    @course.context_external_tools.create!(name: "Test LTI Tool", ...)
  end

  # Earlier tests that select "External Tool" now get a cached response
  # that includes "Test LTI Tool"
end
```

### How to recognise

- AJAX-populated list is empty despite the data existing in the DB
- The endpoint uses `expires_in` or `Cache-Control` with a TTL
- Earlier tests in the same file/worker trigger the same endpoint URL
- Adding diagnostic logging confirms `loaded: true` with zero results

---

## The Core Rule

> When a test depends on AJAX-loaded content, verify two things:
> (1) the JS handler that triggers the AJAX is bound before the trigger
> fires, and (2) the endpoint's cache headers don't allow Chrome to serve
> a stale response from an earlier test.

---

## Files affected (QE-144)

- `spec/selenium/context_modules/shared_examples/context_modules_teacher_shared_examples.rb`
