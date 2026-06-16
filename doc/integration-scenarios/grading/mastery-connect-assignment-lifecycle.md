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

**Scenario MC-2.7 — Pre-existing MC assessment is bound to the MC tool by its launch URL**
- **GUID:** `c3d56a92`
- **Reason:** A pre-existing tracker assessment is identified only by its Mastery Connect launch URL, not a Canvas tool id; if Canvas could not resolve the MC tool from that URL, the promoted assignment would not launch into the assessment.
- **Note:** Reframed from the original "a Canvas assignment is created" wording, which at the Canvas boundary was indistinguishable from MC-2.1 (a plain Assignments API POST). The unique, request-testable contract is Canvas resolving the external tool from the launch URL's domain when no `content_id` is supplied — a code path MC-2.1 (explicit `content_id`) never exercises.
```
Given a Canvas course with a Mastery Connect tool and another external tool on a different domain
And a pre-existing Mastery Connect assessment identified only by its launch URL
When the teacher creates a Canvas assignment from that assessment (launch URL, no tool content_id)
Then a corresponding Canvas assignment is created
And its external tool tag is bound to the Mastery Connect tool whose domain matches the launch URL
And the assignment is not bound to the other tool
```
