import {test, expect} from '../../fixtures/test'

// <div> elements appear in imported HTML and in Canvas content authored outside
// the RCE (e.g. via API). TinyMCE may convert <div> to <p> or strip it;
// tests document the actual round-trip behavior so refactors don't change it.
test.describe('<div> as block container', () => {
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

  test('plain <div> text content survives round-trip', async ({page}) => {
    const content = await setAndGet(page, '<div>Simple div text</div>')
    expect(content).toContain('Simple div text')
  })

  test('multiple sibling <div>s all preserve their text', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div>First block</div><div>Second block</div><div>Third block</div>',
    )
    expect(content).toContain('First block')
    expect(content).toContain('Second block')
    expect(content).toContain('Third block')
  })

  test('<div> with inline styles preserves text', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="color: navy; font-weight: bold;">Styled div</div>',
    )
    expect(content).toContain('Styled div')
  })

  test('<div> with class attribute — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<div class="callout-box">Callout text</div>')
    expect(content).toContain('Callout text')
  })

  test('nested <div>s preserve inner text', async ({page}) => {
    const content = await setAndGet(page, '<div><div><div>Deeply nested text</div></div></div>')
    expect(content).toContain('Deeply nested text')
  })

  test('<div> containing <p> children survives', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div><p>Paragraph inside div</p><p>Another paragraph</p></div>',
    )
    expect(content).toContain('Paragraph inside div')
    expect(content).toContain('Another paragraph')
  })

  test('<div> with id attribute — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div id="section-intro"><p>Introduction content</p></div>',
    )
    expect(content).toContain('Introduction content')
  })

  test('<div> mixing inline and block children preserves all text', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div><strong>Bold label:</strong> <span>inline text</span><p>Block paragraph</p></div>',
    )
    expect(content).toContain('Bold label')
    expect(content).toContain('inline text')
    expect(content).toContain('Block paragraph')
  })
})
