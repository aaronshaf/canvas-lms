import {test, expect} from '../../fixtures/test'

// Verifies that toolbar buttons reflect the formatting state at the current cursor
// position. This is a core UX contract: if the cursor is inside <strong>, the
// Bold button must appear active/pressed so users know what formatting is applied.
test.describe('toolbar active state', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await rcePage.contentFrame().locator('body').click()
  })

  test('bold button appears active when cursor is in bold text', async ({page, rcePage}) => {
    // Insert bold content and place cursor inside it
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.insertContent('<strong>bold text</strong>')
    })
    // Move cursor inside the bold text by clicking on it in the iframe
    const boldEl = rcePage.contentFrame().locator('strong').first()
    await boldEl.click()

    // TinyMCE marks active toolbar buttons with aria-pressed="true"
    const boldBtn = rcePage.toolbarButton('Bold')
    await expect(boldBtn).toHaveAttribute('aria-pressed', 'true')
  })

  test('italic button appears active when cursor is in italic text', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.insertContent('<em>italic text</em>')
    })
    const italicEl = rcePage.contentFrame().locator('em').first()
    await italicEl.click()

    const italicBtn = rcePage.toolbarButton('Italic')
    await expect(italicBtn).toHaveAttribute('aria-pressed', 'true')
  })

  test('bold button is not active in plain text', async ({page, rcePage}) => {
    await rcePage.typeContent('plain text')
    const boldBtn = rcePage.toolbarButton('Bold')
    // Should not be pressed when cursor is in plain text
    const pressed = await boldBtn.getAttribute('aria-pressed')
    expect(pressed).not.toBe('true')
  })

  test('bold button becomes inactive after moving cursor out of bold text', async ({
    page,
    rcePage,
  }) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.insertContent('<strong>bold</strong> then plain')
    })
    // Click on the plain text part
    const body = rcePage.contentFrame().locator('body')
    // Position at end to land on "plain" text
    await body.press('End')

    const boldBtn = rcePage.toolbarButton('Bold')
    const pressed = await boldBtn.getAttribute('aria-pressed')
    expect(pressed).not.toBe('true')
  })

  test('underline button appears active when cursor is in underlined text', async ({
    page,
    rcePage,
  }) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.insertContent(
        '<span style="text-decoration: underline;">underlined</span>',
      )
    })
    const underlineEl = rcePage.contentFrame().locator('span').first()
    await underlineEl.click()

    const underlineBtn = rcePage.toolbarButton('Underline')
    await expect(underlineBtn).toHaveAttribute('aria-pressed', 'true')
  })
})
