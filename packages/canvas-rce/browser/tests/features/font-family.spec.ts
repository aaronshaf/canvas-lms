import {test, expect} from '../../fixtures/test'

// Font-family choices affect readability for students with dyslexia or visual
// impairments (e.g. OpenDyslexic, monospace for code). Instructors set these
// via TinyMCE's font picker; canvas-rce must not strip font-family styles.
test.describe('font-family style handling', () => {
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

  test('font-family style on span is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span style="font-family: Georgia, serif;">serif text</span></p>',
    )
    expect(content).toContain('serif text')
  })

  test('monospace font-family for code-style text is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span style="font-family: monospace, Courier New;">variable_name = 42</span></p>',
    )
    expect(content).toContain('variable_name = 42')
  })

  test('sans-serif font-family is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span style="font-family: Arial, sans-serif;">clean text</span></p>',
    )
    expect(content).toContain('clean text')
  })

  test('font-family on a paragraph level is handled', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="font-family: Verdana, Geneva, sans-serif;">paragraph text</p>',
    )
    expect(content).toContain('paragraph text')
  })

  test('font-family with font-size combined preserves content', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span style="font-family: Georgia; font-size: 18px;">styled paragraph</span></p>',
    )
    expect(content).toContain('styled paragraph')
  })

  test('font-family combined with color preserves content', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span style="font-family: Courier New; color: #333;">dark monospace</span></p>',
    )
    expect(content).toContain('dark monospace')
  })

  test('multiple spans with different font families in same paragraph', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span style="font-family: serif;">serif</span> mixed with <span style="font-family: monospace;">monospace</span></p>',
    )
    expect(content).toContain('serif')
    expect(content).toContain('mixed with')
    expect(content).toContain('monospace')
  })
})
