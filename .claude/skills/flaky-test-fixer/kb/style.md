# Flaky Test Fixer — Style Guidelines

Conventions for annotating and structuring flaky test fixes in Canvas.
Each rule lists the JIRA that introduced it so the rationale can be traced.

---

## S-01 — Annotate every fixed test with a tracking tag

**Rule:** Add `# flaky-fix: <JIRA>` as an inline comment on the `it` line of
every test that receives a flaky fix.

**Format:**
```ruby
it "edits an announcement" do # flaky-fix: QE-141
```

**Placement priority:**
1. **Inline on the `it` line** (preferred) — zero lines added, no line-number
   shift, annotation visible on the test declaration.
2. **First line inside the block** — use when the `it` line would exceed the
   rubocop line-length limit after adding the tag.
3. **Never above the `it` line** — pushes the test to the next line number,
   breaking all existing references in CI reports, Observe queries, and JIRA
   comments.

**Cross-language form** (tag content is identical; only the comment marker
changes per language):

| Language | Form |
|---|---|
| Ruby, Python, Shell | `# flaky-fix: QE-141` |
| JavaScript, Java, Groovy | `// flaky-fix: QE-141` |
| CSS / C multiline | `/* flaky-fix: QE-141 */` |

**Searching:**
```bash
git grep "flaky-fix:"          # all annotated tests in the repo
git grep "flaky-fix: QE-141"   # all tests fixed in a specific batch
```

**What the JIRA ticket should contain:**
- The full list of tests in the fix batch
- Symptoms and error messages observed
- Root cause analysis
- Options considered and why each was accepted or rejected
- What a proper long-term fix looks like if the current fix is a workaround

**What the code annotation should NOT contain:** any of the above. The tag is a
pointer, not a summary. Keep detail in the JIRA and in the KB case files.

*Introduced: QE-141*

---

## S-02 — Write JIRA fix comments as HTML files, not inline Markdown

**Rule:** When producing a JIRA comment summarising a flaky fix, write it to
a local HTML file, open it in a browser, and copy the rendered content into
JIRA's visual editor. Do not paste raw Markdown or JIRA wiki markup.

**Why:**
- JIRA's visual editor does not render Markdown — backtick fences, `**bold**`,
  and `#` headings all appear as literal characters.
- JIRA wiki markup (`{code}`, `*bold*`) only renders in Text mode, which most
  users do not switch to by default.
- A browser copies rendered HTML to the clipboard. JIRA's visual editor accepts
  that clipboard content and preserves bold, code blocks, and structure.

**Workflow:**
1. Write the comment to a file — e.g. `~/Downloads/jira_<ticket>.html`.
2. Open it in the default browser (`open <file>` on macOS).
3. `Cmd+A` → `Cmd+C` in the browser.
4. Paste into JIRA's visual editor. Formatting transfers intact.

**Minimal HTML template:**
```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: sans-serif; font-size: 14px; line-height: 1.5;
         max-width: 800px; padding: 24px; }
  pre  { background: #f4f4f4; border: 1px solid #ddd; border-radius: 3px;
         padding: 10px; font-size: 13px; white-space: pre-wrap; }
  code { font-family: monospace; background: #f4f4f4;
         padding: 1px 4px; border-radius: 2px; font-size: 13px; }
  p    { margin: 6px 0; }
</style>
</head>
<body>
  <!-- comment content here -->
</body>
</html>
```

**Content structure** (one `<p>` per field, `<strong>` for labels,
`<pre>` for error output, `<code>` for inline identifiers):
```html
<p><strong>Test:</strong> spec/path/to/spec.rb:LINE</p>
<p><strong>Stats:</strong> N build_fails, N flaky_fails</p>
<p><strong>Error:</strong></p>
<pre>paste raw error here</pre>
<p><strong>Root cause:</strong></p>
<p>Explanation using <code>method_name</code> for inline code.</p>
<p><strong>Fix applied (PS NNNNNN):</strong></p>
<p>Description.</p>
<p><strong>If this fix proves insufficient:</strong></p>
<p>Next steps.</p>
```

**Trailing spaces:** strip all trailing spaces from every line. They cause
extra blank lines in JIRA's visual editor after paste.

**File naming:** `jira_<TICKET>_<short_test_name>.html` — e.g.
`jira_qe141_serializer.html`. One file per test comment so each can be
pasted independently.

*Introduced: QE-141*

---

## S-03 — Preserve original coverage

**Rule:** When fixing a flaky test, the top priority is to preserve the
original test coverage. Do not remove assertions, simplify scenarios, or
change the tested behaviour unless there is no alternative and the trade-off
is explicitly discussed.

**Why:** A flaky-fix that silently reduces coverage trades one problem
(intermittent failure) for another (undetected regression). The goal is to
make the test reliable while keeping it effective.

**How to apply:** Before removing any interaction or assertion, ask: "which
`expect` call verifies this?" If the answer is "none", the interaction is a
candidate for removal. If an `expect` depends on it, the interaction must
stay — find a different way to make the test faster or more stable.

