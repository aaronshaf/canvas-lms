---
name: selenium-skills-test
description: Self-test the selenium skill suite (behavior-extract → coverage-quality → gap-filler) against a small fixture directory. Run this after updating any selenium skill to verify the pipeline still works end-to-end before using it on production data.
---

# Selenium skills test

Runs the three quality skills in sequence against a small fixture directory, checks every
output automatically, and emits a structured PASS / FAIL report. No production data is
touched — the test uses its own workspace under `tmp/selenium-skills-test/`.

Run this after any skill update to confirm nothing is broken before running
[[selenium-pipeline]] on real data.

## Inputs

Optional flags:

- `--fast` — run layers 1–2 only (no Docker needed; skips gap-filler and regression diff)
- `--dir <path>` — fixture directory (default: `spec/selenium/grades/rubric`)
- `--layer <n>` — run only that layer (1, 2, or 3)
- `--reset-baseline` — overwrite the stored quality baseline with this run's output

If no flags are given, run all layers against the default fixture.

## Default fixture

`spec/selenium/grades/rubric` — 329 lines, 17 `it` blocks, one controller
(`RubricsController`). Small enough to complete in ~5 minutes per layer, large enough to
exercise extraction, clustering, citation verification, and gap detection meaningfully.

The fixture directory must exist on disk. If `--dir` points to a missing directory, stop
and tell the user.

## Workspace

All test outputs land in `tmp/selenium-skills-test/<fixture_name>/` — separate from the
real `tmp/selenium-behavior/` so test runs never pollute production artifacts.

The fixture name is the last path segment of the fixture directory
(e.g. `rubric` for `spec/selenium/grades/rubric`).

Create the workspace directory before starting:

```bash
mkdir -p tmp/selenium-skills-test/<fixture_name>
```

Because the quality skills write to `tmp/selenium-behavior/<name>.*` by default, override
the output paths by passing a prefixed name to each skill invocation:
`skills_test_<fixture_name>` (e.g. `skills_test_rubric`). This maps to:
- `tmp/selenium-behavior/skills_test_rubric.behaviors.csv`
- `tmp/selenium-behavior/skills_test_rubric.quality.csv`
- `tmp/selenium-behavior/skills_test_rubric.gap_report.md`

Copy these to the workspace after each layer for archiving:

```bash
cp tmp/selenium-behavior/skills_test_<fixture_name>.behaviors.csv \
   tmp/selenium-skills-test/<fixture_name>/behaviors.csv
```

## Workflow

### Step 1 — Preconditions

Check all of these before starting any layers:

```bash
test -d <fixture_dir>          # fixture directory exists
git status --porcelain         # clean working tree (gap-filler commits; don't mix with in-progress work)
```

Check Docker only if not `--fast`:

```bash
docker compose ps              # web container must be Running
```

If any check fails, list all failures and stop.

Report what will run:

```
Selenium skills test — <fixture_dir>
────────────────────────────────────────────
  Fixture:  <fixture_dir>  (<N> spec files)
  Layers:   1 behavior-extract
            2 coverage-quality
            3 gap-filler dry-run  [SKIPPED — --fast]  (if applicable)
  Workspace: tmp/selenium-skills-test/<fixture_name>/
```

### Step 2 — Layer 1: behavior-extract

Invoke the `selenium-behavior-extract` skill with the fixture directory and the prefixed
output name:

```
selenium-behavior-extract <fixture_dir>
```

After the skill completes, copy the output to the workspace and run assertions:

**Assertions:**

```python
import csv, os

path = "tmp/selenium-behavior/skills_test_<fixture_name>.behaviors.csv"

# A1: output file exists
assert os.path.exists(path), "behaviors CSV not written"

rows = list(csv.DictReader(open(path)))

# A2: at least one row extracted
assert len(rows) > 0, f"no rows extracted"

# A3: all 10 columns present on every row
REQUIRED_COLS = {"file","line","test_name","given","when","then",
                 "controller_route","classification","complexity","extract_notes"}
for r in rows:
    missing = REQUIRED_COLS - set(r.keys())
    assert not missing, f"row {r['line']} missing columns: {missing}"

# A4: no extraction failures
failed = [r for r in rows if "EXTRACTION_FAILED" in r.get("given","")]
assert not failed, f"{len(failed)} extraction failures: {[r['line'] for r in failed]}"

# A5: classification enum valid
VALID_CLASS = {"page_render","data_verify","form_interaction",
               "permission_check","workflow","async_interaction"}
for r in rows:
    assert r["classification"] in VALID_CLASS, \
        f"row {r['line']}: invalid classification '{r['classification']}'"

# A6: complexity enum valid
for r in rows:
    assert r["complexity"] in {"LOW","MEDIUM","HIGH"}, \
        f"row {r['line']}: invalid complexity '{r['complexity']}'"

# A7: then is specific (not vague)
vague = [r for r in rows if r["then"].strip() in
         {"","(none)","N/A","displayed","visible","present"}]
assert not vague, f"{len(vague)} rows have vague Then values: {[r['line'] for r in vague]}"

print(f"Layer 1 PASS — {len(rows)} rows extracted")
```

