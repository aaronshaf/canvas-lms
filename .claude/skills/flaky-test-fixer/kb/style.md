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

## S-05 — One patch set per JIRA issue

**Rule:** Bundle all fixes for a single JIRA ticket into one Gerrit patch
set. Do not create separate patch sets per test — they create merge/abandon
overhead with no benefit.

**How to apply:** Use `git commit --amend` to add new fixes to the existing
commit, keeping the same `Change-Id`. Push to the same `refs/for/master`
reference to update the PS in place.

*Introduced: QE-142*

---

<!-- Add new rules below as S-06, S-07, … -->