*Introduced: QE-142*

---

## S-04 — Determine original coverage from description AND assertions

**Rule:** The test description (`it "..."`) alone does not fully describe
the intent and goals of a test. The original coverage is the union of the
test description and the full set of assertions in the implementation.

**Why:** Test descriptions are often abbreviated or outdated. A test titled
"shows required replies input" may also verify date persistence, section
warnings, and edit-page round-trips via its assertions. Relying only on the
title leads to underestimating what the test covers and accidentally dropping
important checks.

**How to apply:** Before modifying or splitting a test, inventory every
`expect` call and map it to the behaviour it verifies. The fixed version
must represent all of those behaviours — either in the same test or
distributed across split tests.

*Introduced: QE-142*

---

## S-05 — Minimise patch sets per JIRA issue

**Rule:** Use as few Gerrit patch sets as possible per JIRA ticket. Within a
single repo, bundle all fixes into one PS. Across repos, one PS per repo is
the minimum — never more.

**How to apply:**
- Use `git commit --amend` to add new fixes to the existing commit, keeping
  the same `Change-Id`. Push to the same `refs/for/master` reference to
  update the PS in place.
- When amending a commit message (e.g. to improve the description after
  review feedback), **preserve the original `Change-Id`** in the message
  footer. If the hook generates a new `Change-Id`, manually replace it with
  the original before pushing — otherwise Gerrit creates a new PS instead of
  updating the existing one.
- When a batch spans multiple repos (e.g. `canvas-lms` + a plugin like
  `multiple_root_accounts`), create one PS in each repo. Reference the
  companion PS in the commit message or JIRA comment so reviewers can find
  both.

*Introduced: QE-142, updated: QE-144*

---

## S-06 — Avoid raw `execute_script` in test files

**Rule:** Do not call `driver.execute_script` directly in spec files. Use
or create a helper method instead.

**Why:** Inline `execute_script` triggers the `Specs/NoExecuteScript` RuboCop
cop, scatters JS snippets across test files, and makes intent harder to read.
Encapsulating the call in a helper gives it a name, a single location, and
reuse across specs.

**How to apply — in priority order:**
1. **Use an existing helper.** Search `spec/selenium/test_setup/common_helper_methods/`
   and the relevant page objects. Examples: `element_exists?`, `scroll_page_to_top`,
   `get_value`, `fullscreen_element`.
2. **Extend an existing helper.** If a helper is close but not quite right,
   parameterise or broaden it rather than writing a new one.
3. **Add a new helper** only when nothing existing covers the need. Place it
   alongside helpers of the same category:
   - Screen/window state → `custom_screen_actions.rb`
   - Element queries → `custom_selenium_actions.rb`
   - Waits/polling → `custom_wait_methods.rb`
   - Alerts/modals → `custom_alert_actions.rb`
   - Page-specific → the relevant page object (e.g. `rce_next_page.rb`)

*Introduced: QE-144*

---

## S-07 — Add diagnostic logging when the failure report is inconclusive

**Rule:** When the Jenkins MHTML failure report does not provide enough
information to reach a stable diagnosis, add temporary `Rails.logger.info`
logging to the test. Push the instrumented version, let CI produce a failure,
read the diagnostic output from the Rails log section of the MHTML, then
remove the logging before the final PS.

**How to apply:**
- Prefix log lines with a tag: `[QE-NNN DIAG]` so they are easy to grep in
  the MHTML.
- Capture the JS/DOM state via a helper or (temporarily) `execute_script`,
  returning a hash of the values you need. Log the hash with `.inspect`.
- Take two snapshots when diagnosing a wait: one immediately after the
  action, one after the wait times out. The diff reveals whether the state
  changed at all.
- Mark the logging clearly as temporary in the commit message and in a code
  comment so it is not accidentally left in.
- Remove all diagnostic logging before the fix is submitted for review.

**Example (from QE-144):**
```ruby
diag = driver.execute_script(<<~JS)
  var sel = document.querySelector('#my_element');
  return {
    hasLoaded: sel ? sel.classList.contains('loaded') : 'missing',
    childCount: sel ? sel.children.length : 0
  };
JS
Rails.logger.info("[QE-144 DIAG] state: #{diag.inspect}")
```

*Introduced: QE-144*

---

## S-08 — Account for browser HTTP caching in Selenium tests

**Rule:** When a test depends on data created at test time being returned by
an AJAX endpoint, verify that the endpoint's cache headers
(`expires_in`, `Cache-Control`) do not allow Chrome to serve a stale
response from an earlier test on the same worker.

**How to apply:**
- If the endpoint uses `expires_in` (e.g. `launch_definitions` caches for
  10 minutes), ensure the test data exists **before the first request to
  that URL** — typically by creating it in a top-level `before(:once)` that
  runs before all tests sharing the same course/URL.
- Moving data creation from inside the `it` block to `before(:once)` is the
  preferred fix. It ensures every cached response already contains the data.
- Do not create a separate test to "prime" the cache — just ensure the data
  exists early enough.
