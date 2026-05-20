import {test, expect} from '../../fixtures/test'

// Canvas instructors often mix ordered and unordered lists at various nesting
// depths — a numbered outline with bulleted sub-items, or a checklist-style
// ol inside a ul. These patterns appear in syllabi, rubrics, and study guides.
// All list item text must survive the TinyMCE round-trip.
test.describe('mixed ol and ul list nesting', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  async function setAndGet(page: any, html: string): Promise<string> {
    return page.evaluate((content: string) => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(content)
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent()
    }, html)
  }

  test('ol with ul sub-list — outline text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<ol>
        <li>Introduction
          <ul>
            <li>Course objectives</li>
            <li>Grading policy</li>
          </ul>
        </li>
        <li>Week 1: Foundations
          <ul>
            <li>Reading: Chapter 1</li>
            <li>Quiz: Basic concepts</li>
          </ul>
        </li>
      </ol>`,
    )
    expect(content).toContain('Introduction')
    expect(content).toContain('Course objectives')
    expect(content).toContain('Grading policy')
    expect(content).toContain('Foundations')
    expect(content).toContain('Basic concepts')
  })

  test('ul with ol sub-list — checklist text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<ul>
        <li>Research phase
          <ol>
            <li>Identify primary sources</li>
            <li>Take annotated notes</li>
            <li>Synthesize findings</li>
          </ol>
        </li>
        <li>Writing phase
          <ol>
            <li>Draft thesis statement</li>
            <li>Write body paragraphs</li>
          </ol>
        </li>
      </ul>`,
    )
    expect(content).toContain('Research phase')
    expect(content).toContain('primary sources')
    expect(content).toContain('Writing phase')
    expect(content).toContain('thesis statement')
  })

  test('three-level mixed nesting — deep items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<ol>
        <li>Unit 1
          <ul>
            <li>Topic A
              <ol>
                <li>Subtopic 1</li>
                <li>Subtopic 2</li>
              </ol>
            </li>
            <li>Topic B</li>
          </ul>
        </li>
      </ol>`,
    )
    expect(content).toContain('Unit 1')
    expect(content).toContain('Topic A')
    expect(content).toContain('Subtopic 1')
    expect(content).toContain('Subtopic 2')
    expect(content).toContain('Topic B')
  })

  test('syllabus: ol weeks with ul activities — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<ol>
        <li><strong>Week 1:</strong> Introduction to Thermodynamics
          <ul>
            <li>Read: Chapters 1-3</li>
            <li>Watch: Lecture videos (posted Monday)</li>
            <li>Complete: Problem Set 1 (due Friday)</li>
          </ul>
        </li>
        <li><strong>Week 2:</strong> Heat Transfer and Energy
          <ul>
            <li>Read: Chapters 4-6</li>
            <li>Lab: Calorimetry experiment</li>
          </ul>
        </li>
      </ol>`,
    )
    expect(content).toContain('Thermodynamics')
    expect(content).toContain('Problem Set 1')
    expect(content).toContain('Heat Transfer')
    expect(content).toContain('Calorimetry')
  })

  test('adjacent ol and ul siblings — both preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<p>Required (in order):</p>
      <ol>
        <li>Submit draft by Monday</li>
        <li>Peer review by Wednesday</li>
        <li>Final submission by Friday</li>
      </ol>
      <p>Optional extras:</p>
      <ul>
        <li>Office hours visit</li>
        <li>Writing center appointment</li>
      </ul>`,
    )
    expect(content).toContain('Submit draft')
    expect(content).toContain('Peer review')
    expect(content).toContain('Office hours visit')
    expect(content).toContain('Writing center')
  })
})
