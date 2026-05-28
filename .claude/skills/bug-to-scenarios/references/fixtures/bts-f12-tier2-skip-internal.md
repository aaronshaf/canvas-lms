# BTS-F12: Tier 2 skip — Canvas-internal, no boundary signal

**Key:** BTS-F12
**Summary:** Gradebook export missing column headers for late penalties
**Resolution:** Done
**Status:** Closed
**Components:** Gradebook
**Labels:** bts-fixture

## Description

When a teacher exports the gradebook to CSV, the exported file is missing the column headers for the "Late Penalty" and "Final Score" columns. The data for those columns is present in the CSV rows, but the header row has fewer columns than the data rows, causing the columns to be misaligned when opened in Excel or Google Sheets.

Steps to reproduce:
1. Create a course with assignments that have late submission penalties configured
2. Students submit assignments (some on time, some late)
3. Teacher exports the gradebook via Gradebook > Export > CSV
4. Open the CSV — headers are misaligned starting from the "Late Penalty" column

Expected: CSV headers match the data columns.
Actual: "Late Penalty" and "Final Score" headers are missing.

## Comments

**Comment 1 (most recent):**
Gerrit merge: "Include late_penalty and final_score headers in gradebook CSV export. The header generation loop was skipping computed columns. Add them to the header array alongside the grade columns."

**Comment 2:**
This is a straightforward CSV formatting bug in the gradebook export code. No external services or integrations are involved.