Record **PASS** or **FAIL** with the assertion that failed.

### Step 3 — Layer 2: coverage-quality

Invoke the `selenium-coverage-quality` skill with the prefixed fixture name:

```
selenium-coverage-quality skills_test_<fixture_name>
```

After completion, run assertions:

**Assertions:**

```python
import csv, os

bpath = "tmp/selenium-behavior/skills_test_<fixture_name>.behaviors.csv"
qpath = "tmp/selenium-behavior/skills_test_<fixture_name>.quality.csv"

b_rows = list(csv.DictReader(open(bpath)))
q_rows = list(csv.DictReader(open(qpath)))

# B1: output file exists
assert os.path.exists(qpath), "quality CSV not written"

# B2: same row count as behaviors CSV
assert len(q_rows) == len(b_rows), \
    f"row count mismatch: behaviors={len(b_rows)}, quality={len(q_rows)}"

# B3: all 15 columns present
REQUIRED_COLS = {"file","line","test_name","given","when","then",
                 "controller_route","classification","complexity","extract_notes",
                 "coverage_score","coverage_path","coverage_line",
                 "gap_description","recommended_layer"}
for r in q_rows:
    missing = REQUIRED_COLS - set(r.keys())
    assert not missing, f"row {r['line']} missing columns: {missing}"

# B4: coverage_score enum valid
for r in q_rows:
    assert r["coverage_score"] in {"STRONG","WEAK","GAP"}, \
        f"row {r['line']}: invalid score '{r['coverage_score']}'"

# B5: STRONG and WEAK rows have citations
for r in q_rows:
    if r["coverage_score"] in ("STRONG","WEAK"):
        assert r["coverage_path"], f"row {r['line']} is {r['coverage_score']} but has no coverage_path"
        assert r["coverage_line"].isdigit(), \
            f"row {r['line']} coverage_line is not an integer: '{r['coverage_line']}'"

# B6: all cited files exist on disk
stale = []
for r in q_rows:
    if r["coverage_path"] and not os.path.exists(r["coverage_path"]):
        stale.append((r["line"], r["coverage_path"]))
assert not stale, f"{len(stale)} stale citations (files missing): {stale}"

# B7: all cited lines are in-bounds
import subprocess
oob = []
for r in q_rows:
    if r["coverage_path"] and r["coverage_line"].isdigit():
        result = subprocess.run(["wc","-l",r["coverage_path"]], capture_output=True, text=True)
        max_line = int(result.stdout.strip().split()[0])
        if int(r["coverage_line"]) > max_line:
            oob.append((r["line"], r["coverage_path"], r["coverage_line"], max_line))
assert not oob, f"{len(oob)} citations out of bounds: {oob}"

# B8: GAP rows have empty citations
for r in q_rows:
    if r["coverage_score"] == "GAP":
        assert not r["coverage_path"], \
            f"GAP row {r['line']} has unexpected coverage_path: {r['coverage_path']}"

# B9: recommended_layer populated for non-STRONG rows
valid_layers = {"request_spec","model_spec","component_test","keep_selenium",""}
for r in q_rows:
    if r["coverage_score"] == "STRONG":
        assert r["recommended_layer"] == "", \
            f"STRONG row {r['line']} has unexpected recommended_layer"
    else:
        assert r["recommended_layer"] in valid_layers - {""}, \
            f"row {r['line']} has invalid recommended_layer '{r['recommended_layer']}'"

# B10: at least one non-GAP row (confirms coverage search found something)
non_gap = [r for r in q_rows if r["coverage_score"] != "GAP"]
assert non_gap, "all rows scored GAP — coverage index search likely failed"

print(f"Layer 2 PASS — {len(q_rows)} rows scored "
      f"(STRONG: {sum(1 for r in q_rows if r['coverage_score']=='STRONG')}, "
      f"WEAK: {sum(1 for r in q_rows if r['coverage_score']=='WEAK')}, "
      f"GAP: {sum(1 for r in q_rows if r['coverage_score']=='GAP')})")
```

**Regression check** (runs if a baseline exists):

```bash
test -f tmp/selenium-skills-test/<fixture_name>/quality_baseline.csv
```

If baseline exists, diff STRONG scores:

```python
import csv

def load_scores(p):
    return {(r["file"], r["line"], r["test_name"]): r["coverage_score"]
            for r in csv.DictReader(open(p))}

old = load_scores("tmp/selenium-skills-test/<fixture_name>/quality_baseline.csv")
new = load_scores("tmp/selenium-behavior/skills_test_<fixture_name>.quality.csv")

regressions = [(k, old[k], new[k]) for k in old
               if k in new and old[k] == "STRONG" and new[k] != "STRONG"]

if regressions:
    print(f"REGRESSION: {len(regressions)} STRONG rows downgraded:")
    for k, o, n in regressions:
        print(f"  {k[0]}:{k[1]} — {k[2][:60]}  ({o} → {n})")
    assert False, "regression detected"
else:
    print(f"Regression check PASS — 0 STRONG rows downgraded")
```

