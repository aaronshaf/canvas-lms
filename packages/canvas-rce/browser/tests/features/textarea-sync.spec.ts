import {test, expect} from '../../fixtures/test'

// canvas-rce keeps an underlying <textarea> in sync with TinyMCE so forms can
// submit the HTML content. These tests verify that sync contract.
test.describe('textarea sync', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await rcePage.contentFrame().locator('body').click()
  })

  async function saveAndReadTextarea(page: any): Promise<string> {
    return page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.save()
      const ta = document.querySelector<HTMLTextAreaElement>('textarea#rce-basic')
      return ta?.value ?? ''
    })
  }

  test('textarea reflects typed content', async ({page, rcePage}) => {
    await rcePage.typeContent('sync test')
    const value = await saveAndReadTextarea(page)
    expect(value).toContain('sync test')
  })

  test('textarea value is valid HTML after bold formatting', async ({page, rcePage}) => {
    await rcePage.typeContent('bold sync')
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.keyboard.press('Control+b')
    const value = await saveAndReadTextarea(page)
    expect(value).toMatch(/<strong>bold sync<\/strong>/)
  })

  test('textarea is empty when editor content is cleared', async ({page, rcePage}) => {
    await rcePage.typeContent('will be cleared')
    // Select all and delete
    await rcePage.contentFrame().locator('body').press('Control+a')
    await page.keyboard.press('Backspace')
    const value = await saveAndReadTextarea(page)
    // Should be empty or just an empty paragraph
    const text = value.replace(/<p>(\s|&nbsp;)*<\/p>/g, '').trim()
    expect(text).toBe('')
  })

  test('textarea HTML matches getContent() output', async ({page, rcePage}) => {
    await rcePage.typeContent('consistency check')
    const editorContent = await rcePage.getContent()
    const taValue = await saveAndReadTextarea(page)
    expect(taValue).toBe(editorContent)
  })
})
