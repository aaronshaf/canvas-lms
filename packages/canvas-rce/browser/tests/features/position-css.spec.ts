import {test, expect} from '../../fixtures/test'

// CSS position properties (relative, absolute, fixed, sticky) control element
// placement. They appear in callout boxes, floating images, and sticky headers
// in course content. TinyMCE may preserve or strip these — text must survive.
test.describe('CSS position properties in inline styles', () => {
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

  test('position: relative — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="position: relative;">Relative positioned paragraph</p>',
    )
    expect(content).toContain('Relative positioned paragraph')
  })

  test('position: absolute with offset — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="position: relative; height: 100px;"><span style="position: absolute; top: 10px; left: 20px;">Absolute text</span></div>',
    )
    expect(content).toContain('Absolute text')
  })

  test('position: sticky — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="position: sticky; top: 0; background: white;">Sticky header text</p><p>Body content.</p>',
    )
    expect(content).toContain('Sticky header text')
    expect(content).toContain('Body content')
  })

  test('z-index with positioned element — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="position: relative; z-index: 10;">Layered content</div>',
    )
    expect(content).toContain('Layered content')
  })

  test('float: left on image — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<img src="photo.jpg" alt="floated image" style="float: left; margin-right: 16px;" /><p>Text wrapping around floated image here.</p>',
    )
    expect(content).toContain('Text wrapping around floated image here')
  })

  test('clear: both — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<img src="img.jpg" alt="img" style="float: left;" /><p style="clear: both;">Text after float cleared</p>',
    )
    expect(content).toContain('Text after float cleared')
  })
})
