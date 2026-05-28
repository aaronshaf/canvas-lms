# BTS-F3: Clear pass — object creation/recovery

**Key:** BTS-F3
**Summary:** Rollcall attendance assignment not recreated after deletion
**Resolution:** Done
**Status:** Closed
**Components:** Roll Call
**Labels:** bts-fixture

## Description

When a teacher deletes the attendance assignment from the gradebook and then opens the Rollcall Attendance tool again, the attendance assignment is not recreated. Teachers must manually create a new assignment and reconfigure it.

Steps to reproduce:
1. Open Rollcall Attendance in a course (this creates the attendance assignment)
2. Delete the attendance assignment from the gradebook
3. Open Rollcall Attendance again
4. No assignment is recreated — attendance marks have nowhere to flow

Expected: Rollcall detects the missing assignment and recreates it automatically.
Actual: Rollcall shows the attendance UI but no assignment exists in the gradebook.

## Comments

**Comment 1 (most recent):**
Gerrit merge: "Auto-recover attendance assignment on Rollcall LTI launch. When the tool launches and the linked assignment is soft-deleted, create a new assignment with the same configuration and update the tool's assignment reference."

**Comment 2:**
This is a long-standing issue. Teachers often accidentally delete the attendance assignment thinking it's a regular assignment.
