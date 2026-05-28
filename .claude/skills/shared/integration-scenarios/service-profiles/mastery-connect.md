# Mastery Connect

- **Service name:** Mastery Connect
- **Also known as:** MasteryConnect, MC
- **Integration type:** LTI 1.1 + LTI 1.3 + Canvas REST API (grade submission, assignment CRUD) + Outcomes Service (mastery result passback) + Canvas Live Events (bidirectional grade sync)
- **Grading interaction:** grade passback to Canvas (percentage-based, async); assignment auto-creation (adding assessment to tracker creates unpublished Canvas assignment); outcome/mastery result passback (independent from grades); bidirectional grade sync (Canvas grade changes flow back to MC via Live Events); due date enforcement (post-due-date scores don't sync)
- **Boundary categories:** Grade passback, Object creation/recovery, Passback constraint, Outcome/mastery result passback, Identity/enrollment validation, Availability enforcement
- **Feature flag:** none
- **Exclusion siblings:** none
- **ID prefix:** `MC`
- **KB index URLs:**
  - `https://community.instructure.com/en/kb/mastery-connect-trackers-guide`
  - `https://community.instructure.com/en/kb/mastery-connect-assessments-guide`
  - `https://community.instructure.com/en/kb/mastery-connect-admin-guide`
  - `https://community.instructure.com/en/kb/mastery-connect-getting-started-guide`

## Key Concepts

- **Tracker and course-tracker linking:** A tracker is MC's core unit — a standards-aligned assessment plan. It must be linked to a Canvas course before any grade passback can occur. This is the prerequisite for the entire integration.
- **Bidirectional grade sync:** MC pushes grades to Canvas AND listens for Canvas grade changes via Live Events to keep scores in sync.
- **User identity mapping:** Configurable per district (Canvas UUID, SIS ID, or student number). A mismatch breaks both assessment access and grade passback.

## MC-Specific Failure Modes

These are unique to MC and should drive scenario creation:
- Deleted Canvas assignment → MC keeps stale reference → passback silently fails
- Publish → unpublish → republish permanently breaks passback
- User identity attribute mismatch blocks assessment access and grade passback
- Tracker not linked to course → no passback path exists
- Unpublished assignment blocks passback (but students can still take assessment in MC)

## KB Discovery Notes

MC articles are **not** in the Canvas instructor or admin guides. The KB index URLs above point to MC's own top-level categories. Skip: Reports (read-only), Item Authoring (no grade boundary), Curriculum Maps (deprecated).
