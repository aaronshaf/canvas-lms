# BTS-F5: Fails Gate 1 — not grading-related

**Key:** BTS-F5
**Summary:** New Quizzes print preview button broken in SpeedGrader
**Resolution:** Done
**Status:** Closed
**Components:** New Quizzes, SpeedGrader
**Labels:** bts-fixture

## Description

The "Print" button in SpeedGrader for New Quizzes submissions does not work. Clicking it opens a blank browser tab instead of a print-friendly preview of the student's quiz responses.

Steps to reproduce:
1. Create a New Quizzes assignment
2. Student completes the quiz
3. Teacher opens SpeedGrader for the assignment
4. Click the "Print" button in the submission view
5. A blank tab opens; no content is rendered

Expected: A print-friendly view of the student's quiz responses opens.
Actual: Blank browser tab.

## Comments

**Comment 1 (most recent):**
Gerrit merge: "Fix NQ print preview URL generation in SpeedGrader. The iframe postMessage handler was constructing the print URL with an incorrect quiz_session_id parameter format."

**Comment 2:**
This is a SpeedGrader rendering issue. No grade data is affected — the print preview is a read-only view of already-submitted responses.
