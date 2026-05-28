These scenarios cover grading workflows at the integration boundary between Canvas LMS and three external services: New Quizzes (Quizzes 2), Rollcall (Attendance), and Mastery Connect.

## Scenario Files

| File | Integration |
|---|---|
| [new-quizzes.md](new-quizzes.md) | Canvas LMS <-> New Quizzes |
| [rollcall.md](rollcall.md) | Canvas LMS <-> Rollcall (Attendance) |
| [mastery-connect-grade-passback.md](mastery-connect-grade-passback.md) | Canvas LMS <-> Mastery Connect |
| [mastery-connect-passback-constraints.md](mastery-connect-passback-constraints.md) | Canvas LMS <-> Mastery Connect |

## Notes

- New Quizzes requires the `quizzes_next` feature flag to be enabled
- Rollcall is an LTI tool; attendance marks become grade values on a Canvas assignment
- Mastery Connect integrates via LTI 1.1/1.3 + Canvas REST API + Outcomes Service
