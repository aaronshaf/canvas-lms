# Parallel TypeScript Migration Workflow (v2 - Improved)

## Key Improvements from v1 Failures:
1. ✅ Explicit ALL-CI validation before Gerrit
2. ✅ Staged workflow with validation gates
3. ✅ Less autonomous agents, more orchestration
4. ✅ Proper cleanup procedures

## Pilot #2 Results (2026-02-14) ✅ SUCCESSFUL

Successfully completed 2 parallel migrations using improved workflow:
- **outcome_alignments** → Gerrit 401088 (CI passed after rerun)
- **past_global_alert** → Gerrit 401087 (CI passed first try)

### Critical Bug Fixed
**wait-for-ci-complete.sh** was checking for `state == "PENDING"` but GitHub Actions uses `state == "IN_PROGRESS"`. This caused false positives where script reported "all checks passed" when checks were still running. Fixed by changing line 35 to check for `"IN_PROGRESS"` instead.

### Key Learnings
1. **Flaky tests handled successfully** - Used `retrigger-flaky` skill to rerun 3 failed UI test shards on PR #21
2. **Gerrit reviewers** - Add Canvas-Frontend team manually via Gerrit UI (ger CLI doesn't have direct command)
3. **Orchestrated approach works** - Claude orchestrating with clear validation gates prevented premature Gerrit pushes
4. **Workflow validated** - Ready to scale to 3-5 parallel migrations

## Workflow Stages

### Stage 1: Local Migration (Per Feature)
**Orchestrator:** Claude (main)
**Execution:** Codex

```bash
# 1. Create worktree
cd ~/inst/canvas-lms-readonly
wt switch --create ts-<feature> -y

# 2. Spawn Codex for migration
codex exec --full-auto "Migrate ui/features/<feature> to TypeScript..."

# 3. Wait for Codex completion
# (Monitor for .tsx file creation)

# 4. Local validation
cd ~/inst/canvas-lms-readonly.ts-<feature>
yarn lint
yarn biome:fix
npx tsc --noEmit 2>&1 | grep -i "<feature>" || echo "✅ No TS errors"

# 5. Commit
git add ui/features/<feature>/
git commit -m "chore: migrate ui/features/<feature> to TypeScript

refs CFA-436
flag=none"
```

**Gate:** Local validation must pass before Stage 2

### Stage 2: CI Validation (GitHub PR)
**Orchestrator:** Claude (main)

```bash
# 1. Push to PR
cd ~/inst/canvas-lms-readonly.ts-<feature>
git push -u origin ts-<feature>
gh pr create --repo instructure-internal/canvas-lms-readonly \
  --title "chore: migrate ui/features/<feature> to TypeScript" \
  --body "refs CFA-436" \
  --base main

# 2. Get PR number
PR_NUM=$(gh pr view --json number -q .number)

# 3. CRITICAL: Wait for ALL CI checks to pass
.taskmaster/scripts/wait-for-ci-complete.sh "$PR_NUM" 30

# If exit code != 0, CI failed - STOP and fix
```

**Gate:** ALL CI checks must pass (not just subset) before Stage 3

### Stage 3: Port to Gerrit
**Orchestrator:** Claude (main)

```bash
# 1. Create Gerrit worktree
cd ~/inst/canvas-lms
wt switch --create ts-<feature> -y

# 2. Apply patch from readonly
cd ~/inst/canvas-lms-readonly.ts-<feature>
COMMIT_SHA=$(git rev-parse HEAD)
git format-patch -1 "$COMMIT_SHA" -o /tmp/
PATCH_FILE="/tmp/0001-*.patch"

cd ~/inst/canvas-lms.ts-<feature>
git apply -3 "$PATCH_FILE"

# 3. Copy .tool-versions if needed
cp ~/inst/canvas-lms/.tool-versions .

# 4. Push to Gerrit
git add ui/features/<feature>/
git commit -m "chore: migrate ui/features/<feature> to TypeScript

refs CFA-436
flag=none"

ger push

# 5. Add reviewers
# Manual: Add Canvas-Frontend team via Gerrit UI
# Auto: Add file history reviewers
git log --format='%ae' -20 -- ui/features/<feature>/ | sort -u | head -5
```

**Gate:** Gerrit push succeeds before Stage 4

### Stage 4: Cleanup
**Orchestrator:** Claude (main)

```bash
# 1. Close readonly PR (don't merge!)
gh pr close "$PR_NUM" --repo instructure-internal/canvas-lms-readonly \
  --comment "CI passed ✅ - Pushed to Gerrit for review"

# 2. Remove readonly worktree (optional - can keep for reference)
# cd ~/inst/canvas-lms-readonly
# wt remove ts-<feature> -f
```

## Parallel Execution Strategy

**Run 2-3 migrations in parallel** (not 5+ to avoid overwhelming CI)

- Each migration follows Stages 1-4 independently
- Stagger PR creation by 2-3 minutes to avoid CI queue contention
- Monitor all PRs centrally, don't let any proceed to Stage 3 until their CI passes

## Rollback Procedures

**If Stage 1 fails:**
- Delete worktree
- Mark task as blocked
- Move to next feature

**If Stage 2 fails (CI):**
- Check if failures related to migration
- If yes: Fix in worktree, amend commit, force push, wait again
- If no (flaky tests): Use `/retrigger-flaky <PR_NUM>` skill to rerun failed checks, wait again
- If consistently flaky after 2+ retriggers: Document and proceed anyway (after user approval)

**If Stage 3 fails (Gerrit):**
- Check error
- Fix and re-push with `ger push`
- Don't create new Gerrit change

**If any stage fails 2+ times:**
- Mark task as blocked
- Close PR if created
- Remove worktrees
- Move to next feature

## Success Criteria

✅ Local validation passed
✅ ALL CI checks passed (verified with wait-for-ci-complete.sh)
✅ Gerrit change created successfully
✅ Reviewers added
✅ Readonly PR closed (not merged)
