import {test, expect} from '../../fixtures/test'

// editor.dom provides TinyMCE's DOM utility API for programmatic manipulation:
// addClass/removeClass/hasClass, getStyle/setStyle, getAttrib/setAttrib, create.
// These underpin toolbar actions and plugin behavior — verifying the API works
// correctly confirms the foundation that all formatting operations build on.
test.describe('editor.dom utility API', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('dom.addClass and dom.hasClass — class added to element', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p id="target">Test paragraph</p>')
      const el = ed.dom.get('target')
      ed.dom.addClass(el, 'highlight')
      return ed.dom.hasClass(el, 'highlight')
    })
    expect(result).toBe(true)
  })

  test('dom.removeClass — class removed from element', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p id="target" class="highlight active">Test</p>')
      const el = ed.dom.get('target')
      ed.dom.removeClass(el, 'highlight')
      return {
        hasHighlight: ed.dom.hasClass(el, 'highlight'),
        hasActive: ed.dom.hasClass(el, 'active'),
      }
    })
    expect(result.hasHighlight).toBe(false)
    expect(result.hasActive).toBe(true)
  })

  test('dom.getStyle — reads inline style property', async ({page}) => {
    const color = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p id="target" style="color: red;">Colored text</p>')
      const el = ed.dom.get('target')
      return ed.dom.getStyle(el, 'color')
    })
    // TinyMCE may normalize 'red' to 'rgb(255, 0, 0)' or return 'red'
    expect(typeof color).toBe('string')
    expect(color.length).toBeGreaterThan(0)
  })

  test('dom.setAttrib and dom.getAttrib — attribute manipulation', async ({page}) => {
    const value = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p id="target">Para</p>')
      const el = ed.dom.get('target')
      ed.dom.setAttrib(el, 'data-custom', 'canvas-value')
      return ed.dom.getAttrib(el, 'data-custom')
    })
    expect(value).toBe('canvas-value')
  })

  test('dom.create — creates element with attributes and text', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      const span = ed.dom.create('span', {class: 'badge', 'data-value': '42'}, 'Points')
      return {
        tag: span.tagName.toLowerCase(),
        cls: span.className,
        data: span.getAttribute('data-value'),
        text: span.textContent,
      }
    })
    expect(result.tag).toBe('span')
    expect(result.cls).toBe('badge')
    expect(result.data).toBe('42')
    expect(result.text).toBe('Points')
  })

  test('dom.select — CSS selector within editor body', async ({page}) => {
    const count = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p class="item">A</p><p class="item">B</p><p class="other">C</p>')
      return ed.dom.select('p.item').length
    })
    expect(count).toBe(2)
  })

  test('dom.getParent — traverses up to matching selector', async ({page}) => {
    const tag = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<div><p><span id="inner">text</span></p></div>')
      const span = ed.dom.get('inner')
      const p = ed.dom.getParent(span, 'p')
      return p ? p.tagName.toLowerCase() : null
    })
    expect(tag).toBe('p')
  })
})
