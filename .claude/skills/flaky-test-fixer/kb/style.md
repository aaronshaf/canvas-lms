# Flaky Test Fixer — Style Guidelines

Conventions for annotating and structuring flaky test fixes in Canvas.
Each rule lists the JIRA that introduced it so the rationale can be traced.

---

## S-01 — Annotate every fixed test with a tracking tag

**Rule:** Add `# flaky-fix: <JIRA>` as an inline comment on the `it` line of
every test that is being fixed — including tests whose fix lives entirely in
other files (e.g. a contaminating spec is fixed to stop polluting this test).
Tag the victim even when its own code is untouched.

**Why tag indirect fixes:** If the indirect fix proves insufficient and the test
reappears in the flaky leaderboard, the tag gives the next engineer the JIRA
number to look up — the root-cause analysis, options considered, and what else
to try. Without the tag the history is invisible and the investigation starts
from scratch.

**Format:**
```ruby
it "edits an announcement" do # flaky-fix: QE-141
```

Multiple JIRA tickets are comma-separated, oldest first:
```ruby
it "resets form properly on new announcement", custom_timeout: 30 do # flaky-fix: QE-147, QE-151
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

*Introduced: QE-141, updated: QE-151*

---

## S-02 — Post fix summaries to the Jira Description via MCP

**Rule:** After the user approves a fix, append (or replace) a structured
`[flaky-fix]` section in the Jira batch ticket's **Description field** using
the Atlassian MCP (`getJiraIssue` / `editJiraIssue`). Do not create HTML
files or paste into the visual editor.

**First-time setup (one-time, if the MCP has not been configured):**

The Atlassian MCP must be added to the project config and authenticated
before this workflow can be used. If `getJiraIssue` or `editJiraIssue`
are not available or return an auth error, guide the user through these
three steps — each can be run from the Claude Code prompt with a `!` prefix:

1. Add the MCP server (project-level, persists across sessions):
   ```
   ! claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp
   ```
2. Restart the Claude Code session so the new MCP is loaded.
3. Authenticate via the browser OAuth flow (Okta SSO):
   Run `/mcp` in the Claude Code prompt and follow the browser prompt.

After completing these steps, retry the `getJiraIssue` call to confirm
the connection is live before continuing with the workflow.

**If the MCP is unavailable mid-session** (e.g. auth expired), surface
the error message to the user and ask them to run `/mcp` to re-authenticate,
then retry. Do not fall back to the HTML file workflow.

**Why:** The Description field is machine-readable, survives the MCP
read/write round-trip (markdown format), and enables the S-16 lookup
workflow (reading prior fix history for re-offenders). Jira comments cannot
be read back via the MCP.

**Section format — mandatory fields:**
```
### (flaky-fix) "it description string"

* **Spec:** spec/path/to/file.rb
* **Stats:** N build_fails, N flaky_fails (at time of fix)
* **Satellite-fixes:** "sibling test description" (filename.rb), "another sibling" (filename.rb)
* **Error:** <error signature — single line, no forced breaks>
* **Root cause:** <prose — single line; include satellite-specific notes inline if needed>
* **Fix applied (PS NNNNN):** <prose — single line>
* **If insufficient:** <next steps — single line>
```

**Optional fields** — add these between the mandatory ones when the original
comment contains the corresponding information:

| Field | When to add | Placement |
|---|---|---|
| `* **Prior fixes (S-16):**` | Test already had a `# flaky-fix:` tag | between Stats and Error |
| `* **Server-side cause:**` | Server log shows a distinct cause (e.g. Rails RoutingError behind a Selenium WebDriverError) | after Error |
| `* **Timeline:**` or `* **Breakdown timeline:**` | MHTML or Observe CSV provides a timeline | as a sub-bullet of Root cause, or after Prior fixes |

Additional named bullets may be added freely — the format is extensible.
Use the same `* **Label:** value` pattern.

Each property is a bullet on a **single unbroken line** — Jira wraps long
lines automatically in the UI. Property labels are bold for scannability.

For properties with multiple distinct points (e.g. a multi-step fix or a
list of rejected approaches), sub-bullets are supported and survive the
round-trip. Use a blank line after the parent bullet label, then indent
sub-bullets with 2+ spaces (Jira normalises to 4):

```
* **Fix applied (PS NNNNN):**
  * First change made and why.
  * Second change made and why.
  * Rejected: approach X — reason it failed.
```

