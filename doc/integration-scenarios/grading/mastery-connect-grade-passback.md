# Scenarios: Grade Passback

**Source KB articles:**
- [662061 — How do I use a Mastery Connect tracker in a Canvas course?](https://community.instructure.com/en/kb/articles/662061-how-do-i-use-a-mastery-connect-tracker-in-a-canvas-course)
- [662067 — How do I add an assessment to a Mastery Tracker in Canvas?](https://community.instructure.com/en/kb/articles/662067-how-do-i-add-an-assessment-to-a-mastery-tracker-in-canvas)
- [662071 — How do I administer a Mastery Connect assessment in my Canvas Course?](https://community.instructure.com/en/kb/articles/662071-how-do-i-administer-a-mastery-connect-assessment-in-my-canvas-course)
- [662074 — How do I create a Canvas assignment for my Mastery Connect tracker?](https://community.instructure.com/en/kb/articles/662074-how-do-i-create-a-canvas-assignment-for-my-mastery-connect-tracker)
- [662075 — How do I create a Canvas graded discussion for my Mastery Connect tracker?](https://community.instructure.com/en/kb/articles/662075-how-do-i-create-a-canvas-graded-discussion-for-my-mastery-connect-tracker)
- [662077 — How do I use SpeedGrader in a Mastery Connect assessment in a Canvas course?](https://community.instructure.com/en/kb/articles/662077-how-do-i-use-speedgrader-in-a-mastery-connect-assessment-in-a-canvas-course)

**Integration:** Canvas LMS ↔ Mastery Connect

---

**Scenario MC-1.1 — MC scores student assessment and grade appears in Canvas Gradebook**
- **GUID:** `3a7f1c4e`
- **Reason:** Teachers cannot see student performance in the Canvas Gradebook if Mastery Connect grade passback fails.
```
Given a Canvas course with a linked Mastery Connect tracker
And a published Mastery Connect assessment assignment exists in the course
And a student is enrolled in the course
When Mastery Connect scores the student's assessment
Then the student's score appears in the Canvas Gradebook for that assignment
```

**Scenario MC-1.2 — MC updates assessment score and Canvas Gradebook reflects the change**
- **GUID:** `8b2e5d91`
- **Reason:** Stale grades remain in the Canvas Gradebook if Mastery Connect score updates do not propagate.
```
Given a Canvas course with a linked Mastery Connect tracker
And a published Mastery Connect assessment assignment exists in the course
And a student has a previously graded score in the Canvas Gradebook for that assignment
When Mastery Connect updates the student's assessment score to a different value
Then the Canvas Gradebook reflects the updated score for that assignment
```

**Scenario MC-1.3 — MC scores assessment for all enrolled students and all grades appear**
- **GUID:** `5c4a9f72`
- **Reason:** Partial grade passback leaves teachers with an incomplete view of class performance.
```
Given a Canvas course with a linked Mastery Connect tracker
And a published Mastery Connect assessment assignment exists in the course
And multiple students are enrolled in the course
When Mastery Connect scores the assessment for every enrolled student
Then each student's score appears in the Canvas Gradebook for that assignment
```

**Scenario MC-1.4 — Non-raw-score assessment requires manual publish before grade passback succeeds**
- **GUID:** `7f6c2a4d`
- **Reason:** Students cannot submit assignments and grades cannot flow until the teacher publishes benchmark or item-based assessment assignments.
```
Given a Canvas course with a linked Mastery Connect tracker
And an item-based assessment has been added to the tracker
And the corresponding Canvas assignment was auto-created in an unpublished state
And the teacher has manually published the Canvas assignment
And a student is enrolled in the course
When Mastery Connect scores the student's item-based assessment
Then the student's score appears in the Canvas Gradebook for that assignment
```

**Scenario MC-1.5 — MC scores graded discussion assessment and grade appears in Canvas Gradebook**
- **GUID:** `e9a47b13`
- **Reason:** Graded discussions aligned to Mastery standards do not reflect scores in Canvas if passback fails for this assignment type.
```
Given a Canvas course with a linked Mastery Connect tracker
And a graded discussion has been created with a Mastery standard alignment
And the graded discussion assignment is published
And a student is enrolled in the course
When Mastery Connect scores the student's graded discussion assessment
Then the student's score appears in the Canvas Gradebook for the graded discussion
```
