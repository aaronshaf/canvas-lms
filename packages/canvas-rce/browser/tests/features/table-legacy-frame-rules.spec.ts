import {test, expect} from '../../fixtures/test'

// HTML4 table presentation attributes (frame, rules, border) appear in content
// migrated from legacy CMS systems into Canvas. frame controls which outer
// borders appear, rules controls which inner dividers show, border sets width.
// Canvas instructors paste this content from old course exports; the cell
// text must survive regardless of whether TinyMCE preserves the attributes.
test.describe('legacy table frame and rules attributes', () => {
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

  test('table with frame="box" — cell content preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table frame="box" border="1"><tr><th>Course</th><th>Credits</th></tr><tr><td>Introduction to Biology</td><td>4</td></tr></table>',
    )
    expect(content).toContain('Introduction to Biology')
    expect(content).toContain('Credits')
  })

  test('table with rules="rows" — row data preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table rules="rows" border="1"><caption>Grade Distribution</caption><tr><th>Grade</th><th>Count</th></tr><tr><td>A</td><td>12</td></tr><tr><td>B</td><td>18</td></tr></table>',
    )
    expect(content).toContain('Grade Distribution')
    expect(content).toContain('Count')
  })

  test('table with rules="cols" — column headers preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table rules="cols"><tr><th>Week</th><th>Topic</th><th>Reading</th></tr><tr><td>1</td><td>Introduction</td><td>Chapter 1-2</td></tr></table>',
    )
    expect(content).toContain('Chapter 1-2')
    expect(content).toContain('Topic')
  })

  test('table with rules="all" and cellpadding — content preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table rules="all" border="2" cellpadding="5" cellspacing="0"><tr><td>Assignment Name</td><td>Due Date</td><td>Points</td></tr><tr><td>Lab Report</td><td>Friday</td><td>50</td></tr></table>',
    )
    expect(content).toContain('Assignment Name')
    expect(content).toContain('Lab Report')
    expect(content).toContain('Points')
  })

  test('table with frame="hsides" — header and data preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table frame="hsides"><thead><tr><th>Category</th><th>Score</th></tr></thead><tbody><tr><td>Participation</td><td>95</td></tr></tbody></table>',
    )
    expect(content).toContain('Participation')
    expect(content).toContain('Category')
  })
})
