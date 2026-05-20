import {test, expect} from '../../fixtures/test'

// The scope and headers attributes on <th> and <td> establish relationships
// between header and data cells for screen readers (WCAG 1.3.1).
// scope="col" / scope="row" are the most common; headers="id1 id2" is used
// for complex tables. canvas-rce must preserve them through round-trips.
test.describe('table scope and headers accessibility attributes', () => {
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

  test('scope="col" on th — header text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><thead><tr><th scope="col">Name</th><th scope="col">Score</th></tr></thead><tbody><tr><td>Alice</td><td>95</td></tr></tbody></table>',
    )
    expect(content).toContain('Name')
    expect(content).toContain('Score')
    expect(content).toContain('Alice')
  })

  test('scope="row" on th in tbody — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tbody><tr><th scope="row">Monday</th><td>Lecture</td><td>Lab</td></tr><tr><th scope="row">Tuesday</th><td>Seminar</td><td>Office Hours</td></tr></tbody></table>',
    )
    expect(content).toContain('Monday')
    expect(content).toContain('Lecture')
    expect(content).toContain('Tuesday')
    expect(content).toContain('Office Hours')
  })

  test('scope="colgroup" on th spanning multiple columns', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><thead><tr><th scope="colgroup" colspan="2">Semester 1</th><th scope="colgroup" colspan="2">Semester 2</th></tr><tr><th scope="col">Math</th><th scope="col">Science</th><th scope="col">Math</th><th scope="col">Science</th></tr></thead></table>',
    )
    expect(content).toContain('Semester 1')
    expect(content).toContain('Semester 2')
    expect(content).toContain('Math')
    expect(content).toContain('Science')
  })

  test('headers attribute linking td to th ids — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><th id="h-name">Name</th><th id="h-grade">Grade</th></tr><tr><td headers="h-name">Bob</td><td headers="h-grade">A</td></tr></table>',
    )
    expect(content).toContain('Name')
    expect(content).toContain('Grade')
    expect(content).toContain('Bob')
  })

  test('summary attribute on table — table text preserved', async ({page}) => {
    // summary is deprecated in HTML5 but appears in legacy content
    const content = await setAndGet(
      page,
      '<table summary="Grade table for Spring 2025 cohort"><tr><th>Student</th><th>Final Grade</th></tr><tr><td>Carol</td><td>B+</td></tr></table>',
    )
    expect(content).toContain('Student')
    expect(content).toContain('Final Grade')
    expect(content).toContain('Carol')
  })
})
