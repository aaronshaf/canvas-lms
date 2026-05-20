import {test, expect} from '../../fixtures/test'

// The HTML Popover API (popover attribute, popovertarget) is a native way to
// show tooltips, menus, and overlays without JavaScript. It appeared in modern
// browsers in 2023 and may appear in Canvas content authored in newer systems.
// The surrounding text labels must survive even if TinyMCE strips the attrs.
test.describe('HTML Popover API attributes', () => {
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

  test('popover attribute on tooltip div — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>For more information <button popovertarget="tip1">see definition</button></p><div id="tip1" popover><p>A rubric is a scoring guide that lists criteria for evaluation.</p></div>',
    )
    // Button text and popover content should survive even if attrs are stripped
    expect(content).toContain('see definition')
    expect(content).toContain('scoring guide')
  })

  test('popover="auto" on hint element — hint text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div popover="auto" id="hint"><p>Hint: Focus on how the author uses evidence to support the central argument.</p></div><p>Click the hint button above if you need guidance.</p>',
    )
    expect(content).toContain('central argument')
    expect(content).toContain('hint button')
  })

  test('popover="manual" controlled overlay — label and content preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Click to toggle: <button popovertarget="glossary" popovertargetaction="toggle">Show glossary</button></p><div id="glossary" popover="manual"><h3>Key Terms</h3><p>Homeostasis: The ability of an organism to maintain stable internal conditions.</p></div>',
    )
    expect(content).toContain('Show glossary')
    expect(content).toContain('Homeostasis')
    expect(content).toContain('stable internal conditions')
  })

  test('multiple popovers in sequence — all content preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<p>Vocabulary helpers:</p>
      <div popover id="def1"><p>Mitosis: Cell division producing two identical daughter cells.</p></div>
      <div popover id="def2"><p>Meiosis: Cell division producing four genetically distinct gametes.</p></div>
      <div popover id="def3"><p>Cytokinesis: Physical division of the cytoplasm after nuclear division.</p></div>`,
    )
    expect(content).toContain('identical daughter cells')
    expect(content).toContain('genetically distinct gametes')
    expect(content).toContain('division of the cytoplasm')
  })
})
