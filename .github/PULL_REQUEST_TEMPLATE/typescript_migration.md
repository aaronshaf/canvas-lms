## TypeScript Migration: [Feature Name]

### Summary
Migrate InstUI-importing files in `ui/features/<feature>` from JavaScript to TypeScript.

### Files Changed
<!-- List files being converted -->
- [ ] `path/to/file1.jsx` → `path/to/file1.tsx`
- [ ] `path/to/file2.js` → `path/to/file2.ts`

### Migration Details
- **Feature folder**: `ui/features/<feature>`
- **Files migrated**: X
- **Type suppressions added**: Y `@ts-expect-error` comments

### Validation Checklist
- [ ] `yarn lint` passes
- [ ] `yarn check:biome` passes
- [ ] `npx tsc --noEmit` passes (entire codebase)
- [ ] No `as` type casts used (except `as const`)
- [ ] No `any` types used
- [ ] All `@ts-expect-error` comments include explanations

### Code Review
- [ ] Codex implementation completed
- [ ] Opus code review passed
- [ ] Refactoring based on Opus feedback (if any)

### Gerrit Tracking
- **Jira**: CFA-436
- **Gerrit Change-Id**: (to be added after push)
- **Gerrit URL**: (to be added after push)

### Notes
<!-- Any special considerations, known issues, or discussion points -->

---
*This PR will be closed automatically when pushed to Gerrit.*
