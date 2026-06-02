---
name: selenium-coverage-compare
description: Run a selenium spec directory twice — once on the current branch, once with files restored from a base ref — and produce a line-level coverage diff. Use after selenium-trim to verify that deleted tests provided no unique coverage. Also useful standalone to baseline coverage before starting a trim pass.
---

# Selenium coverage compare skill

Runs `spec/selenium/<directory>` under SimpleCov on two snapshots of the repo:

1. **Current** — the working branch as-is
2. **Base** — the same directory with spec files restored from a git ref (default `master`)

Then diffs the two `.resultset.json` files line by line and produces a report
explaining exactly which production lines (if any) are uniquely covered by the
deleted/changed tests. Links those losses back to the audit CSV citations when
one is available.

## Inputs

The user supplies:
- A spec directory: `spec/selenium/courses` or short form `courses`
- Optional `--base <ref>` — the git ref whose spec files represent "before" state
  (default: `master`)
- Optional `--audit-csv <path>` — path to `tmp/selenium-audit/<dir>.csv` to
  cross-check lost production lines against cited lower-level specs
  (auto-detected from `tmp/selenium-audit/<directory>.csv` if present)
- Optional `--full` — skip the changed-files-only fast path and run the full
  directory in both passes from the start (see Step 2 and Step 8.5). Use when you
  want the exhaustive comparison regardless of the fast-path result.
- Optional `--run-dir <root>` — root for the output directory and the auto-detected
  audit CSV. Defaults to `tmp`. The `selenium-pipeline` always passes this
  (e.g. `tmp/selenium-runs/courses_20260602-141530`); when set, all output lands in
  `<root>/selenium-coverage/<directory-name>/` (host and container side both),
  and the audit CSV is looked up at `<root>/selenium-audit/<directory>.csv`. Replace
  the leading `tmp` in every path below — including the container `OUT_DIR` and the
  `docker cp` source paths — with `<root>`.

If no directory is given, ask for one.

## Outputs

All output lands in `tmp/selenium-coverage/<directory-name>/`:

| File | Contents |
|---|---|
| `trimmed.resultset.json` | SimpleCov output from the current branch run |
| `original.resultset.json` | SimpleCov output from the base-ref run |
| `run_current.log` | Full rspec output for the current run |
| `run_base.log` | Full rspec output for the base run |
| `report.md` | Human-readable diff report |

## Workflow

### 1. Preconditions

Check all of these before doing anything else:

- **Docker is up**: `docker compose ps` must show the `web` container running.
  If not, tell the user to run `docker compose up -d` and stop.

- **Working tree clean**: `git status --porcelain` must be empty.
  This skill temporarily modifies spec files; a dirty tree makes the restore
  step ambiguous. Tell the user to commit or stash first.

- **Not on master/main**: The current branch must not be `master` or `main`.
  The skill is only meaningful when the current branch has trimmed/changed tests.

- **Base ref exists**: `git rev-parse --verify <base-ref>` must succeed.

### 2. Find changed spec files

Identify which spec files inside the target directory differ between HEAD and
`<base-ref>`:

```bash
git diff --name-only <base-ref>...HEAD -- <spec_dir>/
```

If the diff is empty (no spec files changed), tell the user and stop — there is
nothing to compare.

Capture this list. These are the files swapped between runs, AND — by default —
the only files the fast path runs (see Step 4).

#### Fast path vs full directory

Running **only the changed files** in both passes can only ever *over-report*
coverage loss: it ignores any coverage contributed by the unchanged files in the
directory, which it never executes. Therefore:

- If the changed-files-only diff shows **zero** production lines lost, the
  full-directory diff is *guaranteed* to be zero too — the two full runs are
  unnecessary and are skipped.
- If it shows any potential production loss, fall back to the full two-run
  pipeline (Step 8.5) to get the exact answer, because an unchanged file may
  still cover the "lost" line.

This makes the common case (trimming well-covered tests, true loss = 0) cost two
runs of just the touched files instead of two full Selenium suites. The fast path
never yields a false "safe" — only a false "unsafe" that triggers the correct,
slower fallback. Default to the fast path; use `--full` to force the full
directory run from the start.

### 3. Ensure selenium hub is running

Check: `docker exec selenium-hub curl -s http://localhost:4444/wd/hub/status 2>/dev/null`

