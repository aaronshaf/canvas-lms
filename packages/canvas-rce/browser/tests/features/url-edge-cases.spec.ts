import {test, expect} from '../../fixtures/test'

// URLs in href/src attributes may have query strings, fragments, encoded chars,
// and port numbers. Instructors paste these from browser address bars or LMS
// deep links. The link text must survive; URL manipulation is Canvas's job.
test.describe('URL edge cases in href and src attributes', () => {
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

  test('href with query string — link text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><a href="/courses/1/assignments?module_item_id=42&per_page=10">Module Assignment</a></p>',
    )
    expect(content).toContain('Module Assignment')
  })

  test('href with fragment — link text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><a href="/courses/1/pages/intro#section-2">Jump to Section 2</a></p>',
    )
    expect(content).toContain('Jump to Section 2')
  })

  test('href with query + fragment — link text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><a href="/search?q=algorithm+design&page=2#results">Search results</a></p>',
    )
    expect(content).toContain('Search results')
  })

  test('href with encoded characters — link text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><a href="/files/My%20Course%20Notes%20(Spring%202025).pdf">Course Notes</a></p>',
    )
    expect(content).toContain('Course Notes')
  })

  test('link with rel="noopener noreferrer" and target="_blank" — text preserved', async ({
    page,
  }) => {
    const content = await setAndGet(
      page,
      '<p><a href="https://example.edu/resource" target="_blank" rel="noopener noreferrer">External resource (opens in new tab)</a></p>',
    )
    expect(content).toContain('External resource')
  })

  test('link with rel="nofollow" — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><a href="https://example.com" rel="nofollow">External link</a></p>',
    )
    expect(content).toContain('External link')
  })

  test('Canvas deep link with multiple params — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><a href="/courses/123/quizzes/456?module_item_id=789&quiz_submission_id=012">Quiz: Midterm Exam</a></p>',
    )
    expect(content).toContain('Quiz: Midterm Exam')
  })

  test('data: URI in href — link text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><a href="data:text/plain,hello">Data URI link text</a></p>',
    )
    expect(content).toContain('Data URI link text')
  })
})