**Including a code block inside a sub-bullet group:** wrap the code fence
as its own sub-bullet item (`  * ``` ... ```). This keeps all sibling
sub-bullets at the same indent level — no context break. Write with 2+
spaces of indentation on the fence and its content; Jira normalises to 4:

```
* **Fix applied (PS NNNNN):**
  * Prose description of the change.
  * ```
    code_example_here
    ```
  * Next sub-bullet continues at the same level.
```

**Avoid** placing a fenced code block as a free-standing top-level element
between sub-bullets — that breaks out of the list context and all items
after the code block revert to top-level bullets.

**Primary vs satellite:**
- The **primary section** is the test that drove the investigation — full
  analysis goes here.
- **Satellite-fixes** lists other changes made in the same pass with the same
  root cause. This includes:
  - Other `it` tests fixed (same pattern, proactive): `"it description" (filename.rb)`
  - Source fixes (e.g. `after :all` blocks added to contaminating spec files):
    `` `reload_routes!` added to horizon_mode_spec.rb, ... — source fixes, not `it` blocks ``
  No separate sections for satellites — any satellite-specific details go
  inline in the Root cause or Fix applied prose.
- When a fix is revised after CI failure, replace the section entirely and
  fold lessons learned into the new version.

**Section delimiter:** the `### (flaky-fix)` heading itself. No separator
line between sections — a blank line between the last bullet of one section
and the `###` heading of the next is sufficient.

**Workflow — posting a new fix after approval:**
1. `getJiraIssue(JIRA_KEY, fields=["description"], responseContentFormat="markdown")`
   — read the current Description.
2. Scan for a `### (flaky-fix)` header matching the `it` description:
   - **Match found** → replace the entire section (revised fix).
   - **No match** → append a blank line then the new section.
3. `editJiraIssue(JIRA_KEY, fields={description: <updated content>}, contentFormat="markdown")`
   — write back.

**Workflow — migrating raw comments into the structured format (Phase 1.5):**
1. `getJiraIssue` — read the raw comment blocks from Description.
2. **Run `git grep` to enumerate every tagged line:**
   ```
   git grep -n "flaky-fix:.*QE-NNN" -- spec/
   ```
   This is the authoritative list of what was changed in the batch. Cross-check
   against the raw comments to verify no satellites are missing — the comments
   sometimes omit satellites that are visible in git.
3. **Resolve `it` descriptions** for any raw comment that only gives a line
   number: `sed -n 'LINE,+3p' spec/path/to/file.rb` to find the `it` line.
4. **Map tagged lines to sections:**
   - Primary = the test whose failure drove the investigation (usually the one
     with the full error report in the comments)
   - Satellites = all other tagged `it` lines in the same batch
   - Source fixes (e.g. `reload_routes!`, `ensure` blocks in contaminating tests)
     = list in Satellite-fixes with `— source fixes, not it blocks` annotation
     if they are not `it` blocks themselves; list normally if they are `it` blocks
5. Compose sections and write back via `editJiraIssue`.

**Parse notes (validated 2026-06-16):**
- `(flaky-fix)` round-trips without any escaping — match heading lines as-is.
- Bold markers (`**Key:**`) round-trip cleanly — strip `* **Key:** ` prefix
  to extract field values.
- Bullet lines have no trailing `  ` hard breaks.

**Character escaping (Jira ADF → markdown round-trip, exhaustively tested):**

Jira escapes these characters when converting ADF back to markdown:

| Character | Escaped to | Preferred alternative in prose |
|---|---|---|
| `~` | `\~` | spell out "approx" or use `≈` |
| `[` `]` | `\[` `\]` | use `(` `)` for grouping in prose |
| `*` (bare, not bold/italic) | `\*` | use `x` for multiply, avoid stray asterisks |
| `` ` `` (bare, not in code span) | `` \` `` | wrap in a proper code span instead |

Additional behaviours to be aware of:
- `*italic*` → `_italic_` (normalised, not escaped — safe, renders identically)
- `&amp;` → `&` (HTML entity decoded — write `&` directly, never `&amp;`)
- `_` mid-word (e.g. `some_method`) — **safe**, not escaped

These characters are all **safe** (no escaping): `( ) { } # + - . ! | > < ^ & \ @ $ % = /`

**General rule:** use plain prose phrasing or code spans (`` `identifier` ``) for
technical content. Code spans survive intact and are the right tool for method
names, flags, and error class names — which is most of what goes in these fields.

**cloudId:** `4d2c21bc-0f18-46c6-947f-0d0dcbab3ca3` (instructure.atlassian.net)

*Introduced: QE-141 (HTML workflow), replaced by MCP workflow: QE-157*

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

**NEVER remove the Change-Id from a commit message.** Removing it causes the
commit hook to generate a fresh Change-Id on the next amend, which creates an
entirely new Gerrit change on push — abandoning the existing review thread,
losing the PS history, and producing a duplicate change. There is no valid
reason to remove a Change-Id. Even when starting a clean "single PS" redo:
abandon the old change in the Gerrit UI first, then keep the same Change-Id in
the new commit so Gerrit still links to the same review context.

**After every `git commit --amend`, verify the Change-Id before pushing:**
```bash
git show -s --format="%B" HEAD | grep "Change-Id"
# must match the Change-Id of the existing Gerrit change
```
If it doesn't match, stop and restore the correct Change-Id before pushing.

*Introduced: QE-142, updated: QE-151*

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

**How to apply:** Move test data creation to a `before(:once)` that runs
before any test can trigger the cached AJAX. See **Case 06 Pattern B** for
the full diagnostic procedure, signals, and fix details.

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

## S-11 — Use consistent `userEvent` for `CanvasAsyncSelect` interactions

**Rule:** When interacting with a `CanvasAsyncSelect` (or any InstUI
`Select`-based component) in a test, use `await user.click` consistently for
both opening the dropdown and selecting an option. After selecting, add an
explicit `waitFor` on the controlled input value before asserting downstream
effects or performing the next interaction.

**Never mix `fireEvent.click` for open with `user.click` for select:**
```js
// BAD — no focus events fired for open; creates blur/unmount race in CI
fireEvent.click(getByLabelText('Account'))
await user.click(await screen.findByText('CPMS'))
await waitFor(() => expect(...), {timeout: 20000})  // inflated timeout masks the race

// GOOD — consistent full-event simulation; explicit confirmation of selection
const accountSelect = getByLabelText('Account')
await user.click(accountSelect)                              // open
await user.click(await screen.findByText('CPMS'))            // select
await waitFor(() => expect(accountSelect).toHaveValue('CPMS'))  // confirm
// now safe to assert downstream effects or perform next interaction
```

**Why:**
`CanvasAsyncSelect`'s option-selected handler (`Ee`) is triggered by a click
on the mounted option element. `user.click` fires the full pointer/focus/blur
event sequence: when the option is clicked, `blur` on the input fires
`onRequestHideOptions` → `Se()` → `setIsShowingOptions(false)`. In CI, the
resulting unmount can race ahead of `pointerup`/`click`, so `Ee` never fires
and the selection is lost — unless focus state was correctly established
beforehand by using `user.click` to open. `fireEvent.click` fires no focus
events, so focus is wrong when the option click starts.

The `waitFor` on the input value waits for React to re-render after
`onOptionSelected` updates the component's controlled state; downstream
assertions or interactions that depend on that state would be non-deterministic
without it.

**Remove inflated timeouts** (`{timeout: 5000}`, `{timeout: 20000}`) that were
masking the race. After fixing the event sequence the default timeout suffices.

*Introduced: QE-149*

---

## S-12 — Fix global state contamination at the source, not the victim

**Rule:** When a flaky test fails because a preceding test leaked global
state (e.g. `I18n.locale`, class variables, process-level caches), fix the
contaminating test — do not add defensive resets in every victim.

**Why:** Defensive resets in victim tests create a bad pattern: each new
victim needs the same boilerplate, the real leak stays open, and tests
silently depend on running after the reset instead of in a clean
environment. Fixing the source closes the leak for all tests at once.

**How to apply — in priority order:**
1. **Fix the leaking test.** Add `ensure` cleanup or an `after` block that
   restores the original value. Use `ensure` when the cleanup must run even
   if the test raises. Prefer `ensure` over `after` for single-test leaks
   because it is co-located with the code that causes the contamination.
2. **Add a framework-level reset** when the leaked state has no per-test
   cleanup (e.g. no test "owns" the mutation, or multiple tests mutate the
   same global). Add the reset to `spec_helper.rb` or the relevant support
   file so it runs before every example.
3. **Never add per-victim defensive resets** as the primary fix. They are
   acceptable only as a temporary measure while the source fix is being
   reviewed by another team.

**Example (I18n.locale leak from QE-147):**
```ruby
# BAD — defensive reset in every victim
it "shows dates" do
  I18n.locale = :en  # workaround for locale leak
  ...
end

# GOOD — ensure cleanup in the contaminating test
it "resets the localizer" do
  ...
  I18n.set_locale_with_localizer
  expect(I18n.locale.to_s).to eq "ru"
ensure
  I18n.locale = I18n.default_locale
end
```

*Introduced: QE-147*

---

## S-13 — Reset `useRef` "in-progress" guards unconditionally

**Rule:** When a `useRef(false)` flag guards against concurrent async calls
in a React component, reset it in the `catch` block (or a `finally` block)
as well as on the success path. Never leave the reset only in `try`.

**Why:** A ref that is only cleared on success becomes a permanent lock after
any error. The `useEffect` or `useCallback` that calls the guarded function
may fire on every re-render (e.g. because a prop reference is unstable);
every call hits `ref.current === true` and returns early, silently blocking
all retries forever.

**How to apply:**

```ts
// BAD — permanent lock after any error
fetchingRef.current = true
try {
  const data = await fetchSomething()
  setState(data)
  fetchingRef.current = false           // ← only reset on success
} catch (err) {
  showFlashError(t('Failed'))(err)      // ← ref stays true forever
}

// GOOD — always unlocked after the attempt completes
fetchingRef.current = true
try {
  const data = await fetchSomething()
  setState(data)
} catch (err) {
  showFlashError(t('Failed'))(err)
} finally {
  fetchingRef.current = false           // ← reset regardless of outcome
}

// Also acceptable — explicit reset in catch when finally is inconvenient
fetchingRef.current = true
try {
  const data = await fetchSomething()
  setState(data)
  fetchingRef.current = false
} catch (err) {
  fetchingRef.current = false           // ← added to catch
  showFlashError(t('Failed'))(err)
}
```

**Related:** When a ref guard is used alongside an unstable `useCallback`
dependency (e.g. an inline arrow-function prop), the callback changes on
every render and the effect re-runs on every render. The guard prevents
redundant in-flight calls — but only while the ref is correctly reset after
each attempt. A stuck ref in this pattern is invisible: no error is thrown,
the UI just silently stops loading.

*Introduced: Case 11*

---

## S-14 — Do not list ephemeral loading flags in `useEffect` deps

**Rule:** Do not include transient loading state (`isLoading`, `isPending`,
`isFetching`) in a `useEffect` dependency array unless the effect's logic
genuinely branches on that value. If the flag is only there because the linter
flagged it, remove it and add an eslint-disable comment with a one-line
explanation.

**Why:** Ephemeral loading flags toggle on every fetch cycle (false → true →
false). Each toggle re-runs the effect, cancelling and rescheduling timers,
recreating observers, or resetting refs — churn that is both unnecessary and
timing-sensitive. In CI, where fetch latency differs from local runs, this
churn widens the window for race conditions.

**How to apply:** Ask "does the effect body contain an `if (isLoading)`
branch?" If no, the flag does not belong in the dep array.

```ts
// BAD — isLoading triggers full cancel/reschedule on every fetch transition
useEffect(() => {
  const timer = setTimeout(() => {
    const observer = new IntersectionObserver(cb, opts)
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, 0)
  return () => clearTimeout(timer)
}, [isLoading, loadMore, isOpen])   // ← isLoading not used in body

// GOOD — effect only restarts when the callback or open state changes
useEffect(() => {
  const timer = setTimeout(() => {
    const observer = new IntersectionObserver(cb, opts)
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, 0)
  return () => clearTimeout(timer)
}, [loadMore, isOpen])
```

*Introduced: Case 11*

---

## S-15 — Wait for button-enabled state before clicking a conditionally-disabled button

**Rule:** When a test clicks a button that starts in a disabled state and
becomes enabled only after a preceding async action, insert
`await waitFor(() => expect(button).not.toBeDisabled())` between the
enabling action and the dependent click. Never assume React has flushed
state updates between two sequential `fireEvent.click` calls.

**Why:** `fireEvent.click` is synchronous. After an action that triggers
React state updates, the component is not guaranteed to have re-rendered
before the next `fireEvent.click` fires. Clicking a disabled button
dispatches the DOM event but React's synthetic event system does not call
the `onClick` handler — the action silently has no effect, and any
downstream `waitFor` then times out.

The flakiness pattern: fast local runs often succeed because the flush
happens within the same microtask; CI load delays it enough to expose the
race.

**How to apply:**
1. Identify any click target that is described (or observed) as starting
   disabled.
2. Find the action that enables it (usually a prior click or form change
   that triggers state validation).
3. Insert a `waitFor` between those two points:

```tsx
// BAD — silent no-op when React hasn't flushed yet
fireEvent.click(getByTestId('criterion-save'))
fireEvent.click(getByTestId('save-button'))   // ← may be disabled

// GOOD — confirm precondition before acting
fireEvent.click(getByTestId('criterion-save'))
await waitFor(() => expect(getByTestId('save-button')).not.toBeDisabled())
fireEvent.click(getByTestId('save-button'))
```

**Contrast with S-11:** S-11 covers the event-sequence race inside
`CanvasAsyncSelect` (open vs. select interactions). S-15 is the broader
rule: any click target whose disabled state depends on prior async state
requires an explicit enabled-check before the click.

*Introduced: Case 13*

---

## S-16 — When a test already has a fix tag, look up the prior fix before diagnosing

**Rule:** Before classifying a new failure on a test that already carries a
`# flaky-fix:` tag, retrieve the prior fix from git and classify it as one of
three outcomes: **A. Unrelated**, **B. Partial**, or **C. Unsuccessful**. Each
outcome has a distinct response. Record the relationship in the JIRA comment
and update the KB if the prior fix was in error or incomplete.

**Why:** The prior fix is evidence — it tells you what was tried, what was
understood at the time, and whether the understanding was correct. Ignoring it
risks duplicating work, leaving bad code in place, or mis-diagnosing the
current failure as novel when it is actually the same pattern one position
earlier. The outcome also guides the fallback plan if the new fix proves
insufficient.

**How to retrieve the prior fix:**

**Step 1 — Read from Jira Description (primary, richest context):**

For each JIRA key in the `# flaky-fix:` tag list, look up the structured
`(flaky-fix)` section in that ticket's Description via MCP:

```
getJiraIssue(QE-NNN, fields=["description"], responseContentFormat="markdown")
```

Then locate the relevant section using this lookup order:

1. **Primary hit** — scan for a `### (flaky-fix)` heading whose quoted
   `it` description matches the test being investigated.
2. **Satellite hit** — if no heading match, scan each section's
   `* **Satellite-fixes:**` line for the `it` description (strip the
   `(filename.rb)` suffix before matching).
3. **Section found** → read the full section (Root cause, Fix applied,
   If insufficient) into context before classifying the current failure.
4. **No section found** (ticket not yet migrated) → fall back to git.

**Step 2 — Fall back to git (if Jira has no structured section):**

```bash
git log --all --oneline | grep <JIRA>   # find the commit(s)
git show <sha> -- <spec_file>           # read the exact diff
```

Use the git diff to reconstruct what was changed and why. After the
current fix is complete, the new batch ticket's `(flaky-fix)` section
should record the prior fix relationship in the Prior fixes (S-16) field
(Outcome A/B/C) so future lookups find it in Jira directly.

**How to assess whether a prior fix helped:**

The aggregate CSV row (e.g. 281 flaky_fails over 20 days) does not show
whether the rate changed after a fix. Ask the user for the detailed
breakdown from the "Jenkins Flaky Test Breakdown" Observe worksheet — a
CSV with one row per CI run where the test **failed at least once**
(flaky failure events only, not all executions). This dataset is only
useful for computing average daily flaky failures — not pass rates,
total runs, or reliability percentages. Key columns:

| Column | Meaning |
|---|---|
| `status` | `PASSED` (eventually) or `FAILURE` (all attempts failed) |
| `number_of_attempts` | 1 = clean pass, 2+ = failed at least once |
| `BUNDLE_TIMESTAMP` | Epoch nanoseconds — convert to date for timeline |
| `gerrit_ps_number` | Gerrit PS that was under test |

Build a daily failure count and compare the rate before vs after each fix
merge date. A fix that works shows a clear rate drop; a fix that doesn't
shows a flat or rising rate. This distinction is critical for classifying
the outcome — without it, you may incorrectly assume a prior fix helped
and miss that the contamination vector is still open.

**Outcome A — Unrelated (different root cause):**

The prior fix addressed a genuinely different problem in the same test.
The current failure is a new, independent issue.

- Apply the new fix normally.
- Note in the JIRA comment that the prior fix addressed something else, so
  reviewers understand why the tag already existed.
- No KB update needed for the prior fix.

**Outcome B — Partial (same root cause, incompletely resolved):**

The prior fix correctly identified the root cause but addressed only one
instance of it. The same pattern exists at another position in the test and
is now the failure point ("whack-a-mole").

- Scan the **entire test** for all remaining unguarded instances of the same
  pattern and fix them all in this pass — do not leave any for a future ticket.
- Note the sequential relationship in the JIRA comment (which fix covered what,
  and why both are now needed).
- Update the relevant KB case with a whack-a-mole warning so future engineers
  guard all instances in a single pass.
- Keep the prior fix tag; append the new JIRA to the comma-separated list
  (`# flaky-fix: QE-141, QE-155`).

**Outcome C — Unsuccessful (prior fix did not help or made it worse):**

The test continued to appear in the flaky leaderboard at the same rate after
the prior fix, or the prior fix introduced a new failure mode.

- **Undo the prior change** in the same commit that applies the new fix.
  Do not leave code that is known to be ineffective.
- Capture why the prior fix was insufficient in the JIRA comment: what the
  prior engineer observed, why the fix looked correct at the time, and what
  the actual root cause turned out to be.
- **Update the KB case** (or create a new one) to record: (1) the unsuccessful
  approach and why it fails, (2) the correct fix. This prevents others from
  repeating the same wrong fix.
- Replace the tag with the new JIRA only (the old tag pointed to an undone
  fix and is no longer meaningful as a pointer).

**Example of Outcome B (QE-141 → QE-155):**

The test `"edits the event in calendar"` calls `event_title_on_calendar.click`
twice, once per page navigation:

```ruby
get "/calendar2"
# ← no wait here — QE-155 fixed this (Outcome B)
event_title_on_calendar.click   # call #1

# …edit…

refresh_page
wait_for_ajaximations   # ← QE-141 added this (correct, but incomplete)
event_title_on_calendar.click   # call #2
```

QE-141 correctly identified the deferred-AJAX pattern but fixed only call #2
(the one the failure backtrace named). After that fix, call #1 became the new
failure point and the test re-entered the leaderboard. QE-155 is an Outcome B
fix: same root cause, different position. Had QE-141 scanned the full test and
applied this rule, both calls would have been guarded in one pass.

*Introduced: QE-155*

---

## S-17 — Stabilize an unstable callback prop in `useEffect` deps via `useRef`

**Rule:** When a `useEffect` lists a function prop (callback) in its
dependency array and that prop is not guaranteed to be stable (i.e. the
caller does not wrap it in `useCallback`), replace the direct dep with a
`useRef` that is kept in sync during render. Call `ref.current(...)` inside
the effect and remove the prop from the dep array.

**Why:** A new function reference is created on every render by default. If
it is in the dep array, the effect re-runs on every parent render regardless
of whether the data the effect actually cares about changed. Under CI load a
parent re-render can arrive mid-mutation (between two sequential state
updates), causing the effect to fire when its conditions are still `false` —
a silent no-op that leaves the UI in the wrong state.

**Pattern (event-handler ref):**

```ts
// BAD — prop in deps: re-runs on every parent render
useEffect(() => {
  if (dataReady && result) onCallback(result)
}, [dataReady, result, onCallback])   // ← onCallback changes every render

// GOOD — ref tracks latest value; effect only re-runs when data changes
const onCallbackRef = useRef(onCallback)
onCallbackRef.current = onCallback   // kept in sync during render

useEffect(() => {
  if (dataReady && result) onCallbackRef.current(result)
}, [dataReady, result])              // ← ref identity is stable
```

**The assignment `ref.current = prop` must be at the component's top level
(during render), not inside the effect** — the effect runs asynchronously, so
assigning inside it can miss re-renders that occur before the effect fires.

**How to apply:**
1. Identify a function prop in a `useEffect` dep array where the caller does
   not use `useCallback`.
2. Add `const cbRef = useRef(cb)` directly before the effect.
3. Add `cbRef.current = cb` on the next line (unconditional, top-level).
4. Replace `cb(...)` calls inside the effect with `cbRef.current(...)`.
5. Remove `cb` from the dep array.

**Prefer fixing at the source:** Wrapping `handleXxx` in `useCallback` in the
parent component eliminates the unstable reference entirely and is the correct
long-term fix. Use the ref pattern when you cannot change the caller (e.g. it
is a third-party consumer or the parent is outside your PR scope). Document
the `useCallback` fix as the "If insufficient" fallback.

*Introduced: Case 13 / QE-162*

---

<!-- Add new rules below as S-18, S-19, … -->
