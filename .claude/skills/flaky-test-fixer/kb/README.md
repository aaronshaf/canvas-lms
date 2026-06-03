# Flaky Test Fixer — Skill Knowledge Base

## Purpose

This folder supports the `flaky-test-fixer` skill. It stores case documents
that record real fixing attempts — successful and unsuccessful — so that the
skill can learn from accumulated experience rather than repeating the same
mistakes.

## Self-Improving Loop

1. Fix a flaky test using the skill and base Claude LLM capabilities.
2. If the fix is successful — no further action needed.
3. If the fix is unsuccessful — help Claude iterate until the test is fixed.
4. Ask Claude to summarize the successful and unsuccessful strategies and the
   lessons learned.
5. Store the summary as a new case document in this folder
   (next sequential file: `case_NN.md`).
6. Ask Claude to regenerate the skill file
   (`.claude/skills/flaky-test-fixer/SKILL.md`) incorporating all case
   files from this folder.
7. The updated skill is ready for the next challenge.

## Rationale

Storing cases separately from the skill file means history is never lost when
the skill is regenerated. Each case documents the full failure sequence and
the root cause, which prevents the same mistake from being made again as new
cases are added.

## Case File Naming

Cases are numbered sequentially: `case_01.md`, `case_02.md`, etc.  
See `case_01.md` in this folder for the reference example of the expected
structure (context, failure sequence, correct fix, core rule, and dictionary
of terms).

## Style Guidelines

`style.md` captures coding and annotation conventions that apply across all
flaky-fix work — things like how to tag a fixed test with a JIRA reference.
Each rule in that file is numbered (S-01, S-02, …) and cites the JIRA that
introduced it. When adding a new convention, append it to `style.md` rather
than scattering it across case files.