If the hub isn't running:
- On Apple Silicon (arm64): pull and start `seleniarm/standalone-chromium:latest`
- On amd64: pull and start `selenium/standalone-chrome:latest`

```bash
docker run -d \
  --name selenium-hub \
  --network inst_shared \
  -p 4444:4444 \
  --shm-size=2g \
  <image>
```

Poll `http://localhost:4444/wd/hub/status` until `"ready": true` (up to 30 s).
If startup fails, surface the error and stop.

If a container named `selenium-hub` exists but is stopped, run
`docker start selenium-hub` instead of creating a new one.

### 4. Build and launch the two-run pipeline script

**This is the key efficiency insight.** Both test runs, the file swap, and the
coverage saves are bundled into a **single shell script executed inside the
Docker container as one background task**. This avoids the manual
save → swap → save dance that requires two separate background jobs and human
intervention between them.

The script runs `bin/rspec` against `RUN_TARGETS` rather than the whole
directory. For the **fast path** (default), `RUN_TARGETS` is the list of changed
files from Step 2. For the **full fallback** (Step 8.5, or `--full`),
`RUN_TARGETS` is `$SPEC_DIR`. Everything else about the script is identical, so
the same template serves both.

Create `tmp/selenium-coverage/<directory-name>/pipeline.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

SPEC_DIR="<spec_dir>"
BASE_REF="<base_ref>"
OUT_DIR="/usr/src/app/tmp/selenium-coverage/<directory-name>"
CHANGED_FILES=(<space-separated list from step 2>)

# Fast path: RUN_TARGETS = "${CHANGED_FILES[@]}"  (only the touched files)
# Full fallback (--full or after Step 8.5): RUN_TARGETS = "$SPEC_DIR"
RUN_TARGETS=(<changed files for fast path, or "$SPEC_DIR" for full>)

mkdir -p "$OUT_DIR"   # run-scoped path may be several levels deep inside the volume

echo "=== RUN 1: current branch ($(git rev-parse --short HEAD)) — targets: ${RUN_TARGETS[*]} ==="
rm -rf coverage
COVERAGE=1 bin/rspec "${RUN_TARGETS[@]}" --format progress --no-color \
  2>&1 | tee "$OUT_DIR/run_current.log" || true   # don't abort on test failures

cp coverage/.resultset.json "$OUT_DIR/trimmed.resultset.json"
echo "Run 1 coverage saved."

# --- swap files to base ref ---
echo "=== Restoring $BASE_REF spec files ==="
for f in "${CHANGED_FILES[@]}"; do
  git show "$BASE_REF:$f" > "$f"
  echo "  restored $f"
done

echo "=== RUN 2: base ref ($BASE_REF) — targets: ${RUN_TARGETS[*]} ==="
rm -rf coverage
COVERAGE=1 bin/rspec "${RUN_TARGETS[@]}" --format progress --no-color \
  2>&1 | tee "$OUT_DIR/run_base.log" || true

cp coverage/.resultset.json "$OUT_DIR/original.resultset.json"
echo "Run 2 coverage saved."

# --- restore current branch files ---
echo "=== Restoring current branch spec files ==="
for f in "${CHANGED_FILES[@]}"; do
  git checkout HEAD -- "$f"
  echo "  restored $f"
done

echo "=== Pipeline complete ==="
```

The file swap always covers only `CHANGED_FILES` — unchanged files are identical
between HEAD and base, so there is nothing to restore for them. On the fast path
`RUN_TARGETS` equals `CHANGED_FILES`; on the full path it is `$SPEC_DIR` while the
swap list stays `CHANGED_FILES`.

Key details:
- `|| true` after each `bin/rspec` so a test failure doesn't abort the pipeline.
  Coverage is still written even when tests fail.
- Use `git show <ref>:<file> > <file>` (not `git checkout <ref> -- <file>`)
  because the latter changes the index; the former only changes the working tree,
  which is exactly what we want.
- The coverage directory inside the container maps to a **named Docker volume**,
  not a bind-mounted host path. Never try to read `coverage/` directly from the
  host — always use `docker cp` (step 6) to extract the saved JSON files.

The `tmp/` directory inside the container is a **named Docker volume** — files
written to `./tmp/` on the host are NOT visible at `/usr/src/app/tmp/` inside
the container (same issue as the coverage JSON, see step 6). Copy the script in
via `docker cp` to the container's real `/tmp/` before executing it:

