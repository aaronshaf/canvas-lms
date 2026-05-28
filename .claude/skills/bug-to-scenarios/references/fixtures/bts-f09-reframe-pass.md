# BTS-F9: Framing rule — reframe succeeds

**Key:** BTS-F9
**Summary:** Student names visible in SpeedGrader for anonymous NQ survey
**Resolution:** Done
**Status:** Closed
**Components:** New Quizzes, SpeedGrader
**Labels:** bts-fixture

## Description

When a teacher creates an anonymous New Quizzes survey and opens SpeedGrader to review responses, student names are visible next to their survey submissions. The survey is configured as anonymous but student identities are fully exposed in the grading interface.

Steps to reproduce:
1. Create a New Quizzes assignment configured as an anonymous survey
2. Multiple students complete the survey
3. Teacher opens SpeedGrader for the assignment
4. Student names and profile pictures are visible next to each submission

Expected: SpeedGrader shows anonymous identifiers (e.g., "Student 1", "Student 2") instead of real names.
Actual: Real student names and avatars are displayed.

## Comments

**Comment 1 (most recent):**
Gerrit merge: "Strip participant identity data from NQ passback for anonymous assignments. NQ was including student_id and participant_ordering in the grade passback payload for anonymous assignments. Canvas stored this data in the submission record, making it available through the submissions API and SpeedGrader. Now filter identity fields when the assignment has anonymous_grading enabled."

**Comment 2:**
The root cause is in the passback handler, not SpeedGrader. The submissions API (`GET /api/v1/courses/:id/assignments/:id/submissions`) returns user_id for anonymous assignments because the passback wrote it to the submission record. This is an API-level data leak.

**Comment 3:**
Verified: after the fix, the submissions API returns anonymous_id instead of user_id for anonymous assignments, and SpeedGrader displays anonymous identifiers.
