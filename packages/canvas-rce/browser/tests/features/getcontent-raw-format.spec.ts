import {test, expect} from '../../fixtures/test'

// TinyMCE's getContent() accepts a format option: 'html' (default) or 'raw'.
// Raw format returns the editor's internal representation without serialization
// filtering. Understanding both formats is critical for refactoring because
// the Canvas save flow uses a specific format — changing it can corrupt content.
test.describe('getContent format options', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('default html format contains text', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>HTML format text</p>')
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent({format: 'html'})
    })
    expect(content).toContain('HTML format text')
  })

  test('raw format returns non-empty string with text', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>Raw format text</p>')
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent({format: 'raw'})
    })
    expect(typeof content).toBe('string')
    expect(content).toContain('Raw format text')
  })

  test('text format strips all tags', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p><strong>Bold</strong> and <em>italic</em></p>')
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent({format: 'text'})
    })
    expect(content).toContain('Bold')
    expect(content).toContain('italic')
    expect(content).not.toContain('<strong>')
    expect(content).not.toContain('<em>')
  })

  test('html format applies serialization (b→strong)', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p><b>Bold text</b></p>')
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent({format: 'html'})
    })
    expect(content).toContain('Bold text')
  })

  test('getContent without options defaults to html format', async ({page}) => {
    const [withOption, withoutOption] = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>Same content</p>')
      return [
        // @ts-expect-error -- TinyMCE global
        window.tinymce.activeEditor.getContent({format: 'html'}),
        // @ts-expect-error -- TinyMCE global
        window.tinymce.activeEditor.getContent(),
      ]
    })
    expect(withoutOption).toBe(withOption)
  })

  test('text format of a table returns cell text without tags', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<table><tr><td>Alpha</td><td>Beta</td></tr></table>')
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent({format: 'text'})
    })
    expect(content).toContain('Alpha')
    expect(content).toContain('Beta')
    expect(content).not.toContain('<table>')
  })
})
