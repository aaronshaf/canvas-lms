# Scenarios: New Quizzes Grading

**Integration:** Canvas LMS <-> New Quizzes (Quizzes 2)

---

**Scenario NQ-1.1 — Auto-graded New Quizzes score flows to Canvas gradebook**
- **GUID:** `7e2b4f91`
- **Reason:** Students see incorrect or missing quiz scores if auto-graded results from New Quizzes do not pass back to the Canvas submission record.
```
Given a published New Quizzes quiz worth 100 points with auto-graded questions
And a student is enrolled in the course
When the student completes the quiz and scores 80 out of 100
Then the student's Canvas submission for the quiz assignment shows a score of 80
And the submission workflow state is "graded"
```

**Scenario NQ-1.3 — New Quizzes grade passback does not auto-post when assignment has manual posting policy**
- **GUID:** `3d2f9e74`
- **Reason:** Students see quiz scores before the teacher is ready to release them if a NQ grade passback bypasses the manual posting policy and auto-posts the submission.
```
Given a New Quizzes quiz assignment with a manual posting policy
And a student has submitted the quiz
When New Quizzes sends a grade passback for the student's submission
Then the Canvas submission records the score
And the submission is not posted
And the student cannot view the quiz score on the Grades page
```

**Scenario NQ-1.4 — Subsequent New Quizzes passback does not overwrite a teacher's manual grade**
- **GUID:** `a0b5c81f`
- **Reason:** Teachers lose the ability to correct auto-grading errors if a later NQ grade passback silently overwrites a grade the teacher has already set manually in Canvas.
```
Given a New Quizzes quiz assignment worth 100 points
And a student has a graded submission with an auto-graded score of 70
And the teacher has manually set the student's Canvas submission grade to 85
When New Quizzes sends a new grade passback for the same student with a score of 72
Then the student's Canvas submission score remains 85
And the gradebook displays the teacher's manually entered score
```

**Scenario NQ-1.9 — Canvas availability "Until" date causes NQ to auto-submit an in-progress quiz**
- **GUID:** `4d7e2b93`
- **Reason:** Students receive no submission record or grade if NQ does not auto-submit and send grade passback when the Canvas availability window closes on an in-progress attempt.
```
Given a New Quizzes quiz with an availability "Until" date set in Canvas
And a student has started the quiz but not submitted before the "Until" time
When the "Until" date and time passes
Then New Quizzes automatically submits the student's in-progress attempt
And New Quizzes sends a grade passback to Canvas for the auto-submitted attempt
And the student's Canvas submission has a workflow state of "graded"
```

**Scenario NQ-1.10 — NQ grade passback for a student with a concluded enrollment is not recorded in Canvas**
- **GUID:** `17a60e2d`
- **Reason:** Gradebook integrity is compromised if NQ grade passbacks are accepted for students whose enrollment has ended, creating or modifying grade records for non-active students.
```
Given a New Quizzes quiz assignment in a course
And a student's enrollment in the course has been concluded
When New Quizzes sends a grade passback for that student's submission
Then Canvas does not update or create a submission score for the concluded student
And the student's enrollment record remains unchanged
```
