# BTS-F6: Fails Gate 2 — Canvas-only operation (APT)

**Key:** BTS-F6
**Summary:** Gradebook column sort order wrong for NQ-backed assignments
**Resolution:** Done
**Status:** Closed
**Components:** New Quizzes, Gradebook
**Labels:** bts-fixture

## Description

When sorting the gradebook by assignment due date, assignments backed by New Quizzes appear in the wrong position. They sort by creation date instead of due date, causing them to appear out of order relative to other assignments.

Steps to reproduce:
1. Create a course with 5 assignments, 2 of which are New Quizzes
2. Set due dates so the NQ assignments fall between the regular assignments
3. Open the gradebook and sort by due date
4. NQ assignments appear at the end instead of in their due-date position

Expected: All assignments sort by due date regardless of type.
Actual: NQ assignments sort by creation date.

## Comments

**Comment 1 (most recent):**
Gerrit merge: "Fix gradebook column sort to use due_at for all assignment types. The sort comparator was falling back to created_at when the assignment's submission_types included 'external_tool', which affected NQ and all other LTI-backed assignments."

**Comment 2:**
This is a gradebook rendering bug. The same issue would occur with any external tool assignment, not just NQ. The fix is in the gradebook's JavaScript sort function.
