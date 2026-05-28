# BTS-F11: Tier 2 catch — novel phrasing

**Key:** BTS-F11
**Summary:** Assessment scores weren't reflected in grade book
**Resolution:** Done
**Status:** Closed
**Components:** Assignments
**Labels:** bts-fixture

## Description

A teacher reports that after students finish their assessments in an external tool, the points they earned don't show up in the grade book. The teacher has to manually enter every student's score, which defeats the purpose of using the tool. This has been happening intermittently for about two weeks.

The teacher checked the tool's own grade report and confirmed the students do have scores there — they just aren't making it over to Canvas. It seems like the connection between the tool and Canvas is broken or unreliable.

After further investigation, we identified this as a New Quizzes issue. The NQ service was intermittently failing to deliver grade callbacks due to a timeout in the message queue. When the callback timed out, NQ did not retry, and the score was silently lost.

## Comments

**Comment 1 (most recent):**
Gerrit merge: "Add retry logic to NQ grade passback message queue. Implement exponential backoff with 3 retries for failed grade passback callbacks. Log failures to the dead letter queue for manual investigation if all retries are exhausted."

**Comment 2:**
The timeout was caused by increased load on the Canvas API during peak hours. The retry logic ensures transient failures don't result in permanently lost scores.
