import {test, expect} from '../../fixtures/test'

// CSS Logical Properties use writing-mode-relative directions (inline/block)
// instead of physical (left/right/top/bottom). padding-inline, margin-block,
// border-inline, and inset-* are key for RTL-aware Canvas themes. TinyMCE
// may or may not preserve these properties; the text content must survive.
test.describe('CSS logical properties (inline/block)', () => {
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

  test('padding-inline on paragraph — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="padding-inline: 24px;">This paragraph uses logical inline padding for RTL-aware layout.</p>',
    )
    expect(content).toContain('logical inline padding')
  })

  test('margin-block on heading — heading text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<h2 style="margin-block: 16px 8px;">Course Learning Objectives</h2><p>Students will demonstrate mastery of core competencies.</p>',
    )
    expect(content).toContain('Course Learning Objectives')
    expect(content).toContain('core competencies')
  })

  test('border-inline-start for sidebar accent — content preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="border-inline-start: 4px solid #0770a3; padding-inline-start: 16px;"><p>Important: Office hours are held Tuesdays 2-4 PM in Building 7, Room 302.</p></div>',
    )
    expect(content).toContain('Office hours')
    expect(content).toContain('Room 302')
  })

  test('inset-inline on positioned element — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Before callout</p><div style="position: relative; inset-inline: 0;"><p>Callout: This concept will appear on the midterm examination.</p></div><p>After callout</p>',
    )
    expect(content).toContain('midterm examination')
    expect(content).toContain('Before callout')
    expect(content).toContain('After callout')
  })

  test('block-size and inline-size on media container — caption preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<figure style="inline-size: 560px; block-size: auto;"><img src="/course/diagram.png" alt="Neural network architecture diagram"><figcaption>Fig. 2: Three-layer feedforward network topology</figcaption></figure>',
    )
    expect(content).toContain('Neural network architecture')
    expect(content).toContain('feedforward network topology')
  })

  test('multiple logical properties combined — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table style="margin-inline: auto; border-collapse: collapse;"><tr><th style="padding-block: 8px; padding-inline: 12px;">Term</th><th style="padding-block: 8px; padding-inline: 12px;">Definition</th></tr><tr><td>Allele</td><td>A variant form of a given gene</td></tr></table>',
    )
    expect(content).toContain('Term')
    expect(content).toContain('Definition')
    expect(content).toContain('Allele')
    expect(content).toContain('variant form')
  })
})
