import {test, expect} from '../../fixtures/test'

// The `summary` attribute on <table> was deprecated in HTML5 but still appears
// in legacy Canvas course content exported from older LMS systems or Word.
// Additionally, `scope`, `headers`, `axis`, and `abbr` on <th>/<td> carry
// accessibility semantics for complex data tables used in rubrics and schedules.
test.describe('table accessibility and legacy attributes', () => {
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

  test('table with summary attribute — cell text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table summary="Course schedule with days and times"><tr><th>Day</th><th>Time</th></tr><tr><td>Monday</td><td>9:00 AM</td></tr></table>',
    )
    expect(content).toContain('Monday')
    expect(content).toContain('9:00 AM')
  })

  test('th with abbr attribute — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><th abbr="Name">Student Name</th><th abbr="Grade">Final Grade</th></tr><tr><td>Jane Doe</td><td>A</td></tr></table>',
    )
    expect(content).toContain('Student Name')
    expect(content).toContain('Jane Doe')
  })

  test('td with headers attribute — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><th id="hdr-name">Name</th><th id="hdr-score">Score</th></tr><tr><td headers="hdr-name">Alice</td><td headers="hdr-score">95</td></tr></table>',
    )
    expect(content).toContain('Alice')
    expect(content).toContain('95')
  })

  test('th with scope="colgroup" — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><th scope="col">Week</th><th scope="colgroup" colspan="2">Grades</th></tr><tr><td>1</td><td>88</td><td>92</td></tr></table>',
    )
    expect(content).toContain('Week')
    expect(content).toContain('Grades')
    expect(content).toContain('88')
  })

  test('table with axis attribute on cells — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td axis="criteria">Participation</td><td axis="score">10</td></tr></table>',
    )
    expect(content).toContain('Participation')
    expect(content).toContain('10')
  })
})
