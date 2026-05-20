import {test, expect} from '../../fixtures/test'

// Box model CSS properties (margin, padding, border) in inline styles control
// spacing and layout. They appear in content pasted from design tools and in
// Canvas page layouts. TinyMCE may preserve or strip these — text must survive
// regardless. Tests document round-trip behavior for refactor compliance.
test.describe('box model CSS in inline styles', () => {
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

  test('margin on a paragraph — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<p style="margin: 20px 0;">Margin paragraph</p>')
    expect(content).toContain('Margin paragraph')
  })

  test('padding on a div — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<div style="padding: 16px;">Padded content</div>')
    expect(content).toContain('Padded content')
  })

  test('border on a paragraph — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="border: 1px solid #ccc;">Bordered paragraph</p>',
    )
    expect(content).toContain('Bordered paragraph')
  })

  test('margin-left for indentation — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<p style="margin-left: 2em;">Indented text</p>')
    expect(content).toContain('Indented text')
  })

  test('combined box model properties — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="margin: 10px; padding: 8px; border: 2px solid navy; border-radius: 4px;">Styled box</div>',
    )
    expect(content).toContain('Styled box')
  })

  test('box-sizing and overflow — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="box-sizing: border-box; overflow: auto; max-height: 300px;">Overflow container text</div>',
    )
    expect(content).toContain('Overflow container text')
  })

  test('negative margin — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<p style="margin-top: -10px;">Negative margin text</p>')
    expect(content).toContain('Negative margin text')
  })
})