```bash
docker cp tmp/selenium-coverage/<directory-name>/pipeline.sh \
  canvas-web:/tmp/selenium_pipeline.sh

docker compose exec \
  -e SELENIUM_REMOTE_URL=http://selenium-hub:4444/wd/hub \
  web bash /tmp/selenium_pipeline.sh
```

Run this **in the background** (`run_in_background: true`). Tell the user both
test runs are queued in one job and to wait for the task notification.

### 5. Wait for the pipeline

Do not poll. The harness will fire a task notification when the background
command completes. Resume from there.

### 6. Extract coverage files from the Docker volume

The coverage JSON files are written inside the container's named `tmp` volume,
not to the host bind mount. Extract them with `docker cp`:

```bash
docker cp canvas-web:/usr/src/app/tmp/selenium-coverage/<dir>/trimmed.resultset.json \
  tmp/selenium-coverage/<dir>/
docker cp canvas-web:/usr/src/app/tmp/selenium-coverage/<dir>/original.resultset.json \
  tmp/selenium-coverage/<dir>/
```

If either file is missing, check the pipeline log for errors before proceeding.

### 7. Parse run summaries

From each log file, extract:
- Total examples, failures, pending
- Line coverage % and absolute count
- Wall-clock time

```python
import re
def parse_log(path):
    text = open(path).read()
    summary = re.search(r'(\d+) examples?, (\d+) failures?(?:, (\d+) pending)?', text)
    cov = re.search(r'Line Coverage: ([\d.]+)% \((\d+) / (\d+)\)', text)
    time = re.search(r'Finished in ([\d.]+) (seconds?|minutes?)', text)
    return summary, cov, time
```

### 8. Run the diff analysis

Parse both `.resultset.json` files with this algorithm:

```python
import json
from collections import defaultdict

def load_resultset(path):
    """Return {filename: set_of_covered_line_numbers}."""
    data = json.load(open(path))
    result = defaultdict(set)
    for _cmd, payload in data.items():
        for filename, info in payload.get("coverage", {}).items():
            lines = info.get("lines", []) if isinstance(info, dict) else info
            for i, count in enumerate(lines, 1):
                if count:
                    result[filename].add(i)
    return result
```

Compute:
- `lost` = lines in `original` but not in `trimmed` (unique to the deleted tests)
- `gained` = lines in `trimmed` but not in `original` (should be empty; flag if not)

Partition `lost` into:
- **Production lines**: files matching `app/` or `lib/` or `gems/` (excluding `spec`)
- **Test infrastructure**: files under `spec/` (factories, page objects, helpers)

Test infrastructure losses are expected and harmless — page-object methods and
helper functions only exercised by deleted tests. Don't flag them as problems.

### 8.5. Fast-path decision — escalate to full runs only if needed

This step applies only when the runs just analysed were the **fast path**
(changed files only). Skip it entirely if this was already a full-directory run
(`--full`, or a fallback run re-entering here).

- **Zero production lines lost** → the fast path is conclusive. Because running
  only the changed files can only over-report loss, an empty production `lost`
  set proves the full-directory diff is also empty. Record in `report.md` that
  the verdict was reached via the fast path (changed files only), note the run
  duration saved, and proceed to Step 10 with verdict ✅. **Do not run the full
  suites.**

- **One or more production lines lost** → the result is inconclusive: an
  unchanged file in the directory may still cover those lines. Re-run Step 4 with
  `RUN_TARGETS="$SPEC_DIR"` (full directory) in both passes, overwriting the same
  output files, then re-enter Step 5 → Step 8. Tell the user the fast path
  flagged N potential losses and the full comparison is running to confirm.
  On this second entry, skip this step (8.5) and continue to Step 9.

Mark in `report.md` which path produced the final numbers.

### 9. Cross-check production losses against the audit CSV

If an audit CSV (`tmp/selenium-audit/<directory>.csv`) is present (auto-detected
at `tmp/selenium-audit/<directory-name>.csv`), use the following algorithm to
dynamically match each lost production line to a cited lower-level spec. This
works for any directory — no hardcoded lookup tables.

#### 9a. Build a reverse citation index from the audit CSV

