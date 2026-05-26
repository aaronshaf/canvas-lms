These scenarios cover grading workflows at the integration boundary between Canvas LMS and three external services: New Quizzes (Quizzes 2), Rollcall (Attendance), and Mastery Connect. Every scenario describes a workflow where grading data crosses from one system to another, and every step is expressible through the Canvas REST API without requiring browser interaction.

## Scenario Files

| File | Source KB Articles | Integration |
|---|---|---|
| [new-quizzes.md](new-quizzes.md) | 661069, 661073, 661088, 660672, 660844, 660845, 660852, 660863 | Canvas LMS ↔ New Quizzes |
| [rollcall.md](rollcall.md) | 660704, 660705, 660707, 660844, 660845, 660846, 660852 | Canvas LMS ↔ Rollcall (Attendance) |
| [mastery-connect-grade-passback.md](mastery-connect-grade-passback.md) | 662061, 662067, 662071, 662074, 662075, 662077 | Canvas LMS ↔ Mastery Connect |
| [mastery-connect-assignment-lifecycle.md](mastery-connect-assignment-lifecycle.md) | 662067, 662071, 662073, 662074, 662075, 662068, 662069 | Canvas LMS ↔ Mastery Connect |
| [mastery-connect-passback-constraints.md](mastery-connect-passback-constraints.md) | 662065, 662066, 662067, 662077 | Canvas LMS ↔ Mastery Connect |

## Notes

- New Quizzes requires the `quizzes_next` feature flag to be enabled
- Classic Quizzes (quiz engine v1) is out of scope unless the workflow also involves New Quizzes grade passback
- Rollcall is an LTI tool; attendance marks become grade values on a Canvas assignment
- Mastery Connect integrates via LTI 1.1/1.3 + Canvas REST API + Outcomes Service; grade passback is percentage-based and asynchronous
- Mastery Connect has no feature flag requirement; the LTI connection must be configured by an Instructure CSM before any integration works
- Canvas and Mastery Connect accounts must be synced via a Student Information System (SIS) for tracker linking to function
- Mastery Connect scenarios exclude Canvas-to-MC flows (score edits, deletion cascades) because MC-side outcomes are not verifiable through the Canvas REST API
