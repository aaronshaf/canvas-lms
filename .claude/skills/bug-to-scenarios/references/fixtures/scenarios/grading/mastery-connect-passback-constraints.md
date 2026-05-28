# Scenarios: Passback Constraints

**Integration:** Canvas LMS <-> Mastery Connect

---

**Scenario MC-3.1 — Canvas marks submission as late when MC scores after the due date**
- **GUID:** `6e2b8d4f`
- **Reason:** On-time vs. late completion data is incorrect in the Canvas Gradebook if a post-due-date passback from Mastery Connect does not trigger the late flag on the submission.
```
Given a Canvas course with a linked Mastery Connect tracker
And a published Mastery Connect assessment assignment with a due date
And a student is enrolled in the course
And the due date has passed without the student completing the assessment
When Mastery Connect scores the student's assessment after the due date
Then the score appears in the Canvas Gradebook for that assignment
And the submission is marked as late
```

**Scenario MC-3.5 — Tracker moved to new course stops passback in original course**
- **GUID:** `ae824d1f`
- **Reason:** Grades incorrectly continue flowing to the original course's gradebook after the tracker has been moved elsewhere.
```
Given a Canvas course with a linked Mastery Connect tracker
And a published Mastery Connect assessment assignment exists in the course with student grades
And the teacher moves the tracker to a different Canvas course
When Mastery Connect attempts to post a new score for a student on the original course's assessment
Then the score does not appear in the original course's Canvas Gradebook
And the previously linked assessment assignments remain visible in the original course's Assignments list
```
