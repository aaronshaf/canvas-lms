import {test, expect} from '../../fixtures/test'

// touch-action controls how touch events are handled — panning, zooming, and
// manipulation. Canvas uses touch-action on interactive elements to prevent
// scroll interference in embedded tools and custom widgets. accent-color sets
// the tint color for native form controls (checkboxes, radio, range).
test.describe('CSS touch-action and accent-color', () => {
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

  test('touch-action: none on interactive map — label preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="touch-action: none; width: 600px; height: 400px;"><p>Interactive campus map — drag to navigate, pinch to zoom.</p></div>',
    )
    expect(content).toContain('Interactive campus map')
    expect(content).toContain('drag to navigate')
  })

  test('touch-action: pan-y on scrollable list — list text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul style="touch-action: pan-y; overflow-y: auto; max-height: 200px;"><li>Vertical scroll enabled</li><li>Horizontal pan disabled</li><li>Pinch zoom still works</li></ul>',
    )
    expect(content).toContain('Vertical scroll enabled')
    expect(content).toContain('Pinch zoom still works')
  })

  test('touch-action: manipulation on button-like element — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><strong style="touch-action: manipulation; display: inline-block; padding: 8px 16px;">Start Quiz</strong> — tap once to begin, no double-tap zoom.</p>',
    )
    expect(content).toContain('Start Quiz')
    expect(content).toContain('double-tap zoom')
  })

  test('accent-color on form-like content — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="accent-color: #0770a3;"><p>Survey items use the course accent color for checkboxes and radio buttons.</p></div>',
    )
    expect(content).toContain('course accent color')
    expect(content).toContain('checkboxes and radio buttons')
  })

  test('combined touch and pointer properties — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="touch-action: pan-x pan-y; pointer-events: auto; user-select: none;"><p>This interactive timeline supports horizontal and vertical touch scrolling.</p></div>',
    )
    expect(content).toContain('horizontal and vertical touch scrolling')
  })
})
