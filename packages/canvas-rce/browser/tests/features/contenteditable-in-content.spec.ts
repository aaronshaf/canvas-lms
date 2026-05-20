import {test, expect} from '../../fixtures/test'

// The contenteditable attribute can be set to "true", "false", or "inherit"
// on elements within content. contenteditable="false" is used to mark
// non-editable regions (e.g. math equation placeholders, LTI embed markers).
// Tests document how TinyMCE handles this attribute through round-trips.
test.describe('contenteditable attribute in content elements', () => {
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

  test('contenteditable="false" on a span — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Regular text and <span contenteditable="false">locked span</span> more text.</p>',
    )
    expect(content).toContain('locked span')
    expect(content).toContain('more text')
  })

  test('contenteditable="false" on a div — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Before locked region.</p><div contenteditable="false"><p>Non-editable content</p></div><p>After locked region.</p>',
    )
    expect(content).toContain('Non-editable content')
    expect(content).toContain('Before locked region')
    expect(content).toContain('After locked region')
  })

  test('contenteditable="false" on math placeholder — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Equation: <span class="math_equation_latex" contenteditable="false">\\frac{a}{b}</span> end.</p>',
    )
    expect(content).toContain('frac')
    expect(content).toContain('end')
  })

  test('nested contenteditable="true" inside false — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div contenteditable="false"><p>Outer locked.</p><div contenteditable="true">Inner editable.</div></div>',
    )
    expect(content).toContain('Outer locked')
    expect(content).toContain('Inner editable')
  })
})
