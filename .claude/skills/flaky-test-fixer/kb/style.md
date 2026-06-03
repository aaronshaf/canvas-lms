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

<!-- Add new rules below as S-03, S-04, … -->
