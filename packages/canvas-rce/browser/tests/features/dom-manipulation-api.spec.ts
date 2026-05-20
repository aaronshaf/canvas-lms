import {test, expect} from '../../fixtures/test'

// editor.dom provides programmatic DOM manipulation used by plugins to
// insert widgets, remove elements, and restructure content. These operations
// underpin media embed insertion, link editing, and table operations.
// Testing them verifies the DOM utility layer works before relying on it.
test.describe('editor.dom manipulation methods', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('dom.setStyle() — applies style to element', async ({page}) => {
    const color = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p id="target">Styled paragraph</p>')
      const el = ed.dom.get('target')
      ed.dom.setStyle(el, 'color', 'red')
      return el.style.color
    })
    expect(color).toBe('red')
  })

  test('dom.setStyles() — applies multiple styles at once', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p id="target">Multi-styled</p>')
      const el = ed.dom.get('target')
      ed.dom.setStyles(el, {color: 'blue', 'font-weight': 'bold'})
      return {color: el.style.color, weight: el.style.fontWeight}
    })
    expect(result.color).toBe('blue')
    expect(result.weight).toBe('bold')
  })

  test('dom.remove() — removes element, siblings remain', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Keep this</p><p id="remove-me">Remove this</p><p>Also keep</p>')
      const el = ed.dom.get('remove-me')
      ed.dom.remove(el)
      return ed.getContent()
    })
    expect(content).toContain('Keep this')
    expect(content).toContain('Also keep')
    expect(content).not.toContain('Remove this')
  })

  test('dom.insertAfter() — inserts element after target', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p id="anchor">Anchor paragraph</p>')
      const anchor = ed.dom.get('anchor')
      const newP = ed.dom.create('p', {}, 'Inserted after anchor')
      ed.dom.insertAfter(newP, anchor)
      return ed.getContent()
    })
    expect(content).toContain('Anchor paragraph')
    expect(content).toContain('Inserted after anchor')
  })

  test('dom.replace() — swaps element with new one', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p id="old">Old paragraph</p><p>Neighbor</p>')
      const old = ed.dom.get('old')
      const replacement = ed.dom.create('h2', {}, 'Replaced heading')
      ed.dom.replace(replacement, old)
      return ed.getContent()
    })
    expect(content).toContain('Replaced heading')
    expect(content).toContain('Neighbor')
    expect(content).not.toContain('Old paragraph')
  })

  test('dom.setAttrib() and getAttrib() round-trip', async ({page}) => {
    const value = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p id="target">Attribute test</p>')
      const el = ed.dom.get('target')
      ed.dom.setAttrib(el, 'data-test-val', 'round-trip-123')
      return ed.dom.getAttrib(el, 'data-test-val')
    })
    expect(value).toBe('round-trip-123')
  })
})
