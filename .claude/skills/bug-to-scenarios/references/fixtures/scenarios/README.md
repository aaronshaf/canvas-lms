# Scenarios (Test Fixture)

Frozen snapshot of `doc/integration-scenarios/` for use by the bug-to-scenarios test suite. The QA protocol reads these files instead of the live scenario docs so that test results are stable over time.

## Constraints

- **User-behavior language.** Scenarios are written from the perspective of user actions and observable outcomes.
- **External -> Canvas direction.** Scenarios focus on external services making requests to Canvas.
- **Outbound calls are mocked.**

## Scenario Schema

```markdown
**Scenario {SERVICE-PREFIX}-{file#}.{scenario#} — {Short imperative title}**
- **GUID:** `{8-char lowercase hex}`
- **Reason:** {One sentence — the impact if this fails.}
\```
Given {precondition(s)}
When {action(s)}
Then {expected outcome(s)}
\```
```

## Domains

| Directory | Description |
|-----------|-------------|
| [grading/](grading/) | Grade passback and gradebook behavior at the boundary between Canvas and external tools (New Quizzes, Rollcall, Mastery Connect) |
