# Scenarios: New Quizzes Grading

**Source KB articles:**
- [661069 — How do I edit the assignment details of a New Quizzes quiz?](https://community.instructure.com/en/kb/articles/661069-how-do-i-edit-the-assignment-details-of-a-new-quizzes-quiz)
- [661073 — How do I grade a quiz in New Quizzes?](https://community.instructure.com/en/kb/articles/661073-how-do-i-grade-a-quiz-in-new-quizzes)
- [661088 — How do I align an outcome to a quiz in New Quizzes?](https://community.instructure.com/en/kb/articles/661088-how-do-i-align-an-outcome-to-a-quiz-in-new-quizzes)
- [660672 — How do I add an assignment using an external app?](https://community.instructure.com/en/kb/articles/660672-how-do-i-add-an-assignment-using-an-external-app)
- [660844 — How do I select a grade posting policy for a course in the Gradebook?](https://community.instructure.com/en/kb/articles/660844-how-do-i-select-a-grade-posting-policy-for-a-course-in-the-gradebook)
- [660845 — How do I select a grade posting policy for an assignment in the Gradebook?](https://community.instructure.com/en/kb/articles/660845-how-do-i-select-a-grade-posting-policy-for-an-assignment-in-the-gradebook)
- [660852 — How do I enter and edit grades in the Gradebook?](https://community.instructure.com/en/kb/articles/660852-how-do-i-enter-and-edit-grades-in-the-gradebook)
- [660863 — How do I publish final grades for a moderated assignment?](https://community.instructure.com/en/kb/articles/660863-how-do-i-publish-final-grades-for-a-moderated-assignment)

**Integration:** Canvas LMS ↔ New Quizzes (Quizzes 2)

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

**Scenario NQ-1.2 — Teacher manually grades a New Quizzes essay question**
- **GUID:** `d4a6e823`
- **Reason:** Essay and file-upload questions remain unscored in the gradebook if the teacher's manual grade is not persisted to the Canvas submission.
```
Given a published New Quizzes quiz containing an essay question worth 20 points
And a student has submitted the quiz
And the essay question has not yet been graded
When the teacher assigns 15 points to the essay question and updates the submission grade
Then the student's Canvas submission score reflects the combined auto-graded and manually graded totals
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

**Scenario NQ-1.5 — New Quizzes grade passback for a moderated assignment creates a provisional grade**
- **GUID:** `e7d3a429`
- **Reason:** The moderated grading workflow is bypassed if a NQ grade passback writes directly to the final submission score instead of creating a provisional grade for moderator review.
```
Given a New Quizzes quiz assignment with moderated grading enabled and a grader count of 2
And a student has submitted the quiz
When a grader grades the submission in New Quizzes and NQ sends a grade passback with a score of 80
Then Canvas records the score as a provisional grade for that grader
And the student's final submission score is not yet updated
And the student cannot view the score
```

**Scenario NQ-1.6 — New Quizzes passback delivers outcome result and quiz grade in the same operation**
- **GUID:** `6c1f8b50`
- **Reason:** Students receive a quiz score but no mastery credit, or mastery credit with no score, if NQ passback does not persist both the grade and the outcome result to Canvas.
```
Given a New Quizzes quiz worth 100 points with questions aligned to a learning outcome
And a student has completed the quiz scoring 90 out of 100 with a passing mastery result
When New Quizzes sends the passback for the student's submission
Then the student's Canvas submission score is 90
And an outcome result for the aligned outcome is created in Canvas
And both the submission score and the outcome result reference the same quiz assignment
```

**Scenario NQ-1.7 — Fudge points applied in New Quizzes update the Canvas submission score**
- **GUID:** `b5f3a91d`
- **Reason:** Teachers cannot make holistic score adjustments if fudge-point changes made in NQ are not reflected in the Canvas submission record.
```
Given a New Quizzes quiz assignment worth 100 points
And a student has an auto-graded submission with a score of 70
When the teacher adds 10 fudge points to the student's quiz submission in New Quizzes
Then the student's Canvas submission score is 80
And the submission workflow state is "graded"
```

**Scenario NQ-1.8 — Second NQ attempt passback updates the Canvas submission score**
- **GUID:** `c8d2e05f`
- **Reason:** Students are permanently penalized with their first-attempt score even after earning a higher score on a permitted retake if NQ does not pass the updated score back to Canvas.
```
Given a New Quizzes quiz with two attempts allowed and a "keep highest" scoring policy
And a student has completed the first attempt scoring 60 out of 100
When the student completes the second attempt scoring 85
Then the student's Canvas submission score is updated to 85
And the submission workflow state is "graded"
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

**Scenario NQ-1.11 — NQ anonymous graded survey preserves student anonymity in submission records**
- **GUID:** `5a9c3e72`
- **Reason:** Students' identities are exposed to graders during anonymous survey grading if NQ submission ordering leaks identifying data through the Canvas submissions API.
```
Given a New Quizzes anonymous graded survey is published in a course
And multiple students have submitted the survey
When a teacher retrieves the submissions for the survey assignment
Then each submission is identified only by an anonymous ID
And the submission list order does not correlate with student identity
And no student name or user ID is present in the submission records
```

**Scenario NQ-1.12 — Canvas enforces "Available From" date for NQ quiz access**
- **GUID:** `8d4f1b63`
- **Reason:** Students complete quizzes and receive grades before the teacher's intended availability window if Canvas does not enforce the "Available From" constraint on NQ quiz access.
```
Given a New Quizzes quiz with a future "Available From" date set in Canvas
And the quiz is published
And a student is enrolled in the course
When the student attempts to access the quiz before the "Available From" date
Then Canvas reports the assignment as locked for the student
And no submission can be created for the student on that assignment
```

**Scenario NQ-1.13 — NQ respects Canvas differentiated availability dates for student quiz access**
- **GUID:** `f2c8a41b`
- **Reason:** Students with valid section or individual availability overrides are blocked from taking the quiz and receiving a grade if NQ ignores Canvas assignment override dates.
```
Given a New Quizzes quiz with a course-level "Until" date in the past
And a student has a section-level override with a future "Until" date
When the student attempts to access the quiz
Then Canvas allows the student to access the quiz assignment
And the student can create a submission for the quiz
```

**Scenario NQ-1.14 — NQ caps quiz session duration at the Canvas "Until" date**
- **GUID:** `9b3e7d52`
- **Reason:** Students exceed the intended availability window and submit grades after the deadline if NQ does not cap the quiz time limit to the remaining time before the "Until" date.
```
Given a New Quizzes quiz with a 60-minute time limit
And the quiz assignment has an "Until" date 10 minutes from now
And a student is enrolled in the course
When the student starts the quiz
Then the student's quiz session is limited to the time remaining before the "Until" date
And any submission created for the student has a submitted_at timestamp at or before the "Until" date
```

**Scenario NQ-1.15 — Anonymous NQ survey submission notification does not reveal student identity**
- **GUID:** `e4b1c96a`
- **Reason:** Student privacy is violated and survey anonymity is meaningless if Canvas notifications triggered by anonymous NQ survey submissions include the student's name or identifiable links.
```
Given a New Quizzes anonymous survey is published in a course
And a student is enrolled in the course
When the student submits the survey
Then any submission notification generated by Canvas does not include the student's name
And the notification does not link to a URL that reveals the student's identity
```

**Scenario NQ-1.16 — Migrated NQ graded survey awards full credit on completion**
- **GUID:** `7a5d2f83`
- **Reason:** Students who complete a migrated graded survey receive a zero in the gradebook instead of full credit, penalizing them for participation.
```
Given a Classic Quiz graded survey has been migrated to a New Quizzes graded survey
And the Canvas assignment is worth 10 points
And a student is enrolled in the course
When the student completes the graded survey
Then the student's Canvas submission score equals the assignment's points possible
And the submission workflow state is "graded"
```

**Scenario NQ-1.17 — Anonymous NQ graded survey sets anonymous grading flag on Canvas assignment**
- **GUID:** `d3f9e27c`
- **Reason:** Teachers can identify anonymous survey respondents through the gradebook if NQ fails to set the anonymous grading flag on the Canvas assignment, exposing which students have submitted.
```
Given a New Quizzes anonymous graded survey is published in a course
When the teacher retrieves the assignment details for the survey
Then the assignment has anonymous grading enabled
And the submissions endpoint returns anonymous IDs instead of student identifiers
```

**Scenario NQ-1.18 — Duplicated NQ quiz assignment is created in unpublished state**
- **GUID:** `b6e4a10d`
- **Reason:** Students see and can submit to an unreviewed copy of a quiz if duplicating a published NQ assignment creates the duplicate in a published state.
```
Given a published New Quizzes quiz assignment in a course
When the teacher duplicates the quiz assignment
Then the new duplicate assignment is created in an unpublished state
And students cannot access or submit to the duplicate assignment
```

**Scenario NQ-1.19 — NQ graded survey type preserved during content import**
- **GUID:** `c8a15e4d`
- **Reason:** Students are graded on answer correctness instead of participation if a graded survey's type is silently changed to "graded quiz" during content import.
```
Given a New Quizzes graded survey exists in a source course
When the graded survey is imported into a destination course via content migration
Then the imported quiz assignment retains the graded survey type
And the quiz scores students based on participation, not answer correctness
```
