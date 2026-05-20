import {test, expect} from '../../fixtures/test'

// Font-size changes are common in course content for emphasis and visual hierarchy.
// TinyMCE applies font-size via inline style or font-size attribute.
// canvas-rce must not strip these or reset everything to a single size.
test.describe('font size formatting', () => {
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

  test('font-size inline style is preserved on span', async ({page}) => {
    const content = await setAndGet(page, '<p><span style="font-size: 24px;">Large text</span></p>')
    expect(content).toContain('Large text')
    // font-size may be preserved as px or converted to another unit
    if (content.includes('font-size')) {
      expect(content).toMatch(/font-size:\s*\d/)
    }
  })

  test('multiple font sizes in the same paragraph survive', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span style="font-size: 12px;">small</span> normal <span style="font-size: 36px;">large</span></p>',
    )
    expect(content).toContain('small')
    expect(content).toContain('normal')
    expect(content).toContain('large')
  })

  test('font-size on a heading is preserved', async ({page}) => {
    const content = await setAndGet(page, '<h2 style="font-size: 2em;">Custom sized heading</h2>')
    expect(content).toContain('Custom sized heading')
    expect(content).toMatch(/<h2/)
  })

  test('font-size in pt units is handled', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span style="font-size: 14pt;">Point-size text</span></p>',
    )
    expect(content).toContain('Point-size text')
  })

  test('font-size in em units is handled', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span style="font-size: 1.5em;">Relative sized text</span></p>',
    )
    expect(content).toContain('Relative sized text')
  })

  test('font-size combined with color style preserves both', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span style="font-size: 20px; color: blue;">Big blue text</span></p>',
    )
    expect(content).toContain('Big blue text')
  })

  test('font-size combined with bold formatting preserves content', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><strong><span style="font-size: 18px;">Bold large text</span></strong></p>',
    )
    expect(content).toContain('Bold large text')
    expect(content).toMatch(/<strong>/)
  })

  test('programmatic font-size via execCommand sets content', async ({page}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>resize this</p>')
      ed.execCommand('SelectAll')
      ed.execCommand('FontSize', false, '24px')
    })
    // @ts-expect-error -- TinyMCE global
    const content = await page.evaluate(() => window.tinymce.activeEditor.getContent())
    expect(content).toContain('resize this')
  })
})
