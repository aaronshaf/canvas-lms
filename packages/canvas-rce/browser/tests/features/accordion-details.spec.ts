import {test, expect} from '../../fixtures/test'

// Multiple <details>/<summary> elements create accordion-style UI for FAQs,
// glossaries, and expandable course sections. Canvas course designers use
// this pattern to reduce cognitive load on long pages. All summary labels
// and body content must survive round-trips.
test.describe('accordion pattern with multiple <details>/<summary> elements', () => {
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

  test('three-section accordion — all summaries preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<details><summary>Question 1</summary><p>Answer to question 1.</p></details><details><summary>Question 2</summary><p>Answer to question 2.</p></details><details><summary>Question 3</summary><p>Answer to question 3.</p></details>',
    )
    expect(content).toContain('Question 1')
    expect(content).toContain('Question 2')
    expect(content).toContain('Question 3')
    expect(content).toContain('Answer to question 1')
    expect(content).toContain('Answer to question 3')
  })

  test('details with open attribute — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<details open><summary>Visible section</summary><p>This section starts open.</p></details>',
    )
    expect(content).toContain('Visible section')
    expect(content).toContain('This section starts open')
  })

  test('nested details inside a details body — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<details><summary>Outer topic</summary><p>Outer content.</p><details><summary>Sub-topic</summary><p>Sub-content.</p></details></details>',
    )
    expect(content).toContain('Outer topic')
    expect(content).toContain('Outer content')
    expect(content).toContain('Sub-topic')
    expect(content).toContain('Sub-content')
  })

  test('accordion with mixed content types — all preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<details><summary>Term definition</summary><dl><dt>Term</dt><dd>Definition here.</dd></dl></details><details><summary>Code example</summary><pre><code>sample code</code></pre></details>',
    )
    expect(content).toContain('Term definition')
    expect(content).toContain('Definition here')
    expect(content).toContain('Code example')
    expect(content).toContain('sample code')
  })

  test('details with heading as summary — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<details><summary><h3>FAQ: How do I submit?</h3></summary><p>Submit via the Assignments page.</p></details>',
    )
    expect(content).toContain('How do I submit')
    expect(content).toContain('Submit via the Assignments page')
  })
})
