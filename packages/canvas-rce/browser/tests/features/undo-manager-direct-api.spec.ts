import {test, expect} from '../../fixtures/test'

// editor.undoManager provides direct access to undo/redo state and history.
// hasUndo()/hasRedo() are used by toolbar buttons to set enabled/disabled state.
// add() manually creates an undo level — used by Canvas plugins that make
// programmatic changes without triggering TinyMCE's automatic undo capture.
test.describe('editor.undoManager direct API', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('undoManager is defined on editor', async ({page}) => {
    const type = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return typeof window.tinymce.activeEditor.undoManager
    })
    expect(type).toBe('object')
  })

  test('undoManager.hasUndo() returns false on fresh editor', async ({page}) => {
    const hasUndo = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Fresh start</p>', {no_events: true})
      ed.undoManager.clear()
      return ed.undoManager.hasUndo()
    })
    expect(hasUndo).toBe(false)
  })

  test('undoManager.hasUndo() returns true after add()', async ({page}) => {
    // setContent() alone doesn't create undo levels — add() must be called
    const hasUndo = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.undoManager.clear()
      ed.setContent('<p>Step one</p>')
      ed.undoManager.add()
      ed.setContent('<p>Step two</p>')
      ed.undoManager.add()
      return ed.undoManager.hasUndo()
    })
    expect(hasUndo).toBe(true)
  })

  test('undoManager.undo() reverts to previous state', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.undoManager.clear()
      ed.setContent('<p>Before change</p>')
      ed.undoManager.add()
      ed.setContent('<p>After change</p>')
      ed.undoManager.add()
      ed.undoManager.undo()
      return ed.getContent()
    })
    expect(content).toContain('Before change')
  })

  test('undoManager.hasRedo() returns true after undo', async ({page}) => {
    const hasRedo = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.undoManager.clear()
      ed.setContent('<p>Initial</p>')
      ed.undoManager.add()
      ed.setContent('<p>Modified</p>')
      ed.undoManager.add()
      ed.undoManager.undo()
      return ed.undoManager.hasRedo()
    })
    expect(hasRedo).toBe(true)
  })

  test('undoManager.redo() after undo — restores change', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.undoManager.clear()
      ed.setContent('<p>Original content</p>')
      ed.undoManager.add()
      ed.setContent('<p>Redoable content</p>')
      ed.undoManager.add()
      ed.undoManager.undo()
      ed.undoManager.redo()
      return ed.getContent()
    })
    expect(content).toContain('Redoable content')
  })

  test('undoManager.clear() removes all history', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Content A</p>')
      ed.setContent('<p>Content B</p>')
      ed.undoManager.clear()
      return {hasUndo: ed.undoManager.hasUndo(), hasRedo: ed.undoManager.hasRedo()}
    })
    expect(result.hasUndo).toBe(false)
    expect(result.hasRedo).toBe(false)
  })
})
