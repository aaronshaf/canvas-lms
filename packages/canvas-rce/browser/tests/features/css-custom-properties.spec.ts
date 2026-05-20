import {test, expect} from '../../fixtures/test'

// CSS custom properties (CSS variables) in inline styles are modern CSS.
// They appear in content pasted from design tools or authored with custom
// themes. TinyMCE may preserve or strip them — text must always survive.
// Tests document actual round-trip behavior for refactor compliance.
test.describe('CSS custom properties in inline styles', () => {
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

  test('text in element with CSS variable style is preserved', async ({page}) => {
    const content = await setAndGet(page, '<p style="color: var(--primary-color);">Themed text</p>')
    expect(content).toContain('Themed text')
  })

  test('text with custom property for font-size is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="font-size: var(--body-font-size);">Variable font size text</p>',
    )
    expect(content).toContain('Variable font size text')
  })

  test('element with multiple CSS variables — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="color: var(--text-color); background: var(--bg-color); padding: var(--spacing);">Multi-variable div</div>',
    )
    expect(content).toContain('Multi-variable div')
  })

  test('CSS variable fallback value — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="color: var(--accent, #0066cc);">Fallback color text</p>',
    )
    expect(content).toContain('Fallback color text')
  })

  test('CSS calc() with variable — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="margin-top: calc(var(--spacing) * 2);">Calculated margin text</p>',
    )
    expect(content).toContain('Calculated margin text')
  })

  test('nested elements with CSS variables all preserve text', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="--custom: blue;"><p style="color: var(--custom);">Child with var</p></div>',
    )
    expect(content).toContain('Child with var')
  })
})
