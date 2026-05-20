import {test, expect} from '../../fixtures/test'

// getContent() must be deterministic — calling it multiple times on the same
// content must return the same string. Instability here (e.g. from random
// attribute ordering or whitespace normalization divergence) causes form
// submissions to appear "dirty" even without user edits, breaking Canvas LMS
// change-detection logic.
test.describe('content serialization determinism', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('getContent() returns identical result on repeated calls', async ({page}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p><strong>bold</strong> and <em>italic</em></p>')
    })
    const results = await page.evaluate(async () => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      return [ed.getContent(), ed.getContent(), ed.getContent()]
    })
    expect(results[0]).toBe(results[1])
    expect(results[1]).toBe(results[2])
  })

  test('getContent() after setContent is stable across 5 calls', async ({page}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(
        '<h2>Title</h2><ul><li>item 1</li><li>item 2</li></ul><p>footer</p>',
      )
    })
    const calls = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      return Array.from({length: 5}, () => ed.getContent())
    })
    const unique = new Set(calls)
    expect(unique.size).toBe(1)
  })

  test('getContent() is stable with table content', async ({page}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(
        '<table><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></table>',
      )
    })
    const [first, second] = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      return [ed.getContent(), ed.getContent()]
    })
    expect(first).toBe(second)
  })

  test('textarea value after save() matches getContent()', async ({page}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>consistent content</p>')
    })
    const [editorContent, taValue] = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      const html = ed.getContent()
      ed.save()
      const ta = document.querySelector<HTMLTextAreaElement>('textarea#rce-basic')
      return [html, ta?.value ?? '']
    })
    expect(taValue).toBe(editorContent)
  })

  test('getContent() before and after focus change is stable', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>focus test</p>')
    })
    const before = await rcePage.getContent()
    // Click outside the editor to blur it, then get content again
    await page.locator('body').click({position: {x: 50, y: 10}})
    const after = await rcePage.getContent()
    expect(before).toBe(after)
  })
})
