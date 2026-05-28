# Scenarios: Rollcall Attendance Grading

**Integration:** Canvas LMS <-> Rollcall (Attendance)

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

**Scenario RC-1.2 — Attendance mark produces a grade on the Canvas assignment**
- **GUID:** `e5a82d4f`
- **Reason:** Students receive no credit for attending class if Rollcall attendance marks do not flow back as grades to the Canvas assignment.
```
Given a course with the Roll Call Attendance assignment configured
And a student is enrolled in the course
When the teacher marks the student as present for one class session
Then the student's submission on the attendance assignment shows a score reflecting 100% attendance
And the submission workflow state is "graded"
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

**Scenario RC-1.11 — Section-specific attendance marks only update submissions for students in that section**
- **GUID:** `8c6d4f15`
- **Reason:** Students in unattended sections receive incorrect attendance grades if Rollcall passbacks from a section-filtered session update students outside the teacher's selected section.
```
Given a course with two sections, each containing enrolled students
And the Roll Call Attendance assignment is configured for the course
When the teacher selects section A in Rollcall and marks all students in section A as present
Then Rollcall sends grade passbacks only for students in section A
And the submission scores for students in section B are not updated
```