```python
import csv, os, re
from collections import defaultdict

def load_citations(audit_csv_path):
    """
    Return a list of dicts for every DELETE_COVERED row that has a
    non-empty existing_coverage value.
    Each dict has: test_name, selenium_file, existing_coverage (path:line).
    """
    rows = []
    if not os.path.exists(audit_csv_path):
        return rows
    with open(audit_csv_path) as f:
        for row in csv.DictReader(f):
            if row["verdict"] == "DELETE_COVERED" and row.get("existing_coverage"):
                rows.append(row)
    return rows
```

#### 9b. Match lost production lines to citations

For each lost production file, derive match tokens from its path, then find the
`DELETE_COVERED` rows whose `existing_coverage` spec file contains one of those
tokens. This handles both direct cases (`users_controller.rb` →
`users_controller_spec.rb`) and transitive cases (`auditors/course.rb` covered
by `courses_controller_spec.rb` because `course` appears in both).

```python
def citations_for_lost_file(lost_app_file, delete_covered_rows):
    """
    Find audit-CSV citations that plausibly cover `lost_app_file`.

    Returns a list of unique 'path:line' strings, best match first.
    Best = the citation whose spec-file basename shares the longest
    token with the app file basename.
    """
    # Build match tokens from the app file path
    # app/controllers/courses_controller.rb → {'courses', 'controller',
    #                                           'courses_controller'}
    # app/models/auditors/course.rb         → {'auditors', 'course',
    #                                           'auditors_course'}
    basename = os.path.basename(lost_app_file).replace(".rb", "")
    tokens = set(re.split(r"[_/]", basename)) | {basename}
    # Also add tokens from parent directory segments (handles namespaced models)
    for segment in lost_app_file.replace(".rb", "").split("/"):
        tokens.update(re.split(r"_", segment))
    # Drop noise: short words and path components that aren't domain names
    tokens -= {"rb", "app", "models", "controllers", "lib", "gems", ""}
    meaningful = {t for t in tokens if len(t) > 3}

    # Also compute an exact-stem for the app file to give a scoring bonus
    # when the spec filename matches the app filename directly.
    # e.g. "users_controller.rb" → exact_stem = "users_controller"
    exact_stem = basename  # e.g. "users_controller", "courses_controller", "course"

    matched = {}   # citation → score
    for row in delete_covered_rows:
        cov = row.get("existing_coverage", "")
        if not cov or cov in matched:
            continue
        spec_path = cov.rsplit(":", 1)[0]
        spec_base = os.path.basename(spec_path).replace("_spec.rb", "")
        # Base score: count of meaningful tokens found in the spec basename
        score = sum(1 for t in meaningful if t in spec_base)
        if score == 0:
            continue
        # Bonus +10 when the spec file is a direct spec for this app file
        # (e.g. users_controller_spec for users_controller, course_spec for course)
        if exact_stem == spec_base or exact_stem + "_spec" == spec_base:
            score += 10
        matched[cov] = score

    # Return sorted by score descending (best / most-specific match first)
    return [c for c, _ in sorted(matched.items(), key=lambda x: (-x[1], x[0]))]
```

#### 9c. Verify each citation

For every citation returned by `citations_for_lost_file`, verify it is still
valid (the audit CSV may have been generated days ago):

```python
def verify_citation(citation):
    """
    Returns (ok: bool, snippet: str).
    ok=True  → file exists, line in bounds, looks like a test definition.
    ok=False → file missing, line out of bounds, or no test context found.
    """
    parts = citation.rsplit(":", 1)
    if len(parts) != 2 or not parts[1].isdigit():
        return False, "malformed citation"
    path, lineno = parts[0], int(parts[1])
    try:
        lines = open(path).readlines()
    except FileNotFoundError:
        return False, "file not found"
    if lineno > len(lines):
        return False, f"line {lineno} out of bounds ({len(lines)} lines)"
    window = "".join(lines[max(0, lineno - 3):lineno + 2])
    if any(kw in window for kw in ('it "', "it '", 'describe ', 'context ')):
        return True, lines[lineno - 1].strip()[:70]
    return False, "no test context near cited line"
```

#### 9d. Assign citations to lost lines and flag gaps

