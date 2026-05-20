import {test, expect} from '../../fixtures/test'

// Scroll snap creates smooth, paginated scroll containers — used in horizontal
// image carousels, slide-like course content, and step-by-step tutorials.
// overscroll-behavior controls pull-to-refresh and bounce effects at edges.
// Text content must be preserved regardless of TinyMCE's handling of these.
test.describe('CSS scroll-snap and overscroll-behavior properties', () => {
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

  test('scroll-snap-type on container — child text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="scroll-snap-type: x mandatory; overflow-x: scroll; display: flex;"><div style="scroll-snap-align: start;">Slide One content</div><div style="scroll-snap-align: start;">Slide Two content</div></div>',
    )
    expect(content).toContain('Slide One content')
    expect(content).toContain('Slide Two content')
  })

  test('scroll-snap-align: center — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="scroll-snap-type: y mandatory; overflow-y: scroll;"><p style="scroll-snap-align: center;">Center snapping paragraph</p></div>',
    )
    expect(content).toContain('Center snapping paragraph')
  })

  test('scroll-snap-stop: always — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="scroll-snap-type: x mandatory;"><div style="scroll-snap-align: start; scroll-snap-stop: always;">Required stop slide</div></div>',
    )
    expect(content).toContain('Required stop slide')
  })

  test('overscroll-behavior: contain — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="overflow: auto; overscroll-behavior: contain; height: 200px;"><p>Contained scroll content</p><p>More content here</p></div>',
    )
    expect(content).toContain('Contained scroll content')
    expect(content).toContain('More content here')
  })

  test('overscroll-behavior: none — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="overflow: scroll; overscroll-behavior: none;">No overscroll text content</div>',
    )
    expect(content).toContain('No overscroll text content')
  })
})
