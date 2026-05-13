# Scenarios

Behavioral scenario inventory for Canvas LMS integration boundaries. Each subdirectory covers a domain of cross-system workflows expressible through the Canvas REST API.

## Constraints

- **User-behavior language.** Scenarios are written from the perspective of user actions and observable outcomes. Mapping those behaviors to specific HTTP requests and API calls happens during test implementation, not in the scenario definitions.
- **External → Canvas direction.** Scenarios focus on external services making requests to Canvas. This is the testable boundary.
- **Outbound calls are mocked.** It is not possible to test requests from Canvas to an external service in this framework. Where a scenario depends on Canvas calling out (e.g., an LTI launch), that interaction is assumed or mocked during test implementation.

## Scenario Schema

Each scenario follows this structure:

```markdown
**Scenario {file#}.{scenario#} — {Short imperative title}**
- **GUID:** `{8-char lowercase hex}`
- **Reason:** {One sentence — the impact if this fails.}
\```
Given {precondition(s)}
When {action(s)}
Then {expected outcome(s)}
\```
```

**Field rules:**

| Field | Rule | Explanation |
|-------|------|-------------|
| **Title** | Imperative phrase describing the action and its result (e.g., "Teacher posts grades → students see score"). Unique within the file. | |
| **GUID** | 8-character lowercase hex string (e.g., `4e7a2d1f`). Assigned once, never changed. | Used to trace scenarios to test implementations. |
| **Reason** | One sentence — the impact if this fails. | Enables informed business decisions when a test is missing, failing, or flaky. Also helps LLMs understand *why* a scenario exists, which produces better test implementations and gives them a way to verify their tests fulfill their stated purpose. |
| **GWT block** | Standard Gherkin. `Given` = stable preconditions. `When` = the action under test. `Then` = observable outcome(s), each on its own line beginning with `And` if multiple. | |

**Example:**

```markdown
**Scenario {file#}.{scenario#} — {Title}**
- **GUID:** `{8-char lowercase hex}`
- **Reason:** {One sentence — the impact if this fails.}
\```
Given {precondition}
And {additional precondition}
When {action}
And {additional action}
Then {outcome}
And {additional outcome}
\```
```

## Domains

| Directory | Description |
|-----------|-------------|
| [grading/](grading/README.md) | Grade passback and gradebook behavior at the boundary between Canvas and external tools (New Quizzes, Rollcall) |