Attribution works at **file granularity**, not line granularity. SimpleCov
produces aggregate coverage (all tests merged), so we know which app file lost
lines but cannot attribute individual lost lines to individual deleted tests
without per-test Crystalball coverage maps. The citation shown in the report is
the best-matching spec for the lost *file*, not necessarily for that specific
*line*. This is accurate enough to determine whether coverage is retained.

For each lost production file:
1. Call `citations_for_lost_file(app_file, delete_covered_rows)` to get candidates.
2. Take the **first (highest-score) verified** citation. If verification fails,
   try the next candidate. If all fail, mark as `⚠ citation unverified`.
3. If `citations_for_lost_file` returns an empty list, mark as
   `⚠ no citation — uncovered` and set `all_cited = False`.

A lost file with `⚠ no citation` means a `WRITE_NEW` or `PARTIAL` selenium test
was actually exercising production code — that coverage is genuinely lost.
Include it prominently in the report and set the verdict to ⚠️ or ❌.

### 10. Write `report.md`

Structure:

```markdown
# Selenium Coverage Compare — spec/selenium/<directory>
Generated: <timestamp>

## Runs

| | Current (<sha>) | Base (<base-ref>) |
|---|---|---|
| Tests | N | M |
| Passed | n | m |
| Failed | f1 | f2 |
| Pending | p1 | p2 |
| Covered lines | L1 | L2 |
| Coverage % | C1% | C2% |
| Duration | T1 | T2 |

## Coverage delta

**Lines uniquely covered by base (lost after trimming): X**
**Production lines lost: Y**
**Test-infrastructure lines lost: Z**

### Production losses (Y lines across N files)

[table: file | lines lost | what they are | cited lower-level spec]

### Test infrastructure losses (Z lines — harmless)

[bulleted list of page objects / helpers no longer exercised]

## Verdict

[One of:]
- ✅ **Zero production coverage loss.** All N production lines lost from the
  selenium layer are covered by cited lower-level specs. Safe to merge.
- ⚠️ **Minimal production loss (N lines).** Review the table above.
- ❌ **Significant production loss (N lines, M uncited).** Do not merge until
  lower-level coverage is added for the uncited lines.
```

Print the verdict to the user as well as the report path.

## Notes and hard-won lessons

**Named volume vs bind mount**: Canvas's `docker-compose.local.dev.yml` mounts
`tmp` as a named volume (`tmp:/usr/src/app/tmp`), not a host bind mount. Files
written to `coverage/` or `tmp/` inside the container are NOT visible at `./tmp`
on the host. Always `docker cp` to extract coverage JSON.

**Single pipeline = one background task**: The biggest ergonomic win. Doing two
separate background rspec runs with manual file-swapping between them requires
human intervention and doubles the wait time from the user's perspective. The
pipeline script handles both runs atomically.

**`|| true` on rspec**: Selenium tests can and will fail for environmental
reasons (missing optimized JS, React deprecation warnings surfaced as JS errors,
flaky timing). A non-zero exit from rspec must not abort the pipeline or the
second run's coverage never gets written.

**`git show` not `git checkout` for file swap**: `git checkout <ref> -- <file>`
stages the file (modifies the index). `git show <ref>:<file> > <file>` only
modifies the working tree. Using checkout would make `git status` look dirty and
could interfere with subsequent git operations inside the pipeline.

**ARM64 (Apple Silicon)**: The official `selenium/standalone-chrome` image has
no ARM64 manifest. Use `seleniarm/standalone-chromium:latest` instead. Detect
architecture with `uname -m` (returns `arm64` on Apple Silicon).

**Seed parity**: SimpleCov merges results across parallel runs using
`command_name`. When comparing two sequential single-process runs this is not an
issue — each run gets a unique PID-based command name. Do not pass `--seed` to
force identical ordering between the two rspec runs; random ordering is fine and
coverage totals are order-independent.

**Coverage files from failing tests are still valid**: SimpleCov writes the
`.resultset.json` even when tests fail (the `Stopped processing SimpleCov`
message appears AFTER the file is written). The coverage data represents every
line that was executed before any error, which is exactly what we want for the
comparison.

**`spec/` file losses are noise**: When comparing selenium-trimmed vs
selenium-original, you will always see some `spec/selenium/...` page-object or
helper methods become uncovered. This is expected — those helpers only existed to
serve the deleted tests. Do not flag them as problems or include them in the
production-loss count.