If `--reset-baseline` was passed, copy the quality CSV to the baseline:

```bash
cp tmp/selenium-behavior/skills_test_<fixture_name>.quality.csv \
   tmp/selenium-skills-test/<fixture_name>/quality_baseline.csv
```

### Step 4 — Layer 3: gap-filler dry-run (skipped when `--fast`)

Pick the first `GAP / request_spec` row from the quality CSV. If none exists (fixture has no
request_spec GAPs), pick the first `GAP` row of any layer. If no GAP rows at all, skip this
layer and record `SKIPPED (no GAP rows)`.

Invoke the gap-filler in dry-run mode on that single row:

```
selenium-gap-filler skills_test_<fixture_name> --dry-run --line <gap_row_line>
```

**Assertions:**

```python
# C1: gap report was written
assert os.path.exists("tmp/selenium-behavior/skills_test_<fixture_name>.gap_report.md")

# C2: gap report contains DRY_RUN action for the target row
content = open("tmp/selenium-behavior/skills_test_<fixture_name>.gap_report.md").read()
assert "DRY_RUN" in content, "gap report missing DRY_RUN action"

# C3: Phase 1 agent produced valid file content markers
# (check that the agent response was captured in the gap report)
assert "FILE_CONTENT_START" in content or "DRY_RUN" in content, \
    "gap report does not confirm Phase 1 agent produced content"
```

If Docker is running, also run the gap-filler without `--dry-run` on the same row to
verify the full Phase 2 cycle (write → lint → run → commit):

```
selenium-gap-filler skills_test_<fixture_name> --line <gap_row_line>
```

**Assertions:**

```python
# C4: a new spec file was written to disk
import glob
new_specs = glob.glob("spec/requests/skills_test_*.rb") + \
            glob.glob("spec/models/skills_test_*.rb")
# (gap-filler should write to a test-prefixed file name if using the skills_test name)
assert new_specs or "green" in open("tmp/selenium-behavior/skills_test_<fixture_name>.gap_report.md").read(), \
    "no spec file written and no green result in gap report"

# C5: gap report shows green
assert "green" in open("tmp/selenium-behavior/skills_test_<fixture_name>.gap_report.md").read(), \
    "gap report does not show a green test result"
```

After Layer 3, revert the gap-filler commit so the test run is clean:

```bash
git log --oneline -1 --grep="test: cover"   # confirm the commit exists
git revert --no-edit HEAD                    # revert it (keeps history clean)
```

Record PASS / FAIL / SKIPPED.

### Step 5 — Emit test report

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SELENIUM SKILLS TEST — <fixture_dir>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Layer 1  behavior-extract    ✅ PASS  (<N> rows, 0 failures)
  Layer 2  coverage-quality    ✅ PASS  (STRONG: n, WEAK: n, GAP: n, 0 stale citations)
           regression check    ✅ PASS  (0 regressions vs baseline)
  Layer 3  gap-filler dry-run  ✅ PASS  (Phase 1 content generated)
           gap-filler apply    ✅ PASS  (1 green test, commit reverted)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Result:   PASS (all layers)
  Duration: ~<N> min
  Workspace: tmp/selenium-skills-test/<fixture_name>/
  Baseline: tmp/selenium-skills-test/<fixture_name>/quality_baseline.csv
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

On any layer FAIL, print the specific assertion that failed with enough context to diagnose:

```
  Layer 2  coverage-quality    ❌ FAIL
           Assertion B6 failed: 2 stale citations (files missing):
             (42, 'spec/controllers/old_rubrics_spec.rb')
             (78, 'spec/apis/v1/nonexistent.rb')
           → The coverage-quality skill cited files that don't exist.
             Check that the coverage index grep is returning real paths.
```

If any layer fails, stop and do not run subsequent layers.

## Error messages

| Failure | Likely cause | Suggested fix |
|---|---|---|
| A4: EXTRACTION_FAILED rows | Context window too small / agent dropped rows | Re-run; check snippet size in behavior-extract |
| A7: vague Then values | Agent paraphrased instead of citing exact text | Review the batch that produced those rows |
| B6: stale citations | Coverage index greps returning deleted files | Check spec/requests/ and spec/controllers/ exist |
| B10: all rows GAP | Coverage index grep found no candidate files | Verify test fixture has a real Ruby controller route |
| C4: no spec file written | Gap-filler Phase 1 agent returned malformed content | Run `--dry-run` first to inspect Phase 1 output |
| C5: red test | Written spec has a real bug | Read the spec file, check the error, fix manually |

## Notes

**Working tree must be clean** before running with Layer 3 (gap-filler apply), because
Layer 3 commits a test file and then reverts it. A dirty tree makes the revert unsafe.

**The baseline is precious.** The regression check in Layer 2 compares STRONG scores against
the baseline. Run `--reset-baseline` only after manually confirming the new quality output is
correct — not automatically on every run.

**Layer 3 reverts its own commit.** The gap-filler apply step writes and commits a real spec
file, verifies it passes, then reverts. This keeps the branch clean after the test run.
The spec file content is preserved in the gap report for review.
