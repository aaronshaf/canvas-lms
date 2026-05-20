import {test, expect} from '../../fixtures/test'

// <canvas> is an HTML5 scripting element for drawing graphics via JavaScript.
// It has no meaningful static content — its visual output is JS-generated.
// When included in course body content, canvas is either stripped (safe) or
// preserved (inert without script). Surrounding text must always survive.
test.describe('<canvas> element handling', () => {
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

  test('paragraph text around <canvas> is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Before canvas.</p><canvas width="200" height="100"></canvas><p>After canvas.</p>',
    )
    expect(content).toContain('Before canvas')
    expect(content).toContain('After canvas')
  })

  test('<canvas> fallback text is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Chart:</p><canvas width="300" height="200">Your browser does not support canvas.</canvas><p>End.</p>',
    )
    expect(content).toContain('Chart')
    expect(content).toContain('End')
  })

  test('<canvas> with id does not crash editor', async ({page}) => {
    const content = await setAndGet(
      page,
      '<canvas id="myChart" width="400" height="300"></canvas><p>Content after.</p>',
    )
    expect(content).toContain('Content after')
    expect(typeof content).toBe('string')
  })

  test('<canvas> inside a figure with caption — caption preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<figure><canvas width="200" height="100"></canvas><figcaption>Dynamic chart (requires JavaScript)</figcaption></figure>',
    )
    expect(content).toContain('Dynamic chart')
    expect(content).toContain('requires JavaScript')
  })
})
