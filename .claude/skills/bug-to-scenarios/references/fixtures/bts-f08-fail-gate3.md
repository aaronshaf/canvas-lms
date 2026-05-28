# BTS-F8: Fails Gate 3 — not API-expressible

**Key:** BTS-F8
**Summary:** NQ drag-and-drop question reorder loses point values on passback
**Resolution:** Done
**Status:** Closed
**Components:** New Quizzes
**Labels:** bts-fixture

## Description

When a teacher reorders questions in the New Quizzes editor using drag-and-drop, the point values for some questions are reset to zero. When a student later completes the quiz, the passback sends incorrect total points to Canvas because the per-question points were lost during the reorder.

Steps to reproduce:
1. Create a New Quizzes quiz with 5 questions, each worth 2 points (10 total)
2. In the NQ editor, drag question 5 to position 2
3. Save the quiz
4. Some questions now show 0 points in the NQ editor
5. Student completes the quiz
6. Canvas gradebook shows a score out of 6 instead of 10

Expected: Reordering questions does not affect point values.
Actual: Some questions lose their point values after drag-and-drop reorder.

## Comments

**Comment 1 (most recent):**
Gerrit merge: "Fix NQ item bank drag-and-drop handler to preserve point_possible on reorder. The React DnD onDrop callback was reconstructing the question object without copying the points_possible field from the source item."

**Comment 2:**
The bug is in the NQ quiz editor's drag-and-drop JavaScript. The passback itself is correct — it sends whatever points NQ has stored. The data corruption happens in the NQ editor UI, which has no API equivalent. You must use the visual drag-and-drop editor to trigger this bug.
