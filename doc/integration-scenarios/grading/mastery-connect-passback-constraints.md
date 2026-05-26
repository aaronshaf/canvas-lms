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

**Scenario MC-3.2 — Tracker unlinked with preserve-content option stops grade passback**
- **GUID:** `9c1a5f73`
- **Reason:** Grades continue flowing to Canvas for a decommissioned tracker if the passback channel is not severed on unlink.
```
Given a Canvas course with a linked Mastery Connect tracker
And a published Mastery Connect assessment assignment exists in the course
And the teacher unlinks the tracker using the "unlink tracker only" option
When Mastery Connect attempts to post a new score for a student on that assessment
Then the score does not appear in the Canvas Gradebook
```

**Scenario MC-3.3 — Tracker unlinked with remove-content option deletes assignments from Canvas**
- **GUID:** `73f1a6c9`
- **Reason:** Orphaned assignments and stale grades remain in Canvas if the remove-content unlink does not clean up the Canvas side.
```
Given a Canvas course with a linked Mastery Connect tracker
And multiple Mastery Connect assessment assignments exist in the course
When the teacher unlinks the tracker using the "unlink tracker and remove content" option
Then the Mastery Connect assessment assignments are removed from the Canvas Assignments list
And the grades for those assignments are removed from the Canvas Gradebook
```

**Scenario MC-3.4 — Previously linked assignments persist after preserve-content unlink**
- **GUID:** `52c9b3e7`
- **Reason:** Teachers lose track of formerly-linked MC assessment assignments if they are silently deleted when the tracker is unlinked.
```
Given a Canvas course with a linked Mastery Connect tracker
And several Mastery Connect assessment assignments exist in the course with student grades
When the teacher unlinks the tracker using the "unlink tracker only" option
Then the previously linked assessment assignments remain in the Canvas Assignments list
And the existing student grades remain in the Canvas Gradebook
And no new grades from Mastery Connect are posted to those assignments
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
