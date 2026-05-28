# BTS-F4: Filtered out — non-Done resolution

**Key:** BTS-F4
**Summary:** New Quizzes score doubled in gradebook after regrade
**Resolution:** Won't Do
**Status:** Closed
**Components:** New Quizzes, Grades
**Labels:** bts-fixture

## Description

After a teacher regrades a New Quizzes quiz, the student's score appears doubled in the gradebook. For example, a student who scored 8/10 shows as 16/10 after regrade.

Steps to reproduce:
1. Create a New Quizzes quiz
2. Student completes the quiz and receives 8/10
3. Teacher regrades one question
4. Gradebook shows 16/10

Expected: Gradebook shows the updated score (e.g., 9/10 if the regrade added a point).
Actual: Score is doubled.

## Comments

**Comment 1 (most recent):**
Closing as Won't Do. After investigation, this was a one-time data issue caused by a manual database intervention on a specific shard. The customer's data has been corrected. The passback handler logic is correct — the doubled score was caused by a duplicate submission record, not by the passback itself.

**Comment 2:**
Cannot reproduce in any test environment. Requesting data access to investigate the customer's specific shard.
