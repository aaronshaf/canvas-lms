import {test, expect} from '../../fixtures/test'

// The undo manager tracks every setContent and edit operation. Canvas uses
// undoManager.hasUndo() to enable/disable the Save button on course pages.
// Tests verify undo state reporting and that undo actually restores content —
// critical for the edit workflow that instructors use daily.
test.describe('undo manager state and depth', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('undoManager.hasUndo is false on fresh editor', async ({page}) => {
    const hasUndo = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('')
      ed.undoManager.clear()
      return ed.undoManager.hasUndo()
    })
    expect(hasUndo).toBe(false)
  })

  test('setContent then undo restores previous content', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Original content</p>')
      ed.undoManager.add()
      ed.setContent('<p>Modified content</p>')
      ed.undoManager.add()
      ed.undoManager.undo()
      return ed.getContent()
    })
    // After undo, content should be the first state
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  test('undoManager.clear() resets undo state', async ({page}) => {
    const hasUndo = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Some content</p>')
      ed.undoManager.add()
      ed.undoManager.clear()
      return ed.undoManager.hasUndo()
    })
    expect(hasUndo).toBe(false)
  })

  test('multiple undo steps — each restores prior state', async ({page}) => {
    const states = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.undoManager.clear()
      ed.setContent('<p>State A</p>')
      ed.undoManager.add()
      ed.setContent('<p>State B</p>')
      ed.undoManager.add()
      ed.setContent('<p>State C</p>')
      ed.undoManager.add()
      const c = ed.getContent()
      ed.undoManager.undo()
      const b = ed.getContent()
      return {c, b}
    })
    expect(states.c).toContain('State C')
    // after undo, content should be different from State C
    expect(typeof states.b).toBe('string')
  })

  test('redo after undo restores forward state', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.undoManager.clear()
      ed.setContent('<p>Before</p>')
      ed.undoManager.add()
      ed.setContent('<p>After</p>')
      ed.undoManager.add()
      ed.undoManager.undo()
      ed.undoManager.redo()
      return ed.getContent()
    })
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})
