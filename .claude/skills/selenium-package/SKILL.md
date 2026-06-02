---
name: selenium-package
description: Package the output files from a selenium-pipeline run into a named zip and offer to attach it to a Jira ticket or save it to a custom path. Run this after selenium-pipeline completes for a directory.
---

# Selenium package skill

Collects every artifact produced by a `selenium-pipeline` run for a given
directory, zips them into a single named archive, then asks where to put it:
attach to a Jira ticket, save to a custom path, or both.

## Input

A directory name or path, e.g. `courses` or `spec/selenium/courses`.
If not supplied, ask for one.

Optional `--run-dir <root>` — the run-scoped artifact root to package from.
Defaults to `tmp`. The `selenium-pipeline` always passes this
(e.g. `tmp/selenium-runs/courses_20260602-141530`); when set, discover artifacts
under `<root>/selenium-audit/`, `<root>/selenium-trim/`, `<root>/selenium-behavior/`,
and `<root>/selenium-coverage/` instead of the bare `tmp/` paths in Step 2.

## Zip naming convention

```
<dir>_oplid-ws12_selenium_<ticket>_<YYYY-MM-DD>.zip
```

Examples:
```
courses_oplid-ws12_selenium_QE-51_2026-05-21.zip
grades_oplid-ws12_selenium_none_2026-05-22.zip
```

`<ticket>` comes from step 1 (the user supplies it, or `none` if skipped).
`<YYYY-MM-DD>` is today's date from `date +%Y-%m-%d`.

## Workflow

### Step 1 — Collect inputs upfront

Ask both questions in one `AskUserQuestion` call:

1. **Jira ticket key** — the sub-task this pipeline run is tracked under
   (e.g. `QE-51`). Type `none` to omit from filename and skip attachment.
2. **Destination** — where to send the zip:
   - `jira` — attach to the Jira ticket
   - `path` — save to a custom local path (will prompt for it)
   - `both` — attach to Jira AND save locally

If the user picks `path` or `both`, ask for the target directory path in a
follow-up question.

### Step 2 — Discover artifact files

Look for pipeline output under these paths (using the short `dir_name`):

```
tmp/selenium-audit/<dir_name>.csv
tmp/selenium-audit/<dir_name>.summary.md
tmp/selenium-trim/<dir_name>.preview.md
tmp/selenium-trim/<dir_name>.manual_review.csv
tmp/selenium-trim/<dir_name>.follow_up.md
tmp/selenium-behavior/<dir_name>.behaviors.csv
tmp/selenium-behavior/<dir_name>.quality.csv
tmp/selenium-behavior/<dir_name>.quality.summary.md
tmp/selenium-behavior/<dir_name>.gap_report.md
tmp/selenium-coverage/<dir_name>/report.md
tmp/selenium-coverage/<dir_name>/run_current.log
tmp/selenium-coverage/<dir_name>/run_base.log
tmp/selenium-coverage/<dir_name>/trimmed.resultset.json
tmp/selenium-coverage/<dir_name>/original.resultset.json
```

For each path, check `test -f <path>` before including it. Files that don't
exist are silently skipped (not every stage may have run). Report how many
files were found before zipping.

If zero files are found, tell the user and stop.

### Step 3 — Build the zip

```bash
TODAY=$(date +%Y-%m-%d)
TICKET=<ticket_key_or_none>
ZIP_NAME="<dir_name>_oplid-ws12_selenium_${TICKET}_${TODAY}.zip"
ZIP_PATH="tmp/${ZIP_NAME}"

zip -j "$ZIP_PATH" <file1> <file2> ...
```

Use `-j` (junk paths) so the zip contains flat files without nested
directory structure, making it easy to open and read.

Report the zip path and size (`ls -lh "$ZIP_PATH"`).

### Step 4 — Deliver the zip

#### If destination is `jira` or `both`

Upload as an attachment to the ticket using the Jira REST API.

**Find credentials** — check these environment variables in order:
1. `JIRA_BASE_URL` and `JIRA_API_TOKEN` and `JIRA_EMAIL`
2. Fallback: inspect `~/.config/jira/config.yml` or `~/.jira.d/config.yml`

If credentials are not found in the environment, print clear instructions:
```
Could not find Jira credentials. Set these env vars and re-run:
  export JIRA_BASE_URL=https://your-domain.atlassian.net
  export JIRA_EMAIL=you@example.com
  export JIRA_API_TOKEN=your_api_token
```
and stop the Jira upload (continue with local save if `both` was chosen).

**Upload command:**
```bash
curl -s -o /tmp/jira_attach_response.json \
  -w "%{http_code}" \
  -u "${JIRA_EMAIL}:${JIRA_API_TOKEN}" \
  -X POST \
  -H "X-Atlassian-Token: no-check" \
  -F "file=@${ZIP_PATH}" \
  "${JIRA_BASE_URL}/rest/api/2/issue/${TICKET}/attachments"
```

Check the HTTP status code:
- `200` — success. Parse the response JSON to get the attachment URL and
  show it to the user.
- `401` — bad credentials. Surface the error.
- `404` — ticket not found. Surface the error.
- Other — show the raw response.

#### If destination is `path` or `both`

Copy the zip to the user-supplied directory:
```bash
cp "$ZIP_PATH" "<target_dir>/${ZIP_NAME}"
```

Confirm the final path with `ls -lh`.

### Step 5 — Report

Print a summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SELENIUM PACKAGE — <dir_name>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Archive:  <zip_name>
  Size:     <size>
  Files:    N artifacts

  Destinations:
  ✓ Attached to <ticket>
    <attachment_url>
  ✓ Saved to <target_path>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Omit destination lines that were skipped or failed.

## Notes

**Flat zip (`-j`)**: All files land at the root of the zip with their
original filenames. Two files could collide if they share a name (e.g.
`report.md` doesn't exist here, but watch for it if new artifact types
are added). If a collision is detected, use `-j` with explicit rename
flags or switch to preserving paths with `-r`.

**Large resultset files**: `trimmed.resultset.json` and
`original.resultset.json` are typically 6–7 MB each. Jira's default
attachment limit is 10 MB per file, 25 MB total per request. If the zip
exceeds 20 MB, warn the user before uploading and offer to omit the
resultset files:

```
⚠ Zip is <size> — close to Jira's attachment limit.
  Include resultset JSON files? (They add ~13 MB but are needed to
  reproduce the coverage diff locally.)  y/n
```

**`tmp/` is a named Docker volume**: the zip is built from files that
were already `docker cp`'d to the host in the coverage-compare step.
Do not try to zip from inside the Docker container — work on the host.
