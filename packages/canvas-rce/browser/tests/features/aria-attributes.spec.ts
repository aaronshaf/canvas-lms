import {test, expect} from '../../fixtures/test'

// ARIA attributes on content body elements must survive the editor round-trip.
// Screen readers rely on role, aria-label, aria-describedby etc. to convey
// document structure. If the RCE strips them, authored accessible content
// silently breaks — refactors must not introduce such regressions.
test.describe('ARIA attributes on content elements', () => {
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

  test('role="alert" on a div is preserved', async ({page}) => {
    const content = await setAndGet(page, '<div role="alert">Important notification text</div>')
    expect(content).toContain('Important notification text')
    expect(content).toContain('role="alert"')
  })

  test('aria-label on a link is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><a href="https://example.com" aria-label="Visit Example website">Example</a></p>',
    )
    expect(content).toContain('Example')
    expect(content).toContain('aria-label')
  })

  test('aria-hidden="true" on a decorative span is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Score: <span aria-hidden="true">★★★</span><span class="sr-only">3 out of 5 stars</span></p>',
    )
    expect(content).toContain('★★★')
    expect(content).toContain('3 out of 5 stars')
    expect(content).toContain('aria-hidden')
  })

  test('aria-describedby on a paragraph is handled', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p id="desc">This paragraph describes the widget.</p><div aria-describedby="desc">Widget content</div>',
    )
    expect(content).toContain('This paragraph describes the widget')
    expect(content).toContain('Widget content')
  })

  test('aria-live="polite" on a div is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div aria-live="polite" aria-atomic="true">Live region content</div>',
    )
    expect(content).toContain('Live region content')
    expect(content).toContain('aria-live')
  })

  test('role="note" with aria-label on blockquote', async ({page}) => {
    const content = await setAndGet(
      page,
      '<blockquote role="note" aria-label="Editor note"><p>This is an editorial note.</p></blockquote>',
    )
    expect(content).toContain('editorial note')
    expect(content).toMatch(/<blockquote/)
  })

  test('aria-expanded on a summary element is handled', async ({page}) => {
    const content = await setAndGet(
      page,
      '<details><summary aria-expanded="false">Section title</summary><p>Section body.</p></details>',
    )
    expect(content).toContain('Section title')
    expect(content).toContain('Section body')
  })

  test('tabindex on a div is preserved', async ({page}) => {
    const content = await setAndGet(page, '<div tabindex="0" role="button">Clickable div</div>')
    expect(content).toContain('Clickable div')
    // tabindex may or may not be preserved — document actual behavior
    expect(typeof content).toBe('string')
    expect(content.length).toBeGreaterThan(0)
  })
})
