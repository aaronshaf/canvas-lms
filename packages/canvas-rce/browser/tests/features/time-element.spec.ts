import {test, expect} from '../../fixtures/test'

// <time> is an HTML5 semantic element for dates and times.
// The datetime attribute provides machine-readable format while the element
// content shows human-readable text. It appears in course schedules,
// assignment due dates embedded in content, and event announcements.
test.describe('<time> element with datetime attribute', () => {
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

  test('<time> visible text is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Assignment due: <time datetime="2025-05-30">May 30, 2025</time></p>',
    )
    expect(content).toContain('May 30, 2025')
    expect(content).toContain('Assignment due')
  })

  test('<time> with datetime attribute survives round-trip', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>The event is on <time datetime="2025-06-15T14:00">June 15 at 2pm</time>.</p>',
    )
    expect(content).toContain('June 15 at 2pm')
  })

  test('multiple <time> elements in a schedule all preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul><li>Week 1: <time datetime="2025-09-01">September 1</time></li><li>Week 2: <time datetime="2025-09-08">September 8</time></li></ul>',
    )
    expect(content).toContain('September 1')
    expect(content).toContain('September 8')
  })

  test('<time> inside a table cell is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><th>Deadline</th></tr><tr><td><time datetime="2025-12-01">Dec 1, 2025</time></td></tr></table>',
    )
    expect(content).toContain('Dec 1, 2025')
    expect(content).toContain('Deadline')
  })

  test('<time> with duration format is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Exam duration: <time datetime="PT2H30M">2 hours 30 minutes</time></p>',
    )
    expect(content).toContain('2 hours 30 minutes')
    expect(content).toContain('Exam duration')
  })
})
