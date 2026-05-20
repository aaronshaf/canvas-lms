import {test, expect} from '../../fixtures/test'

// Line height affects readability, especially for students with dyslexia or
// visual impairments. Accessibility guidelines (WCAG 1.4.12) recommend
// line-height of at least 1.5. Instructors set this via inline styles;
// canvas-rce must preserve line-height values through serialization.
test.describe('line-height CSS property', () => {
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

  test('line-height unitless value on paragraph is handled', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="line-height: 1.8;">Spacious readable text for students.</p>',
    )
    expect(content).toContain('Spacious readable text')
  })

  test('line-height in pixels on paragraph is handled', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="line-height: 28px;">Fixed pixel line height.</p>',
    )
    expect(content).toContain('Fixed pixel line height')
  })

  test('line-height in em units is handled', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="line-height: 2em;">Double spaced paragraph.</p>',
    )
    expect(content).toContain('Double spaced paragraph')
  })

  test('line-height combined with font-size is handled', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="line-height: 1.6; font-size: 16px;">Readable body copy.</p>',
    )
    expect(content).toContain('Readable body copy')
  })

  test('line-height on a heading is handled', async ({page}) => {
    const content = await setAndGet(page, '<h2 style="line-height: 1.2;">Tight heading</h2>')
    expect(content).toContain('Tight heading')
    expect(content).toMatch(/<h2/)
  })

  test('line-height on span within paragraph is handled', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Normal <span style="line-height: 2;">double-spaced span</span> normal.</p>',
    )
    expect(content).toContain('double-spaced span')
    expect(content).toContain('Normal')
    expect(content).toContain('normal')
  })

  test('multiple paragraphs each with different line-heights preserve all text', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="line-height: 1.4;">Tight paragraph.</p><p style="line-height: 2.0;">Loose paragraph.</p>',
    )
    expect(content).toContain('Tight paragraph')
    expect(content).toContain('Loose paragraph')
  })
})
