# Scenarios: Passback Constraints

**Source KB articles:**
- [662067 — How do I add an assessment to a Mastery Tracker in Canvas?](https://community.instructure.com/en/kb/articles/662067-how-do-i-add-an-assessment-to-a-mastery-tracker-in-canvas)
- [662065 — How do I move a tracker from one Canvas course to another?](https://community.instructure.com/en/kb/articles/662065-how-do-i-move-a-tracker-from-one-canvas-course-to-another)
- [662066 — How do I unlink a tracker from a Canvas course?](https://community.instructure.com/en/kb/articles/662066-how-do-i-unlink-a-tracker-from-a-canvas-course)
- [662077 — How do I use SpeedGrader in a Mastery Connect assessment in a Canvas course?](https://community.instructure.com/en/kb/articles/662077-how-do-i-use-speedgrader-in-a-mastery-connect-assessment-in-a-canvas-course)

**Integration:** Canvas LMS ↔ Mastery Connect

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

**Scenario MC-3.2 — Canvas still accepts passback after a preserve-content unlink or tracker move (negative control)**
- **GUID:** `9c1a5f73`
- **Reason:** Grades silently stop posting or the assignment disappears if Canvas wrongly treats a preserve-content unlink or tracker move as a reason to reject a later passback, when those upstream actions should leave the assignment and its grades untouched.
```
Given a Canvas course with a linked Mastery Connect tracker
And a published Mastery Connect assessment assignment with an existing student grade
And the teacher unlinks the tracker with "preserve content" or moves it to another course
When Mastery Connect posts a new score for the student on that assessment
Then Canvas accepts the score with no awareness of the unlink or move
And the assignment remains in the course's Assignments list
```

**Scenario MC-3.3 — Tracker unlinked with remove-content option deletes assignments from Canvas**
- **GUID:** `73f1a6c9`
- **Reason:** Orphaned assignments and stale grades remain in Canvas if the remove-content unlink does not clean up the Canvas side.
```
Given a Canvas course with a linked Mastery Connect tracker
And a Mastery Connect assessment assignment exists in the course with a student grade
When mc-mothership deletes the assignment (the "unlink tracker and remove content" path)
Then the assignment is removed from the Canvas Assignments list
And the grade for that assignment no longer counts in the Canvas Gradebook
```
