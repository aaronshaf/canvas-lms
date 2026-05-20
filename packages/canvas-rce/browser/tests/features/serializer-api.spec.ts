import {test, expect} from '../../fixtures/test'

// editor.serializer converts a DOM node (or the editor body) to an HTML string.
// It applies TinyMCE's filtering pipeline — the same one used by getContent().
// Testing serializer directly verifies the pipeline works on arbitrary nodes,
// not just the full editor body, which matters for plugin and extension authors.
test.describe('editor.serializer API', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('serializer is defined on editor', async ({page}) => {
    const type = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return typeof window.tinymce.activeEditor.serializer
    })
    expect(type).toBe('object')
  })

  test('serializer.serialize() on a created element returns HTML string', async ({page}) => {
    const html = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      const p = ed.dom.create('p', {}, 'Serialized content')
      return ed.serializer.serialize(p)
    })
    expect(typeof html).toBe('string')
    expect(html).toContain('Serialized content')
  })

  test('serializer.serialize() on strong element produces expected HTML', async ({page}) => {
    const html = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      const strong = ed.dom.create('strong', {}, 'Bold word')
      return ed.serializer.serialize(strong)
    })
    expect(html).toContain('Bold word')
  })

  test('serializer.serialize() on table — produces valid table HTML', async ({page}) => {
    const html = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<table><tr><td>Cell A</td><td>Cell B</td></tr></table>')
      const table = ed.getBody().querySelector('table')
      return ed.serializer.serialize(table)
    })
    expect(html).toContain('Cell A')
    expect(html).toContain('Cell B')
  })

  test('serializer.serialize() on editor body matches getContent()', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Match test paragraph</p>')
      const serialized = ed.serializer.serialize(ed.getBody())
      const gotten = ed.getContent()
      return {serialized, gotten, containsText: serialized.includes('Match test paragraph')}
    })
    expect(result.containsText).toBe(true)
  })
})
