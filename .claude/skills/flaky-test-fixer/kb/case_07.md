# KB Case 07 — Browser State Leak Between Tests (QE-144)

## Context

Two tests in a `describe "fullscreen"` block failed intermittently with
`NoSuchAlertError` in the `prepend_before` hook — before the test body ran.
The root cause was a sibling test that entered browser fullscreen mode
without exiting it.

---

## Pattern — Fullscreen (or Other Browser State) Not Cleaned Up

### Failure signature

```
Failure/Error: close_modal_if_present { resize_screen_to_standard }
Selenium::WebDriver::Error::NoSuchAlertError: no such alert
  # ./spec/selenium/common.rb:84
```

The error occurs in the `prepend_before` hook, not in the test body.
Screenshots show the page in a state left by the previous test (e.g. a
dropdown menu still open, normal mode instead of fullscreen).

### Root cause

The `prepend_before` hook (common.rb:84) calls `resize_screen_to_standard`
→ `driver.manage.window.maximize`. When Chrome is in Fullscreen API mode,
`maximize` intermittently triggers `UnexpectedAlertOpenError` (Chrome's
fullscreen exit notification). The `close_modal_if_present` rescue catches
it and calls `driver.switch_to.alert.accept`, but the alert vanishes by
then — `NoSuchAlertError` propagates unhandled.

The offending test enters fullscreen but never exits:

```ruby
# BAD — enters fullscreen, never exits
it "stil shows tinymce menus when in fullscreen" do
  visit_front_page_edit(@course)
  full_screen_button.click
  doc_btn = document_toolbar_menubutton
  doc_btn.click
  expect(f("##{doc_btn.attribute('aria-owns')}")).to be_displayed
  # no exit_full_screen_button.click
end
```

### Fix

Add an `after` block to the `describe` that exits fullscreen via a helper:

```ruby
describe "fullscreen" do
  after do
    force_exit_fullscreen
  rescue # safe even if browser session is broken
  end
```

`force_exit_fullscreen` is defined in `custom_screen_actions.rb`:

```ruby
def force_exit_fullscreen
  driver.execute_script("if (document.fullscreenElement) document.exitFullscreen()")
end
```

### How to recognise

- Error is in `prepend_before` or `append_after`, not in the test body
- The error type is `NoSuchAlertError`, `UnexpectedAlertOpenError`, or
  `InvalidSessionIdError`
- Screenshots show a page state from a different test (open menus, modals,
  fullscreen)
- The previous test in the same describe block enters a browser state
  (fullscreen, modal, alert) without reverting it

### General principle

Any test that changes browser-level state (fullscreen, window size, alerts,
extra windows) must revert it. When individual tests are unreliable at
cleanup, add an `after` block on the enclosing `describe` as a safety net.
Use `rescue` in the `after` block so cleanup failures don't mask the real
error.

---

## Files affected (QE-144)

- `spec/selenium/rcs/rce_next_spec.rb` — `after` block added to
  `describe "fullscreen"`
- `spec/selenium/test_setup/common_helper_methods/custom_screen_actions.rb`
  — `force_exit_fullscreen` helper added

---

## Uncontrolled Environment Variable (Companion Pattern)

The cloudfront_transition_spec tests (also QE-144) exhibited a related
pattern: `ApplicationController.test_cluster?` varied between CI workers,
causing `effective_host` to rewrite domain names on some workers. Three
tests always failed together because they all depended on the rake task
finding domains by their original host names.

**Fix:** Stub the environment variable in the shared `before` block:
```ruby
allow(ApplicationController).to receive(:test_cluster?).and_return(false)
```

**How to recognise:**
- Multiple tests in the same file always fail together
- The error values contain environment-specific data (cluster names,
  transformed hostnames)
- The test setup mocks most external dependencies but misses one
  environment-sensitive method

This is similar to Case 05 (global state contamination) but the source is
the CI worker environment rather than a mutable class variable.
