These scenarios cover grading workflows at the integration boundary between Canvas LMS and two external tools: New Quizzes (Quizzes 2) and Rollcall (Attendance). Every scenario describes a workflow where grading data crosses from one system to another, and every step is expressible through the Canvas REST API without requiring browser interaction.

## Integration Boundary Map

```
         +-------------------+
         |    Canvas LMS     |
         | (Gradebook, API)  |
         +--------+----------+
                  |
        +---------+---------+
        |                   |
  +-----v------+    +------v--------+
  | New Quizzes |    |   Rollcall    |
  | (Quizzes 2) |    | (Attendance)  |
  +-------------+    +---------------+
```

## Scenario Files

| File | Domain | Source KB Articles | Integration |
|---|---|---|---|
| [new-quizzes.md](new-quizzes.md) | Grade passback, manual grading, fudge points, multiple attempts, availability enforcement, outcome alignment, posting policy, manual grade override protection, moderated grading passback, concluded enrollment rejection | 661069, 661073, 661088, 660672, 660844, 660845, 660852, 660863 | Canvas LMS ↔ New Quizzes |
| [rollcall.md](rollcall.md) | Rollcall attendance setup, grade passback, lateness and absence calculation, posting policy enforcement, manual grade override protection, excused submission protection, assignment deletion recovery, point-value recalibration, exclude-from-grade propagation, section-scoped passback | 660704, 660705, 660707, 660844, 660845, 660846, 660852 | Canvas LMS ↔ Rollcall (Attendance) |

## Notes

- New Quizzes requires the `quizzes_next` feature flag to be enabled
- Rollcall is an LTI tool; attendance marks become grade values on a Canvas assignment
- Classic Quizzes (quiz engine v1) is out of scope unless the workflow also involves New Quizzes grade passback
