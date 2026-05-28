# BTS-F10: Tier 2 catch — boundary signal in description

**Key:** BTS-F10
**Summary:** Grade not syncing for external assessment
**Resolution:** Done
**Status:** Closed
**Components:** Grades
**Labels:** bts-fixture

## Description

After a student completes an assessment in an external tool, the grade does not sync back to Canvas. The student sees a completion confirmation in the tool but the Canvas gradebook shows no score. This is a grade passback failure between the external assessment platform and Canvas.

The teacher reports that the issue started after they changed the assignment's due date. Scores that were passed back before the due date change appear correctly, but any new submissions after the change fail to sync.

Further investigation revealed this affects the Mastery Connect integration specifically. When a teacher updates the due date on a Canvas assignment that is linked to a Mastery Connect tracker, MC does not receive the updated due date and continues using the old one. Passback attempts after the old due date are rejected by Canvas as "late" even though the new due date hasn't passed.

## Comments

**Comment 1 (most recent):**
Gerrit merge: "Propagate due date changes to MC via Live Events. When an assignment's due_at is updated, emit a live event that MC consumes to update its tracker's due date. This prevents passback rejections caused by stale due dates."

**Comment 2:**
Confirmed the issue is specific to MC. NQ and Rollcall handle due date changes differently and are not affected.
