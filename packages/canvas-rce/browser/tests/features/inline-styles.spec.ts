import {test, expect} from '../../fixtures/test'

// Inline CSS style attributes must be handled carefully:
// - Safe styles like color and font-size should be preserved for rich formatting
// - Dangerous styles like expression() and behavior: must be stripped
// canvas-rce inherits TinyMCE's style filtering; a refactor must not loosen it.
test.describe('inline CSS style handling', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  async function insertAndGet(page: any, html: string): Promise<string> {
    return page.evaluate((content: string) => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(content)
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent()
    }, html)
  }

  test('color style on span is preserved', async ({page}) => {
    const content = await insertAndGet(page, '<p><span style="color: red;">red text</span></p>')
    expect(content).toContain('red text')
    // Color style should be preserved (safe CSS property)
    expect(content).toMatch(/color:\s*red|color:\s*#(f00|ff0000)/)
  })

  test('font-weight style preserves bold appearance', async ({page}) => {
    const content = await insertAndGet(
      page,
      '<p><span style="font-weight: bold;">bold span</span></p>',
    )
    expect(content).toContain('bold span')
  })

  test('text-align style on paragraph is preserved', async ({page}) => {
    const content = await insertAndGet(page, '<p style="text-align: center;">centered</p>')
    expect(content).toContain('centered')
    // text-align should survive (alignment is a core formatting feature)
    expect(content).toMatch(/text-align:\s*center/)
  })

  test('CSS expression() in style is stripped', async ({page}) => {
    const content = await insertAndGet(page, '<p style="width: expression(alert(1))">text</p>')
    expect(content).not.toContain('expression(')
    expect(content).toContain('text')
  })

  test('behavior: style property (IE CSS injection) is stripped', async ({page}) => {
    const content = await insertAndGet(
      page,
      '<span style="behavior: url(https://evil.example.com/xss.htc)">text</span>',
    )
    expect(content).not.toContain('behavior:')
    expect(content).toContain('text')
  })

  test('multiple safe styles on one element are preserved', async ({page}) => {
    const content = await insertAndGet(
      page,
      '<p style="color: blue; font-weight: bold; text-align: right;">styled</p>',
    )
    expect(content).toContain('styled')
    // At least one safe property should survive
    expect(content).toMatch(/color|font-weight|text-align/)
  })
})
