# BTS-F2: Clear pass — passback constraint

**Key:** BTS-F2
**Summary:** NQ passback posts grade despite manual posting policy
**Resolution:** Done
**Status:** Closed
**Components:** New Quizzes, Grades
**Labels:** bts-fixture

## Description

When a teacher sets a manual posting policy on an assignment backed by New Quizzes, grades from NQ passback are automatically visible to students. The manual posting policy should prevent auto-posting of grades.

Steps to reproduce:
1. Create a New Quizzes assignment
2. Set the posting policy to "Manual" in the gradebook
3. Student completes the quiz
4. NQ passes back the grade
5. Student can immediately see their grade in the gradebook

Expected: Grade is recorded but hidden (posted = false) until the teacher manually posts grades.
Actual: Grade is visible to the student immediately after passback.

## Comments

**Comment 1 (most recent):**
Gerrit merge: "Respect manual posting policy during NQ grade passback. When a submission is updated via LTI grade passback, check the assignment's post_policy before setting posted_at. If the policy is manual, leave posted_at as nil."

**Comment 2:**
Root cause: the passback handler was calling `submission.update!(posted_at: Time.now)` unconditionally instead of checking the assignment's post policy.

**Comment 3:**
This also affects Mastery Connect passback but the fix is in the shared passback handler so both are covered.
