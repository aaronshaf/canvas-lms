import {test, expect} from '../../fixtures/test'

// Canvas content uses both absolute URLs (https://...) and relative URLs
// (/courses/123/files/456). Relative URLs in href, src, and action must be
// preserved exactly — rewriting them would break navigation and asset loading
// in Canvas course pages.
test.describe('relative URLs in href, src, and other attributes', () => {
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

  test('relative href link text is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><a href="/courses/123/pages/syllabus">View Syllabus</a></p>',
    )
    expect(content).toContain('View Syllabus')
    expect(content).toContain('/courses/123')
  })

  test('relative img src — alt text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><img src="/files/456/download" alt="Course diagram" /></p>',
    )
    expect(content).toContain('alt')
    expect(content).toContain('Course diagram')
  })

  test('root-relative URL in link — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>Go to <a href="/login">login page</a> first.</p>')
    expect(content).toContain('login page')
    expect(content).toContain('first')
  })

  test('../ relative URL in link — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<p><a href="../modules/week-1">Week 1 Module</a></p>')
    expect(content).toContain('Week 1 Module')
  })

  test('Canvas LTI iframe relative src — text around it preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Tool below:</p><iframe src="/courses/123/external_tools/456" width="800" height="600"></iframe><p>After tool.</p>',
    )
    expect(content).toContain('Tool below')
    expect(content).toContain('After tool')
  })

  test('multiple relative links — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul><li><a href="/courses/1/assignments">Assignments</a></li><li><a href="/courses/1/quizzes">Quizzes</a></li><li><a href="/courses/1/grades">Grades</a></li></ul>',
    )
    expect(content).toContain('Assignments')
    expect(content).toContain('Quizzes')
    expect(content).toContain('Grades')
  })
})
