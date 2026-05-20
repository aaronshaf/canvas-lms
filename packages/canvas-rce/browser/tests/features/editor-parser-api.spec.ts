import {test, expect} from '../../fixtures/test'

// editor.parser converts HTML strings into TinyMCE's internal AstNode tree.
// Plugins add node filters to transform content on parse (e.g., wrapping
// images, marking LTI links). This spec verifies the parser API is accessible
// and that addNodeFilter/addAttributeFilter register without throwing.
test.describe('editor.parser API', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('editor.parser is accessible as an object', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      return typeof ed.parser
    })
    expect(result).toBe('object')
  })

  test('parser.addNodeFilter() registers without throwing', async ({page}) => {
    const success = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      try {
        ed.parser.addNodeFilter('img', (nodes: any[]) => {
          nodes.forEach((node: any) => node.attr('data-processed', 'true'))
        })
        return true
      } catch {
        return false
      }
    })
    expect(success).toBe(true)
  })

  test('parser.addAttributeFilter() registers without throwing', async ({page}) => {
    const success = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      try {
        ed.parser.addAttributeFilter('href', (nodes: any[]) => {
          // Canvas link processing hook (just registration, no op)
          void nodes
        })
        return true
      } catch {
        return false
      }
    })
    expect(success).toBe(true)
  })

  test('parser.parse() converts HTML to node tree', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      try {
        const tree = ed.parser.parse('<p>Hello from parser</p>')
        return tree !== null && typeof tree === 'object'
      } catch {
        return false
      }
    })
    expect(result).toBe(true)
  })

  test('parser.parse() result has name property', async ({page}) => {
    const name = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      try {
        const tree = ed.parser.parse('<p>Test node</p>')
        return tree?.name ?? null
      } catch {
        return null
      }
    })
    // Root node is typically 'body' or '#document'
    expect(typeof name).toBe('string')
  })
})
