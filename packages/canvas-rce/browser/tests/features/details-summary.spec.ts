import {test, expect} from '../../fixtures/test'

// <details>/<summary> are HTML5 disclosure widgets used to create expandable
// FAQ sections and spoilers in course content. TinyMCE may preserve or strip
// them — this documents actual behavior so a refactor can detect regressions.
test.describe('details and summary elements', () => {
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

  test('<details> content text is preserved regardless of element handling', async ({page}) => {
    const content = await setAndGet(
      page,
      '<details><summary>Click to expand</summary><p>Hidden content revealed on click.</p></details>',
    )
    // Even if element is stripped, text must survive
    expect(content).toContain('Click to expand')
    expect(content).toContain('Hidden content revealed on click')
  })

  test('<summary> text is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<details><summary>FAQ: What is Canvas?</summary><p>Canvas is an LMS.</p></details>',
    )
    expect(content).toContain('FAQ: What is Canvas')
    expect(content).toContain('Canvas is an LMS')
  })

  test('multiple details elements all preserve their content', async ({page}) => {
    const content = await setAndGet(
      page,
      `<details><summary>Question 1</summary><p>Answer 1</p></details>
       <details><summary>Question 2</summary><p>Answer 2</p></details>
       <details><summary>Question 3</summary><p>Answer 3</p></details>`,
    )
    expect(content).toContain('Question 1')
    expect(content).toContain('Answer 1')
    expect(content).toContain('Question 2')
    expect(content).toContain('Answer 2')
    expect(content).toContain('Question 3')
    expect(content).toContain('Answer 3')
  })

  test('<details> with open attribute content is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<details open><summary>Always visible</summary><p>Pre-expanded content.</p></details>',
    )
    expect(content).toContain('Always visible')
    expect(content).toContain('Pre-expanded content')
  })

  test('formatted text inside details body is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<details><summary>Hint</summary><p>Use <strong>bold</strong> for emphasis and <em>italic</em> for terms.</p></details>',
    )
    expect(content).toContain('Hint')
    expect(content).toContain('bold')
    expect(content).toContain('italic')
  })
})
