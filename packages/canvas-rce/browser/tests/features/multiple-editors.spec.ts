import {test, expect} from '../../fixtures/test'

// Canvas LMS renders multiple RCE instances on a single page (e.g. assignment
// description + rubric). Each editor must be fully independent — content typed
// in one must not bleed into or affect the other.
test.describe('multiple editors on one page', () => {
  test.beforeEach(async ({page}) => {
    await page.goto('/scenarios/multiple-editors')
    // Wait for both TinyMCE iframes to be present
    await page
      .locator('iframe.tox-edit-area__iframe')
      .nth(0)
      .waitFor({state: 'visible', timeout: 30_000})
    await page
      .locator('iframe.tox-edit-area__iframe')
      .nth(1)
      .waitFor({state: 'visible', timeout: 30_000})
  })

  test('both editors mount independently', async ({page}) => {
    const editors = page.locator('.tox-tinymce')
    expect(await editors.count()).toBe(2)
  })

  test('typing in first editor does not affect second editor', async ({page}) => {
    const frame1 = page.frameLocator('iframe.tox-edit-area__iframe').nth(0)
    await frame1.locator('body').click()
    await page.keyboard.type('editor one content')

    const content1 = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const editors = window.tinymce.editors
      return editors[0]?.getContent() ?? ''
    })
    const content2 = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const editors = window.tinymce.editors
      return editors[1]?.getContent() ?? ''
    })

    expect(content1).toContain('editor one content')
    expect(content2).not.toContain('editor one content')
  })

  test('typing in second editor does not affect first editor', async ({page}) => {
    const frame2 = page.frameLocator('iframe.tox-edit-area__iframe').nth(1)
    await frame2.locator('body').click()
    await page.keyboard.type('editor two content')

    const content1 = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.editors[0]?.getContent() ?? ''
    })
    const content2 = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.editors[1]?.getContent() ?? ''
    })

    expect(content2).toContain('editor two content')
    expect(content1).not.toContain('editor two content')
  })

  test('each editor has its own underlying textarea', async ({page}) => {
    const ta1 = page.locator('textarea#rce-editor-1')
    const ta2 = page.locator('textarea#rce-editor-2')
    expect(await ta1.count()).toBe(1)
    expect(await ta2.count()).toBe(1)
  })

  test('both editors have separate toolbars', async ({page}) => {
    const toolbars = page.locator('.tox-toolbar__primary')
    expect(await toolbars.count()).toBe(2)
  })
})
