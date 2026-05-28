# BTS-F7: Fails Gate 2 — fail list match

**Key:** BTS-F7
**Summary:** Set Default Grade doesn't apply to Mastery Connect assignments
**Resolution:** Done
**Status:** Closed
**Components:** Mastery Connect, Gradebook
**Labels:** bts-fixture

## Description

When a teacher uses the "Set Default Grade" feature in the gradebook on a Mastery Connect-backed assignment, the default grade is not applied to students who have no submission. Other assignment types work correctly.

Steps to reproduce:
1. Create a course with a Mastery Connect-backed assignment
2. Some students have scores from MC passback, others have no submission
3. Teacher clicks the assignment column header > "Set Default Grade" > enters "5"
4. Students without submissions still show no grade

Expected: Students without submissions receive the default grade of 5.
Actual: No change for students without submissions.

## Comments

**Comment 1 (most recent):**
Gerrit merge: "Fix Set Default Grade for external tool assignments. The default grade action was skipping submissions where submission_type was nil and the assignment had an external_tool submission type. Remove the submission_type check — default grade should apply regardless of how the assignment is backed."

**Comment 2:**
This is a Canvas gradebook operation. MC is not involved in the Set Default Grade action — Canvas applies the grade unilaterally to submissions that have no score.
