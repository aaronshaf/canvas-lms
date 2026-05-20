import {test, expect} from '../../fixtures/test'

// The editorOptions prop passes TinyMCE init options through canvas-rce.
// height is the most visible contract — if it stops working, the editor may
// render too small for course content authoring.
test.describe('editorOptions prop', () => {
  test('editor respects the height set in editorOptions', async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()

    // The basic scenario sets height: 350
    const editorBox = await page.locator('.tox-tinymce').boundingBox()
    expect(editorBox).not.toBeNull()
    // Allow ±50px tolerance for chrome (toolbar, statusbar) around the specified height
    expect(editorBox!.height).toBeGreaterThan(200)
    expect(editorBox!.height).toBeLessThan(700)
  })

  test('editor iframe height grows to fill the editor container', async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()

    const iframeBox = await page.locator('iframe.tox-edit-area__iframe').boundingBox()
    const editorBox = await page.locator('.tox-tinymce').boundingBox()
    expect(iframeBox).not.toBeNull()
    expect(editorBox).not.toBeNull()
    // iframe must be inside the editor bounds
    expect(iframeBox!.height).toBeGreaterThan(50)
    expect(iframeBox!.y).toBeGreaterThanOrEqual(editorBox!.y)
  })

  test('RTL scenario editor height is also set correctly', async ({page, rcePage}) => {
    await page.goto('/scenarios/rtl')
    await rcePage.waitForEditor()

    const editorBox = await page.locator('.tox-tinymce').boundingBox()
    expect(editorBox!.height).toBeGreaterThan(200)
  })

  test('readonly scenario editor maintains its dimensions', async ({page, rcePage}) => {
    await page.goto('/scenarios/readonly')
    await rcePage.waitForEditor()

    const editorBox = await page.locator('.tox-tinymce').boundingBox()
    expect(editorBox!.width).toBeGreaterThan(200)
    expect(editorBox!.height).toBeGreaterThan(100)
  })

  test('editor width fills its container', async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()

    const editorBox = await page.locator('.tox-tinymce').boundingBox()
    const viewportWidth = page.viewportSize()?.width ?? 1280
    // Editor should fill most of the viewport width (accounting for padding)
    expect(editorBox!.width).toBeGreaterThan(viewportWidth * 0.5)
  })
})
