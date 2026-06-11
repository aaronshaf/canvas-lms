# Scenarios: Rollcall Attendance Grading

**Source KB articles:**
- [660704 — How do I use the Roll Call Attendance tool in a course?](https://community.instructure.com/en/kb/articles/660704-how-do-i-use-the-roll-call-attendance-tool-in-a-course)
- [660705 — How do I edit the Roll Call Attendance assignment?](https://community.instructure.com/en/kb/articles/660705-how-do-i-edit-the-roll-call-attendance-assignment)
- [660707 — How do I take roll call using the Attendance tool?](https://community.instructure.com/en/kb/articles/660707-how-do-i-take-roll-call-using-the-attendance-tool)
- [660844 — How do I select a grade posting policy for a course in the Gradebook?](https://community.instructure.com/en/kb/articles/660844-how-do-i-select-a-grade-posting-policy-for-a-course-in-the-gradebook)
- [660845 — How do I select a grade posting policy for an assignment in the Gradebook?](https://community.instructure.com/en/kb/articles/660845-how-do-i-select-a-grade-posting-policy-for-an-assignment-in-the-gradebook)
- [660846 — How do I post grades for an assignment in the Gradebook?](https://community.instructure.com/en/kb/articles/660846-how-do-i-post-grades-for-an-assignment-in-the-gradebook)
- [660852 — How do I enter and edit grades in the Gradebook?](https://community.instructure.com/en/kb/articles/660852-how-do-i-enter-and-edit-grades-in-the-gradebook)

**Integration:** Canvas LMS ↔ Rollcall (Attendance)

---

**Scenario RC-1.1 — Rollcall creates an attendance assignment in the Canvas gradebook**
- **GUID:** `9c4b3e17`
- **Reason:** Attendance cannot contribute to grades if the Rollcall LTI tool fails to create a corresponding Canvas assignment.
```
Given a course with the Rollcall (Attendance) LTI tool enabled
And a teacher is enrolled in the course
When the teacher launches the Attendance tool and marks attendance for at least one student
Then a "Roll Call Attendance" assignment is created in the course
And the assignment is worth 100 points by default
And the assignment has a submission type of "external_tool"
```

**Scenario RC-1.2a — Present attendance mark produces a grade on the Canvas assignment**
- **GUID:** `e5a82d4f`
- **Reason:** Students receive no credit for attending class if Rollcall attendance marks do not flow back as grades to the Canvas assignment.
```
Given a course with the Roll Call Attendance assignment configured
And a student is enrolled in the course
When the teacher marks the student as present for one class session
Then the student's submission on the attendance assignment shows a score reflecting 100% attendance
And the submission workflow state is "graded"
```

**Scenario RC-1.2b — Absent attendance mark records a zero grade, not a blank**
- **GUID:** `2f8c4d6b`
- **Reason:** An absence is silently treated as ungraded — leaving the student's attendance unscored instead of penalized — if a 0% passback does not record a real zero grade on the Canvas submission.
```
Given a course with the Roll Call Attendance assignment configured
And a student is enrolled in the course
When the teacher marks the student as absent for one class session
Then the student's submission on the attendance assignment has a score of 0
And the submission workflow state is "graded"
```

**Scenario RC-1.3 — A subsequent Rollcall passback overwrites a prior Rollcall-set attendance grade**
- **GUID:** `1f7d6a93`
- **Reason:** Corrected attendance never reaches the gradebook if a later Rollcall passback cannot update a score it previously set, leaving students with stale attendance grades after the teacher re-takes attendance.
- **Note:** The attendance percentage itself (how present/late/absent marks average to a score, including the lateness weight) is computed inside Rollcall and is covered by unit tests in the rollcall-attendance repo. At the Canvas boundary only the resulting passback is observable, so this scenario tests that a re-take overwrites the earlier score.
```
Given a course with the Roll Call Attendance assignment configured
And a student whose attendance submission was previously graded by Rollcall
When the teacher re-takes attendance and Rollcall sends an updated grade passback for the student
Then the student's submission score is updated to the new value
And the submission remains graded
```

**Scenario RC-1.4 — A reduced attendance score lowers the student's course grade**
- **GUID:** `b0e94c58`
- **Reason:** Students who miss class are not penalized if a reduced attendance score does not flow through to their overall course grade.
- **Note:** The attendance percentage itself (how an absence averages into the score) is computed inside Rollcall and is covered by unit tests in the rollcall-attendance repo. This scenario tests that the reduced score Rollcall passes back actually reaches the student's computed course grade.
```
Given a course with the Roll Call Attendance assignment counting toward the final grade
And a student is enrolled in the course
When Rollcall posts a reduced attendance score for the student
Then the student's submission score on the attendance assignment reflects the reduced value
And the student's current course grade reflects the reduced attendance score
```

**Scenario RC-1.5 — Rollcall grade passback does not auto-post when assignment has manual posting policy**
- **GUID:** `f4e2c97a`
- **Reason:** Students see attendance grades before the teacher is ready to release them if a Rollcall grade passback bypasses the manual posting policy and auto-posts the submission.
```
Given the Roll Call Attendance assignment has a manual posting policy
And a student is enrolled in the course
When the teacher marks attendance and Rollcall sends a grade passback for the student's submission
Then the Canvas submission records the attendance score
And the submission is not posted
And the student cannot view the attendance score on the Grades page
```

**Scenario RC-1.6 — _removed_ (Rollcall passback does not overwrite a teacher's manual attendance grade)**
- **Status:** Removed — not request-testable at the Canvas boundary, and redundant with RC-1.3.
- **Reason for removal:** Rollcall posts grades through the Canvas REST submissions API using the teacher's own bearer token (rollcall-attendance `attendance_assignment.rb`), so a Rollcall passback and a teacher's manual grade are indistinguishable at the Canvas boundary — both arrive with the teacher's positive `grader_id`. The submissions API does not set `dont_overwrite_grade` on this path, so the passback overwrites the prior grade exactly as **RC-1.3** already covers. There is no observable protection to assert, so this scenario was dropped rather than implemented.

**Scenario RC-1.7 — Rollcall grade passback clears a teacher's excused status on an attendance submission**
- **GUID:** `2e9a7d46`
- **Reason:** A student legitimately exempt from attendance grading is silently un-excused — and the attendance score begins counting toward their course grade — because Canvas applies a Rollcall passback to an excused submission with no protection.
- **Note:** This is a **negative control** pinning the actual (unprotected) Canvas-boundary behavior, not a protection guarantee. `grade_student` clears the flag whenever a score is applied (`submission.excused = opts[:excused] && score.blank?`), and Rollcall posts unconditionally with no excused guard, so a re-take session overwrites the exemption. The test exists as a regression anchor: if Canvas later preserves excused across an LTI passback, this scenario must be updated.
```
Given a course with the Roll Call Attendance assignment counting toward the final grade
And a student's attendance submission has been marked as excused in Canvas
When the teacher records a new attendance session and Rollcall sends a grade passback for the student
Then the student's submission is no longer excused
And the attendance score is applied and counts toward the student's course grade
```

**Scenario RC-1.8 — Rollcall auto-creates a new attendance assignment after the original is deleted**
- **GUID:** `7e4c1d90`
- **Reason:** Attendance cannot be recorded going forward if Rollcall cannot recover from an accidental deletion of the Canvas attendance assignment.
```
Given a course with an existing Roll Call Attendance assignment that has recorded grades
And the attendance assignment has been deleted from Canvas
When the teacher attempts to take attendance via the Rollcall tool
Then Rollcall detects the missing assignment and creates a new Roll Call Attendance assignment in Canvas
And the new assignment has a submission type of "external_tool"
And the new assignment is worth 100 points by default
```

**Scenario RC-1.9 — Changing the attendance assignment's point value preserves the raw score instead of rescaling it**
- **GUID:** `d3b9f462`
- **Reason:** Student attendance grades are silently miscalculated after the teacher changes the assignment's point value: Canvas preserves the existing raw score and only re-derives the percent grade, so a student graded 50/100 reads a stale "25%" of 200 until Rollcall re-takes attendance and passes back a corrected grade.
- **Note:** Changing `points_possible` does not rescale existing scores — `AbstractAssignment#update_student_submissions` (fired by the `points_possible` after_save) keeps the raw score and re-derives the percent grade via `score_to_grade`. The re-take that corrects the score is a later passback overwriting the prior one, already covered by RC-1.3.
```
Given the Roll Call Attendance assignment worth 100 points
And a student graded 50% (raw score 50) on the 100-point scale
When the teacher changes the assignment's point value to 200 in Canvas
Then the student's submission keeps its raw score of 50 (Canvas does not rescale it)
And the percent grade is re-derived to a now-stale "25%" of the 200-point scale
And the student's course grade reflects the stale 25% until attendance is re-taken
```

**Scenario RC-1.10 — Setting "exclude from final grade" in Rollcall sets the Canvas assignment omit flag**
- **GUID:** `a1f5e830`
- **Reason:** Attendance grades contribute to final grade calculations contrary to the teacher's intent if Rollcall's exclude-from-grade setting is not propagated to the Canvas assignment's omit flag.
```
Given a course with the Roll Call Attendance assignment contributing to the final grade
When the teacher enables "Do not count attendance toward final grade" in the Rollcall settings
Then the Canvas attendance assignment is updated with the omit from final grade flag set
And the attendance score is excluded from all students' final grade calculations
```

**Scenario RC-1.11a — A section-limited TA can pass back an attendance grade for a student in their own section**
- **GUID:** `3a7f1e62`
- **Reason:** Positive control — without it, the RC-1.11b rejection could pass for the wrong reason (a TA who cannot grade at all). This proves the section-limited TA grades normally inside their section.
- **Note:** Canvas scopes a section-limited grader (`limit_privileges_to_course_section`) to their own section via `get_user_considering_section` (`SubmissionsApiController#update` → `Course#students_visible_to`). RC-1.11a and RC-1.11b together pin that the section limit — not a broken grader — is what rejects the out-of-section passback.
```
Given a course with a section-limited TA enrolled in section A
And a student enrolled in section A
And the Roll Call Attendance assignment configured for the course
When the TA passes back an attendance grade for the section A student
Then the submission is graded with the passed-back score
```

**Scenario RC-1.11b — A section-limited TA cannot pass back an attendance grade for a student outside their section**
- **GUID:** `8c6d4f15`
- **Reason:** Students in other sections receive incorrect attendance grades if Canvas let a section-limited grader's passback reach students outside their section.
```
Given a course with a section-limited TA enrolled in section A
And a student enrolled in section B
And the Roll Call Attendance assignment configured for the course
When the TA passes back an attendance grade for the section B student
Then Canvas rejects the request as not found
And the section B student's submission has no grade or score
```
