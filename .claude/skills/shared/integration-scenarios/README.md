# Shared Integration Scenario Resources

Reusable definitions consumed by multiple skills:

- **`gates.md`** — Three-gate filter (grading-related, active boundary crossing, API-expressible) applied to candidate behaviors before they become scenarios.
- **`service-profiles/`** — Per-service context files (integration type, boundary categories, ID prefix) used during gate triage.

## Consuming Skills

- `bug-to-scenarios` — derives scenarios from resolved JIRA bugs
- `kb-to-scenarios` — derives scenarios from Canvas KB articles
