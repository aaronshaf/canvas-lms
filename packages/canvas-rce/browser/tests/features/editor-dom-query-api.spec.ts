import {test, expect} from '../../fixtures/test'

// editor.dom exposes DOM utilities beyond the mutation API. getOuterHTML()
// serializes elements to string; encode() HTML-escapes text; createHTML()
// builds tag strings; select() queries the document. These are used by Canvas
// plugins to inspect and serialize content without going through getContent().
test.describe('editor.dom query and serialization API', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('dom.encode() escapes HTML special characters', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      return ed.dom.encode('<script>alert("xss")</script>')
    })
    expect(result).toContain('&lt;')
    expect(result).toContain('&gt;')
    expect(result).not.toContain('<script>')
  })

  test('dom.getOuterHTML() on body element returns HTML string', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Serialization test content</p>')
      const body = ed.getBody()
      return ed.dom.getOuterHTML(body)
    })
    expect(typeof result).toBe('string')
    expect(result).toContain('Serialization test content')
  })

  test('dom.select() finds elements by selector', async ({page}) => {
    const count = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>First</p><p>Second</p><p>Third</p>')
      return ed.dom.select('p').length
    })
    expect(count).toBe(3)
  })

  test('dom.select() with class selector — returns matching elements', async ({page}) => {
    const found = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p class="highlight">Highlighted</p><p>Normal</p>')
      const elements = ed.dom.select('.highlight')
      return elements.length > 0
    })
    expect(found).toBe(true)
  })

  test('dom.createHTML() builds a tag string', async ({page}) => {
    const html = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      return ed.dom.createHTML('span', {class: 'marker', 'data-id': '42'}, 'Label text')
    })
    expect(html).toContain('span')
    expect(html).toContain('marker')
    expect(html).toContain('Label text')
  })

  test('dom.is() checks element against selector', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Check this</p>')
      const p = ed.dom.select('p')[0]
      return p ? ed.dom.is(p, 'p') : false
    })
    expect(result).toBe(true)
  })
})
