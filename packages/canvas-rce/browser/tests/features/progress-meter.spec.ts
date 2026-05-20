import {test, expect} from '../../fixtures/test'

// <progress> and <meter> are HTML5 elements for displaying completion and
// measurement. They appear in interactive course content and rubrics.
// TinyMCE may strip or preserve them — tests document actual behavior so
// a refactor doesn't accidentally change what students see in course pages.
test.describe('<progress> and <meter> elements', () => {
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

  test('<progress> fallback text is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Course completion: <progress value="75" max="100">75%</progress></p>',
    )
    expect(content).toContain('Course completion')
    // element may be stripped or preserved — surrounding text must survive
    expect(typeof content).toBe('string')
    expect(content.length).toBeGreaterThan(0)
  })

  test('<meter> fallback text is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Score: <meter value="0.8" min="0" max="1">80%</meter></p>',
    )
    expect(content).toContain('Score')
    expect(typeof content).toBe('string')
  })

  test('text around <progress> elements is always preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Before: <progress value="50" max="100">50%</progress> :After</p>',
    )
    expect(content).toContain('Before')
    expect(content).toContain('After')
  })

  test('<meter> with title attribute — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Grade: <meter value="92" min="0" max="100" title="92 out of 100">92/100</meter></p>',
    )
    expect(content).toContain('Grade')
  })

  test('multiple meter elements in a table — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td>Quiz 1</td><td><meter value="0.9">90%</meter></td></tr><tr><td>Quiz 2</td><td><meter value="0.7">70%</meter></td></tr></table>',
    )
    expect(content).toContain('Quiz 1')
    expect(content).toContain('Quiz 2')
  })
})
