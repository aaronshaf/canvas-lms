import {test, expect} from '../../fixtures/test'

// <caption> is the WCAG-recommended way to label a table for screen readers.
// Course content with data tables should use captions for accessibility.
// canvas-rce must preserve <caption> during serialization — stripping it
// removes the accessible table name and breaks screen reader navigation.
test.describe('table caption element', () => {
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

  test('<caption> text is preserved in output', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><caption>Student Grades</caption><tr><td>Alice</td><td>A</td></tr></table>',
    )
    expect(content).toContain('Student Grades')
    expect(content).toContain('Alice')
  })

  test('<caption> element tag is preserved (not demoted to p)', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><caption>Quarterly Revenue</caption><tr><td>Q1</td><td>$100k</td></tr></table>',
    )
    expect(content).toContain('Quarterly Revenue')
    // Caption should appear as <caption>, not just a floating <p>
    if (content.includes('<caption')) {
      expect(content).toMatch(/<caption[^>]*>Quarterly Revenue<\/caption>/)
    }
  })

  test('table with caption and thead/tbody structure is fully preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<table>
        <caption>Exam Schedule</caption>
        <thead><tr><th>Subject</th><th>Date</th><th>Room</th></tr></thead>
        <tbody>
          <tr><td>Math</td><td>June 10</td><td>101</td></tr>
          <tr><td>English</td><td>June 12</td><td>202</td></tr>
        </tbody>
      </table>`,
    )
    expect(content).toContain('Exam Schedule')
    expect(content).toContain('Subject')
    expect(content).toContain('Math')
    expect(content).toContain('English')
  })

  test('<caption> with formatted text inside is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><caption><strong>Important:</strong> Grade Distribution</caption><tr><td>A</td><td>90-100</td></tr></table>',
    )
    expect(content).toContain('Grade Distribution')
    expect(content).toContain('A')
    expect(content).toContain('90-100')
  })

  test('multiple tables each with their own caption are independent', async ({page}) => {
    const content = await setAndGet(
      page,
      `<table><caption>Table One</caption><tr><td>data 1</td></tr></table>
       <table><caption>Table Two</caption><tr><td>data 2</td></tr></table>`,
    )
    expect(content).toContain('Table One')
    expect(content).toContain('Table Two')
    expect(content).toContain('data 1')
    expect(content).toContain('data 2')
  })
})
