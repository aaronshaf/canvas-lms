import {test, expect} from '../../fixtures/test'

// setContent() and getContent() accept options objects that control behavior:
// no_events suppresses event firing, format controls serialization format.
// These options are used by Canvas integrations to batch-update content without
// triggering undo history or change detection listeners.
test.describe('setContent and getContent options', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('setContent with no_events:true — SetContent handler NOT fired', async ({page}) => {
    const fired = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      let wasFired = false
      ed.on('SetContent', () => {
        wasFired = true
      })
      ed.setContent('<p>Silent set</p>', {no_events: true})
      return wasFired
    })
    expect(fired).toBe(false)
  })

  test('setContent with no_events:true — content is still set correctly', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Silent content</p>', {no_events: true})
      return ed.getContent()
    })
    expect(content).toContain('Silent content')
  })

  test('getContent with no_events:true — content returned correctly', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Test no events get</p>')
      return ed.getContent({no_events: true})
    })
    expect(content).toContain('Test no events get')
  })

  test('setContent with format:"raw" — content inserted as-is', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Raw format input</p>', {format: 'raw'})
      return ed.getContent()
    })
    expect(content).toContain('Raw format input')
  })

  test('getContent with format:"text" returns plain text', async ({page}) => {
    const text = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p><strong>Bold</strong> and <em>italic</em> text.</p>')
      return ed.getContent({format: 'text'})
    })
    expect(text).toContain('Bold')
    expect(text).toContain('italic')
    expect(text).not.toContain('<strong>')
    expect(text).not.toContain('<em>')
  })

  test('multiple setContent calls — last one wins', async ({page}) => {
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>First content</p>')
      ed.setContent('<p>Second content</p>')
      ed.setContent('<p>Third content</p>')
      return ed.getContent()
    })
    expect(content).toContain('Third content')
    expect(content).not.toContain('First content')
  })
})
