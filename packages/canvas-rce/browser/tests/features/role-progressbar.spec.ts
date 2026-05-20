import {test, expect} from '../../fixtures/test'

// role="progressbar" with aria-valuenow/valuemin/valuemax marks loading bars
// and course completion indicators. role="status" marks live status regions.
// role="log" marks append-only activity logs. These appear in custom
// interactive course widgets and must survive TinyMCE's serialization.
test.describe('ARIA live region and progress roles', () => {
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

  test('role="progressbar" with aria-valuenow — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Course progress:</p><div role="progressbar" aria-valuenow="65" aria-valuemin="0" aria-valuemax="100" aria-label="65% complete">65%</div>',
    )
    expect(content).toContain('Course progress')
    expect(content).toContain('65%')
  })

  test('role="progressbar" indeterminate (no valuenow) — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div role="progressbar" aria-label="Loading...">Loading content, please wait.</div>',
    )
    expect(content).toContain('Loading content')
  })

  test('role="status" live region — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div role="status" aria-live="polite">Saved successfully.</div>',
    )
    expect(content).toContain('Saved successfully')
  })

  test('role="log" activity log — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div role="log" aria-live="polite"><p>User logged in at 9:00 AM</p><p>Assignment submitted at 10:30 AM</p></div>',
    )
    expect(content).toContain('User logged in')
    expect(content).toContain('Assignment submitted')
  })

  test('role="timer" countdown — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div role="timer" aria-live="off" aria-label="Time remaining">45:00</div>',
    )
    expect(content).toContain('45:00')
  })

  test('role="marquee" — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div role="marquee" aria-label="Announcements">Office hours cancelled today. Quiz rescheduled to Friday.</div>',
    )
    expect(content).toContain('Office hours cancelled')
    expect(content).toContain('Quiz rescheduled to Friday')
  })
})
