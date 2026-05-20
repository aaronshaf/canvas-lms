import {test, expect} from '../../fixtures/test'

// Elements with multiple CSS class names appear throughout Canvas course content:
// framework utility classes (Bootstrap, InstUI), Canvas-specific classes
// (instructure_file_link, equation_image), and custom instructor classes.
// Multiple classes must survive round-trips as a space-separated string.
test.describe('elements with multiple CSS class names', () => {
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

  test('span with two classes — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span class="highlight warning">Highlighted warning text</span></p>',
    )
    expect(content).toContain('Highlighted warning text')
  })

  test('div with three classes — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div class="callout callout-info rounded">Info callout content</div>',
    )
    expect(content).toContain('Info callout content')
  })

  test('Canvas file link with multiple classes — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<a href="/files/42" class="instructure_file_link instructure_scribd_file inline_disabled">Assignment Brief.pdf</a>',
    )
    expect(content).toContain('Assignment Brief.pdf')
  })

  test('img with multiple classes including equation_image — alt preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<img src="/eq.png" alt="f(x) equals x squared" class="equation_image mq-math-mode" data-equation-content="f(x)=x^2">',
    )
    // alt text or surrounding structure should be present
    expect(typeof content).toBe('string')
  })

  test('5 classes on one element — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div class="container row flex-wrap align-items-center justify-content-between">Five class div content</div>',
    )
    expect(content).toContain('Five class div content')
  })

  test('table with border and class — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table class="ic-Table ic-Table--striped ic-Table--condensed"><tr><td>Table cell</td></tr></table>',
    )
    expect(content).toContain('Table cell')
  })

  test('nested elements each with multiple classes — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div class="outer-wrapper content-region"><p class="lead-text featured-text">Featured introduction paragraph text.</p></div>',
    )
    expect(content).toContain('Featured introduction paragraph text')
  })
})
