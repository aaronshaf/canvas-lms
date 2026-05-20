import {test, expect} from '../../fixtures/test'

// <template> and <slot> are Web Components elements. <template> content is
// inert (not rendered, not executed), making it a potential vector for hiding
// payloads that activate if the template is later cloned into the DOM.
// canvas-rce should strip or neutralize them; surrounding text must survive.
test.describe('<template> and <slot> element handling', () => {
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

  test('surrounding text is preserved when <template> is set', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Before template.</p><template><script>alert(1)</script></template><p>After template.</p>',
    )
    expect(content).toContain('Before template')
    expect(content).toContain('After template')
    expect(content).not.toContain('<script>')
  })

  test('<template> with hidden payload does not leak script', async ({page}) => {
    const content = await setAndGet(
      page,
      '<template id="tmpl"><div onclick="evil()">click</div></template><p>Safe</p>',
    )
    expect(content).toContain('Safe')
    // onclick should not appear outside a template if template is stripped
    // (TinyMCE strips event handlers)
    expect(content).not.toContain('evil()')
  })

  test('<slot> element — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Slot host:</p><slot name="header">Default slot content</slot><p>After slot.</p>',
    )
    expect(content).toContain('Slot host')
    expect(content).toContain('After slot')
  })

  test('<template> without scripts — no crash', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Start</p><template><p>Template paragraph</p></template><p>End</p>',
    )
    expect(content).toContain('Start')
    expect(content).toContain('End')
    expect(typeof content).toBe('string')
  })
})