- When diagnosing, the signal for a cache hit is: the AJAX success callback
  ran (`loaded` class set, message removed) but zero items appeared, and
  there is no corresponding `Processing by` entry in the Rails log.

*Introduced: QE-144*

---

## S-09 — Re-evaluate `custom_timeout` after changing a test's runtime

**Rule:** When a flaky fix adds retry loops (`keep_trying_until`), extra waits,
or any other change that increases the test's wall-clock time, recalculate the
Case 02 formula and add or adjust `custom_timeout` if needed.

**Why:** A fix that adds a `keep_trying_until` block (up to 10 s) or an extra
`wait_for_ajaximations` (2 s) can push a test over the `TARGET_TIMEOUT` (15 s)
threshold — the timeout applied when the file appears in HEAD's changed files.
Since a flaky-fix PS always modifies the file, the reduced timeout is guaranteed
to apply during CI verification of the fix itself.

**How to apply:**
1. After implementing the fix, re-count H and M for the full example
   (including `before` hooks) per Case 02.
2. Add the worst-case cost of any new retry/wait (e.g. +10 s for
   `keep_trying_until`, +2 s per `wait_for_ajaximations`).
3. If the result exceeds the current `custom_timeout` (or the 15 s
   `TARGET_TIMEOUT` when no annotation exists), set or raise
   `custom_timeout` to the formula result (rounded up to nearest 5,
   capped at 60).

*Introduced: QE-146*

---

## S-10 — Back `requestAnimationFrame` with `setTimeout(0)` globally (keep it async)

**Rule:** InstUI `Select`/`Popover`/`Tooltip` mount their portals on a
`requestAnimationFrame` tick. jsdom drives rAF with an internal frame timer
scheduled separately from ordinary timers and far more easily starved under CI
load, so portal `findBy*` waits (e.g. `findByRole('listbox')`) intermittently
exceed `asyncUtilTimeout` and flake. Fix this **once, globally** in
`ui/setup-vitests.tsx` by backing rAF with a plain `setTimeout(0)` — a normal
macrotask that fires as reliably as RTL's own `findBy` polling.

**Implementation** (in the shared setup — module-load baseline + guarded reinstall):
```ts
const installRafShim = () => {
  window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 0) as unknown as number) as typeof window.requestAnimationFrame
  window.cancelAnimationFrame = ((id: number) =>
    clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof window.cancelAnimationFrame
}
installRafShim() // module load: a callable baseline, before any component captures rAF
beforeEach(() => {
  if (!vi.isFakeTimers()) installRafShim() // never clobber fake-timer-controlled rAF
})
```

**It must coexist with `vi.useFakeTimers()` — this is the whole difficulty.** A
global rAF override that ignores fake timers fails in CI in two order-dependent
ways that **do not reproduce in isolation** (only in full-shard runs):
- Overwriting a fake-timer-controlled rAF → timer-driven callbacks never fire
  (`vi.fn()` "called 0 times", e.g. `CreateOutcomeModal > Mobile`). → fixed by
  the `!vi.isFakeTimers()` guard.
- rAF/cAF left non-callable across a fake-timer save/restore boundary →
  `cancelAnimationFrame is not a function` on a later unmount. → fixed by the
  always-callable **module-load** baseline (so restore targets are functions).

**Keep it asynchronous — never make rAF synchronous.** Running the callback
synchronously (`cb => { cb(0); return 0 }`) changes component timing suite-wide
and breaks unrelated tests that rely on rAF firing on a later tick (CI fallout:
`OutcomeView`, `FileUpload`, `DiscussionThreadContainer`, `DashboardCard`, …).
Unguarded, it also stack-overflows on InstUI's per-frame position-tracking loop.

**Why these implementation choices:**
- **Route through the wrapped `setTimeout`.** `setup-vitests.tsx` already wraps
  `setTimeout`/`clearTimeout` to track pending timers and skip callbacks after
  jsdom teardown. Each scheduled frame is therefore tracked, cleared, and guarded.
- **Install at module load AND reinstall in `beforeEach` only when
  `!vi.isFakeTimers()`; never restore.** The baseline is always callable, fake
  timers stay in control when active, and there is no captured original to
  restore unsafely.

**Scope and exceptions:**
- `ui/setup-vitests.tsx` covers `ui/**` tests only. Packages with their own
  Vitest config (e.g. `packages/canvas-rce`) are **not** covered — add the same
  shim to that package's setup if needed there.
- Do not delete a `requestAnimationFrame` assignment that is a deliberate test
  harness (e.g. a `MockWindow` that captures the callback for manual invocation)
  — that is not the starvation workaround and the global rule does not replace it.

**Validation:** verified that the de-overridden suites and the QE-145 flaky
suite pass on the shim alone, and that the suites broken by the earlier
synchronous attempt pass again. A suite-wide rAF change is still infra; gate it
on a full `yarn test` run.

*Introduced: QE-145*

---

<!-- Add new rules below as S-11, S-12, … -->
