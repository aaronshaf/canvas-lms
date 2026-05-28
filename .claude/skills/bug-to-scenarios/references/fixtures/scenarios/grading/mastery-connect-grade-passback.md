# Scenarios: Grade Passback

**Integration:** Canvas LMS <-> Mastery Connect

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
