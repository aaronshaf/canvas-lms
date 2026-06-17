# Jira MCP Integration Plan — flaky-test-fixer

## Goal

Automate two things currently done manually:
1. **Post fix summaries to Jira** — replace the HTML-file + copy-paste workflow (S-02)
2. **Read prior fix history from Jira** — when a test has a `# flaky-fix:` tag, read
   the fix history from the referenced ticket(s) to inform root-cause analysis on
   re-offenders (enhances S-16)

---

## Key decisions

### MCP server

Use the **official Atlassian remote MCP** — already added to project config:

```
claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp
```

Config lives in `.claude.json` (project-level). Requires session restart to load.
Auth: OAuth 2.1 browser flow (works with Okta SSO).

**Why not comments:** The official MCP supports `addCommentToJiraIssue` but NOT
reading or updating comments (known gap, GitHub issue #88). Use the **Description
field** instead — both `getJiraIssue` (read) and `editJiraIssue` (write) are supported.

### Where fix history lives

Fix summaries go in the **Description field** of the batch ticket, not in comments.
One structured section per fixed test, separated by `=====FLAKY-FIX=====`.

### Lookup key

Primary key: the `it` description string (e.g. `"creates a discussion and replies to it"`).
Secondary key: spec file path.

**Not** line number — lines shift as code evolves; the `it` description is semantically
stable and appears in every CI failure report.

Lookup algorithm when coming from `# flaky-fix: QE-NNN` on a test:
1. Extract `it` description from the spec file
2. `getJiraIssue("QE-NNN")` → read Description
3. Search for a `### [flaky-fix]` header matching the `it` description → **primary hit**
4. If no header match, search `Satellite-fixes:` lines → **satellite hit**
5. Return the whole section as prior-fix context

### Section format

```
### [flaky-fix] "it description string"
Spec: spec/path/to/file.rb
Stats: N build_fails, N flaky_fails (at time of fix)
Satellite-fixes: "sibling test description" (filename.rb),
  "another sibling" (filename.rb)
Error: <error signature>
Root cause: <prose — include satellite-specific notes inline if needed>
Fix applied (PS NNNNN): <prose>
If insufficient: <next steps>
```

Rules:
- **Primary section**: the test that drove the investigation — full analysis
- **Satellite-fixes field**: other tests fixed in the same pass (same root cause);
  no separate sections for them — any satellite-specific details go in the
  "Root cause" or "Fix applied" prose
- **Update semantics**: when a fix is revised after CI failure, replace the section
  entirely; fold lessons learned into the new version
- Sections separated by `=====FLAKY-FIX=====`

---

## Phases

### Phase 0 — MCP setup and format spike *(next session, do first)*

MCP server already added. On next session start it will be available.

Steps:
1. Call `getJiraIssue("QE-157")` — inspect what the Description field looks like
   in the response (plain text? ADF JSON? markdown?)
2. Make a test `editJiraIssue` write on QE-157 Description → read back → confirm
   round-trip fidelity and what format `editJiraIssue` accepts
3. Gate: proceed only if structured text survives intact

**This gates the format finalization in Phase 1.**

### Phase 1 — Define the new format in style.md

- Replace S-02 (HTML file + copy-paste) with the new Description-based schema above
- Document the `[flaky-fix]` section format, separator, lookup algorithm, and
  update semantics
- Update `SKILL.md` allowed-tools to include the Atlassian MCP tools

### Phase 1.5 — One-time migration of prior 9 tickets

**Migration tickets:** QE-99, QE-141, QE-142, QE-144, QE-146, QE-147, QE-151,
QE-155, QE-157

**User's prep per ticket:** Copy only the final structured fix comments into the
Description field (remove discussion noise). Use `=====FLAKY-FIX=====` as
separator between multiple comment blocks.

**Claude's step per ticket:**
1. `git log --all --oneline | grep QE-NNN` → find fix commit(s)
2. `git show <sha> -- spec/` → identify which tests were changed + their `it` descriptions
3. Cross-reference the git diff with the raw comment blocks in the Description to
   attribute each block to the right test(s) (handles batches with multiple tests)
4. Reformat into proper `[flaky-fix]` sections per the Phase 1 schema, identifying
   primary vs satellite relationships
5. `editJiraIssue` → write structured Description back
6. Repeat for all 9 tickets

This also serves as a real-world rehearsal of the read/write MCP cycle before
the live workflow is wired up.

### Phase 2 — Automate posting/updating (replaces S-02)

After user approves a fix:
- Skill calls `getJiraIssue` → reads current Description
- Appends (new test) or replaces (revised fix) the `[flaky-fix]` section for this test
- Calls `editJiraIssue` → writes back
- No more HTML files; remove S-02's HTML template from `style.md`

### Phase 3 — Read prior fix history into S-16

When a test has `# flaky-fix:` tag(s):
- For each referenced ticket: `getJiraIssue` → scan Description for matching sections
  (by `it` description primary, file path secondary; check both header and
  `Satellite-fixes:` lines)
- Feed matched section(s) into root-cause analysis before classification
- Update S-16 in `style.md` to document this as the standard first step

---

## Current status

- [x] MCP server added to project config (requires session restart to activate)
- [x] Phase 0: format spike — completed 2026-06-16
- [x] Phase 1: style.md + SKILL.md update — completed 2026-06-16
- [x] Phase 1.5: migration of 9 tickets — completed 2026-06-16 (QE-90 reconstructed from git)
- [x] Phase 2: live post/update workflow — completed 2026-06-16
- [x] Phase 3: S-16 enhancement — completed 2026-06-16
