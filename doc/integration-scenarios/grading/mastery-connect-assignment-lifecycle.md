# Scenarios: Assignment Lifecycle

**Source KB articles:**
- [662067 — How do I add an assessment to a Mastery Tracker in Canvas?](https://community.instructure.com/en/kb/articles/662067-how-do-i-add-an-assessment-to-a-mastery-tracker-in-canvas)
- [662071 — How do I administer a Mastery Connect assessment in my Canvas Course?](https://community.instructure.com/en/kb/articles/662071-how-do-i-administer-a-mastery-connect-assessment-in-my-canvas-course)
- [662073 — How do I create a Canvas assignment from an existing Mastery Connect assessment?](https://community.instructure.com/en/kb/articles/662073-how-do-i-create-a-canvas-assignment-from-an-existing-mastery-connect-assessment)
- [662074 — How do I create a Canvas assignment for my Mastery Connect tracker?](https://community.instructure.com/en/kb/articles/662074-how-do-i-create-a-canvas-assignment-for-my-mastery-connect-tracker)
- [662075 — How do I create a Canvas graded discussion for my Mastery Connect tracker?](https://community.instructure.com/en/kb/articles/662075-how-do-i-create-a-canvas-graded-discussion-for-my-mastery-connect-tracker)
- [662068 — How do I convert a Canvas Classic Quiz into a Mastery Connect assessment?](https://community.instructure.com/en/kb/articles/662068-how-do-i-convert-a-canvas-classic-quiz-into-a-mastery-connect-assessment)
- [662069 — How do I convert a Canvas New Quiz into a Mastery Connect assessment?](https://community.instructure.com/en/kb/articles/662069-how-do-i-convert-a-canvas-new-quiz-into-a-mastery-connect-assessment)

**Integration:** Canvas LMS ↔ Mastery Connect

---

**Scenario MC-2.1 — MC assessment added to tracker creates a Canvas assignment**
- **GUID:** `4d8e1f5a`
- **Reason:** Students have no assignment to submit against if Mastery Connect assessment creation does not generate a corresponding Canvas assignment.
```
Given a Canvas course with a linked Mastery Connect tracker
When mc-mothership creates the Canvas assignment for a Mastery Connect assessment
Then a corresponding Canvas assignment is created
And it appears in the course's assignments list
```

**Scenario MC-2.2 — Raw score assessment creates a published Canvas assignment**
- **GUID:** `2c5b9e73`
- **Reason:** Raw score assessment assignments must be immediately visible to students; if created as unpublished, students cannot access them without teacher intervention.
```
Given a Canvas course with a linked Mastery Connect tracker
When mc-mothership creates the assignment for a raw score assessment (published)
Then Canvas persists the assignment in a published state
```

**Scenario MC-2.3 — Item-based or benchmark assessment creates an unpublished Canvas assignment**
- **GUID:** `a6f34d82`
- **Reason:** Unpublished state gives teachers control over when to release assessment assignments; if auto-published, students may see incomplete or draft assessments.
```
Given a Canvas course with a linked Mastery Connect tracker
When mc-mothership creates the assignment for an item-based or benchmark assessment (unpublished)
Then Canvas persists the assignment in an unpublished state
```

**Scenario MC-2.4 — MC assessment points possible inherited by Canvas assignment**
- **GUID:** `1b7e4c09`
- **Reason:** Grade calculations in the Canvas Gradebook are incorrect if points possible do not match between Mastery Connect and Canvas.
```
Given a Canvas course with a linked Mastery Connect tracker
When mc-mothership creates the assignment with a specific points-possible value
Then the created Canvas assignment has the same points-possible value
```

**Scenario MC-2.5 — Classic Graded Quiz conversion produces a new Canvas assignment**
- **GUID:** `8d3f2a67`
- **Reason:** After converting a Classic Quiz to a Mastery Connect assessment, students cannot take the MC version through Canvas if the corresponding assignment is not created.
```
Given a Canvas course with a linked Mastery Connect tracker
And a published Classic Quiz of type Graded Quiz exists in the course
When the Classic Quiz is converted to a Mastery Connect assessment and the assessment is created
Then a new Canvas assignment is created for the Mastery Connect assessment
And the original Classic Quiz remains unchanged in the course
```

**Scenario MC-2.6 — New Quiz conversion produces a new Canvas assignment**
- **GUID:** `f4c91e5b`
- **Reason:** After converting a New Quiz to a Mastery Connect assessment, students cannot take the MC version through Canvas if the corresponding assignment is not created.
```
Given a Canvas course with a linked Mastery Connect tracker
And a published New Quiz of type Graded Quiz exists in the course
When the New Quiz is converted to a Mastery Connect assessment and the assessment is created
Then a new Canvas assignment is created for the Mastery Connect assessment
And the original New Quiz remains unchanged in the course
```

**Scenario MC-2.7 — Pre-existing MC assessment promoted to linked Canvas assignment**
- **GUID:** `c3d56a92`
- **Reason:** Teachers cannot administer pre-existing tracker assessments through Canvas if the manual assignment creation action does not produce a Canvas assignment.
```
Given a Canvas course with a linked Mastery Connect tracker
And the tracker contains assessments that were added before the tracker was linked to Canvas
When the teacher creates a Canvas assignment from one of those pre-existing assessments
Then a corresponding Canvas assignment is created in the course
```
