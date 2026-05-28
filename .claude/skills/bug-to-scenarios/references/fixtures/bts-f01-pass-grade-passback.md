# BTS-F1: Clear pass — grade passback

**Key:** BTS-F1
**Summary:** New Quizzes grade not recorded after quiz submission
**Resolution:** Done
**Status:** Closed
**Components:** New Quizzes
**Labels:** bts-fixture

## Description

When a student completes a New Quizzes auto-graded quiz, the score is not recorded in the Canvas gradebook. The student sees "Submitted" but no grade appears. This affects all auto-graded question types (multiple choice, matching, etc.).

Steps to reproduce:
1. Create a course with a New Quizzes assignment (auto-graded, 10 points)
2. Enroll a student
3. Student launches and completes the quiz
4. Check the Canvas gradebook — no score appears for the student

Expected: The student's score appears in the gradebook after quiz submission.
Actual: The gradebook cell remains empty.

## Comments

**Comment 1 (most recent):**
Gerrit merge: "Fix NQ grade passback handler to process auto-graded submissions. The passback callback was silently dropping scores when the quiz contained only auto-gradable question types because the `needs_manual_grading` flag was incorrectly set to true."

**Comment 2:**
Confirmed this is a regression introduced in the February release. The passback payload is correctly formed by NQ but Canvas's handler discards it.

**Comment 3:**
QA verified fix in staging. Scores now appear in the gradebook within seconds of quiz completion.
