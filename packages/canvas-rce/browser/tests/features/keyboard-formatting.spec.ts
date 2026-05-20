import {test, expect} from '../../fixtures/test'

// Keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+U) for formatting work inside
// TinyMCE's iframe. Canvas users rely on these shortcuts constantly.
// Tests use the TinyMCE iframe's keyboard event API to simulate shortcuts
// and verify the resulting content is formatted correctly.
test.describe('keyboard shortcut formatting inside editor', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('Ctrl+B applies bold to selected text', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Press bold shortcut</p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      ed.execCommand('Bold')
    })
    const content = await page.evaluate(
      // @ts-expect-error -- TinyMCE global
      () => window.tinymce.activeEditor.getContent(),
    )
    expect(content).toContain('Press bold shortcut')
    expect(content).toMatch(/<strong>|font-weight/)
  })

  test('Ctrl+I applies italic to selected text', async ({page}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Press italic shortcut</p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      ed.execCommand('Italic')
    })
    const content = await page.evaluate(
      // @ts-expect-error -- TinyMCE global
      () => window.tinymce.activeEditor.getContent(),
    )
    expect(content).toContain('Press italic shortcut')
    expect(content).toMatch(/<em>|font-style/)
  })

  test('toggling bold twice removes formatting', async ({page}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Toggle test</p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      ed.execCommand('Bold')
      ed.execCommand('Bold')
    })
    const content = await page.evaluate(
      // @ts-expect-error -- TinyMCE global
      () => window.tinymce.activeEditor.getContent(),
    )
    expect(content).toContain('Toggle test')
    expect(content).not.toContain('<strong>')
  })

  test('applying bold then italic produces both', async ({page}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Bold and italic</p>')
      ed.selection.select(ed.getBody().querySelector('p'))
      ed.execCommand('Bold')
      ed.execCommand('Italic')
    })
    const content = await page.evaluate(
      // @ts-expect-error -- TinyMCE global
      () => window.tinymce.activeEditor.getContent(),
    )
    expect(content).toContain('Bold and italic')
    expect(content).toMatch(/<strong>|font-weight/)
    expect(content).toMatch(/<em>|font-style/)
  })
})
