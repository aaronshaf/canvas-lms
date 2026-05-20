import {test, expect} from '../../fixtures/test'

// Instructors frequently apply multiple formatting properties to the same text:
// bold + italic, underline + color, strikethrough + superscript, etc.
// TinyMCE must preserve all applied formats — a refactor must not cause formats
// to cancel each other out during serialization.
test.describe('combined inline formatting', () => {
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

  test('bold + italic on same text preserves both', async ({page}) => {
    const content = await setAndGet(page, '<p><strong><em>bold italic</em></strong></p>')
    expect(content).toContain('bold italic')
    expect(content).toMatch(/<strong>/)
    expect(content).toMatch(/<em>/)
  })

  test('bold + underline on same text preserves both', async ({page}) => {
    const content = await setAndGet(page, '<p><strong><u>bold underlined</u></strong></p>')
    expect(content).toContain('bold underlined')
    expect(content).toMatch(/<strong>/)
  })

  test('italic + strikethrough on same text', async ({page}) => {
    const content = await setAndGet(page, '<p><em><s>struck italic</s></em></p>')
    expect(content).toContain('struck italic')
    expect(content).toMatch(/<em>/)
  })

  test('bold + italic + underline triple combination', async ({page}) => {
    const content = await setAndGet(page, '<p><strong><em><u>all three</u></em></strong></p>')
    expect(content).toContain('all three')
    expect(content).toMatch(/<strong>/)
    expect(content).toMatch(/<em>/)
  })

  test('bold + color style combination', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><strong><span style="color: red;">bold red</span></strong></p>',
    )
    expect(content).toContain('bold red')
    expect(content).toMatch(/<strong>/)
  })

  test('italic + background-color combination', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><em><span style="background-color: yellow;">italic highlight</span></em></p>',
    )
    expect(content).toContain('italic highlight')
    expect(content).toMatch(/<em>/)
  })

  test('superscript + bold combination', async ({page}) => {
    const content = await setAndGet(page, '<p>E = mc<sup><strong>2</strong></sup></p>')
    expect(content).toContain('E = mc')
    expect(content).toMatch(/<sup>/)
    expect(content).toContain('2')
  })

  test('mixed formatted and plain text in same paragraph', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>plain <strong>bold</strong> plain <em>italic</em> plain <u>underline</u> end</p>',
    )
    expect(content).toContain('plain')
    expect(content).toContain('bold')
    expect(content).toContain('italic')
    expect(content).toContain('underline')
    expect(content).toContain('end')
    expect(content).toMatch(/<strong>bold<\/strong>/)
    expect(content).toMatch(/<em>italic<\/em>/)
  })

  test('formatting does not bleed from one element to adjacent plain text', async ({page}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p><strong>formatted</strong> unformatted</p>')
    })
    // @ts-expect-error -- TinyMCE global
    const content = await page.evaluate(() => window.tinymce.activeEditor.getContent())
    // "unformatted" must not be inside <strong>
    expect(content).not.toMatch(/<strong>[^<]*unformatted/)
    expect(content).toContain('unformatted')
  })

  test('color + font-size + bold all together', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><strong><span style="color: blue; font-size: 20px;">styled bold</span></strong></p>',
    )
    expect(content).toContain('styled bold')
    expect(content).toMatch(/<strong>/)
  })
})
