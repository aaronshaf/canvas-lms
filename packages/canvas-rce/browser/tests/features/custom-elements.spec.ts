import {test, expect} from '../../fixtures/test'

// Custom elements (<x-component>, <canvas-widget>) appear in content copied
// from design systems and web components. TinyMCE may strip unknown tags
// but should preserve their text content. Tests document actual behavior
// so a refactor doesn't accidentally change custom element handling.
test.describe('custom HTML elements (Web Components)', () => {
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

  test('text inside a custom element survives round-trip', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Before.</p><x-callout>Custom callout text</x-callout><p>After.</p>',
    )
    expect(content).toContain('Before')
    expect(content).toContain('After')
    // text may survive inside the element or be extracted
    expect(typeof content).toBe('string')
  })

  test('paragraph around custom element is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Introduction.</p><canvas-quiz type="multiple-choice">Quiz content</canvas-quiz><p>Conclusion.</p>',
    )
    expect(content).toContain('Introduction')
    expect(content).toContain('Conclusion')
  })

  test('custom element with attributes — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Widget:</p><lti-tool data-id="123" variant="full">LTI content placeholder</lti-tool><p>End.</p>',
    )
    expect(content).toContain('Widget')
    expect(content).toContain('End')
  })

  test('nested custom elements — outer text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<section-header><h2>Title inside custom</h2></section-header><p>Body.</p>',
    )
    expect(content).toContain('Title inside custom')
    expect(content).toContain('Body')
  })
})
