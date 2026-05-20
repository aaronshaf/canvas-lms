import {test, expect} from '../../fixtures/test'

// contenteditable="false" creates non-editable islands inside TinyMCE.
// Canvas uses this pattern for inline media embeds, equation widgets, and
// placeholder elements that the user cannot directly edit. The surrounding
// editable content must still be preserved across round-trips.
test.describe('contenteditable="false" non-editable island elements', () => {
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

  test('contenteditable="false" span — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Before <span contenteditable="false">Non-editable widget</span> after.</p>',
    )
    expect(content).toContain('Before')
    expect(content).toContain('after')
  })

  test('contenteditable="false" div — surrounding paragraphs preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Intro paragraph.</p><div contenteditable="false"><p>Locked content block</p></div><p>Continued text here.</p>',
    )
    expect(content).toContain('Intro paragraph')
    expect(content).toContain('Continued text here')
  })

  test('canvas equation placeholder with contenteditable=false — text preserved', async ({
    page,
  }) => {
    const content = await setAndGet(
      page,
      '<p>The formula <span contenteditable="false" data-equation-content="x^2+y^2=r^2" class="MathJax_Preview">x²+y²=r²</span> describes a circle.</p>',
    )
    expect(content).toContain('describes a circle')
  })

  test('contenteditable="true" nested inside false — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div contenteditable="false"><div contenteditable="true"><p>Nested editable inside non-editable</p></div></div>',
    )
    expect(typeof content).toBe('string')
  })

  test('multiple contenteditable=false spans in paragraph — text around preserved', async ({
    page,
  }) => {
    const content = await setAndGet(
      page,
      '<p>Start <span contenteditable="false">[Widget A]</span> middle <span contenteditable="false">[Widget B]</span> end.</p>',
    )
    expect(content).toContain('Start')
    expect(content).toContain('middle')
    expect(content).toContain('end')
  })
})
