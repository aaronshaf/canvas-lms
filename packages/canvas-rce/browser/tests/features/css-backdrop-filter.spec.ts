import {test, expect} from '../../fixtures/test'

// backdrop-filter applies visual effects to the area behind an element —
// blurring, saturating, or brightening content underneath overlays and modals.
// The CSS `appearance` property controls native widget styling. TinyMCE may
// strip these; the text content that accompanies them must always survive.
test.describe('CSS backdrop-filter and appearance properties', () => {
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

  test('backdrop-filter: blur on overlay — label text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="position: relative;"><div style="backdrop-filter: blur(8px); background: rgba(255,255,255,0.7); padding: 16px;"><p>Notice: This content requires completing Module 3 first.</p></div></div>',
    )
    expect(content).toContain('completing Module 3')
  })

  test('backdrop-filter: saturate on callout — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="backdrop-filter: saturate(180%) blur(4px);"><p><strong>Key Concept:</strong> The central dogma of molecular biology describes the flow of genetic information.</p></div>',
    )
    expect(content).toContain('central dogma')
    expect(content).toContain('genetic information')
  })

  test('appearance: none on styled button label — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Click <strong style="appearance: none; background: #0770a3; color: white; padding: 4px 8px; border-radius: 4px;">Submit Assignment</strong> when ready.</p>',
    )
    expect(content).toContain('Submit Assignment')
    expect(content).toContain('when ready')
  })

  test('webkit-backdrop-filter on frosted glass box — content preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="-webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);"><p>Announcement: Final exam moved to December 15th in Lecture Hall B.</p></div>',
    )
    expect(content).toContain('Final exam')
    expect(content).toContain('Lecture Hall B')
  })

  test('multiple visual filter properties — content preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)); backdrop-filter: brightness(0.9);"><h3>Assignment Feedback</h3><p>Your analysis of the primary sources was thorough and well-cited.</p></div>',
    )
    expect(content).toContain('Assignment Feedback')
    expect(content).toContain('primary sources')
    expect(content).toContain('well-cited')
  })
})
