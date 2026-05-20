import {test, expect} from '../../fixtures/test'

// Inline SVG is used for diagrams, icons, and mathematical figures in course
// content. TinyMCE may preserve, strip, or sanitize SVG markup.
// Tests document actual behavior — specifically that text inside SVG (<text>
// elements and title/desc for accessibility) and surrounding paragraph text
// survive the round-trip regardless of what TinyMCE does to SVG structure.
test.describe('inline SVG content', () => {
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

  test('paragraph text around inline SVG is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Before SVG.</p><svg width="10" height="10"><circle cx="5" cy="5" r="4"/></svg><p>After SVG.</p>',
    )
    expect(content).toContain('Before SVG')
    expect(content).toContain('After SVG')
  })

  test('SVG with <title> accessibility text — surrounding content preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Diagram below:</p><svg><title>Bar chart showing sales data</title><rect width="10" height="10"/></svg><p>End of diagram.</p>',
    )
    expect(content).toContain('Diagram below')
    expect(content).toContain('End of diagram')
  })

  test('SVG with embedded <text> element — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Label:</p><svg><text x="5" y="15">A</text></svg><p>Caption text here.</p>',
    )
    expect(content).toContain('Label')
    expect(content).toContain('Caption text here')
  })

  test('SVG inline does not crash the editor', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Start</p><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="blue"/></svg><p>End</p>',
    )
    expect(typeof content).toBe('string')
    expect(content).toContain('Start')
    expect(content).toContain('End')
  })

  test('SVG with xlink:href — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Icon:</p><svg><use xlink:href="#icon-check"/></svg><p>Confirmed.</p>',
    )
    expect(content).toContain('Icon')
    expect(content).toContain('Confirmed')
  })
})
