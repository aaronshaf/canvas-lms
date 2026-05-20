import {test, expect} from '../../fixtures/test'

// Tests converting content between block types via the Blocks dropdown.
// This is the inverse of heading application — users frequently demote headings
// back to paragraphs or switch between heading levels.
test.describe('blocks — conversion between types', () => {
  const blocksBtn = '.tox-tbtn--bespoke[aria-label="Blocks"]'

  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await rcePage.contentFrame().locator('body').click()
  })

  test('heading can be converted back to paragraph via Blocks menu', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<h2>was a heading</h2>')
    })
    await rcePage.contentFrame().locator('h2').click()
    await page.locator(blocksBtn).click()
    await page.locator('.tox-collection__item:has-text("Paragraph")').click()

    const content = await rcePage.getContent()
    expect(content).not.toMatch(/<h2/)
    expect(content).toMatch(/<p[^>]*>/)
    expect(content).toContain('was a heading')
  })

  test('h1 can be changed to h3 via Blocks menu', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<h1>level one</h1>')
    })
    await rcePage.contentFrame().locator('h1').click()
    await page.locator(blocksBtn).click()
    await page.locator('.tox-collection__item:has-text("Heading 3")').click()

    const content = await rcePage.getContent()
    expect(content).toMatch(/<h3/)
    expect(content).not.toMatch(/<h1/)
    expect(content).toContain('level one')
  })

  test('paragraph promoted to h2 then back to paragraph loses heading tag', async ({
    page,
    rcePage,
  }) => {
    await rcePage.typeContent('will be promoted')
    await rcePage.contentFrame().locator('body').press('Control+a')

    // Promote to h2
    await page.locator(blocksBtn).click()
    await page.locator('.tox-collection__item:has-text("Heading 2")').click()
    expect(await rcePage.getContent()).toMatch(/<h2/)

    // Demote back to paragraph
    await page.locator(blocksBtn).click()
    await page.locator('.tox-collection__item:has-text("Paragraph")').click()
    const content = await rcePage.getContent()
    expect(content).not.toMatch(/<h2/)
    expect(content).toContain('will be promoted')
  })

  test('Blocks menu shows correct current block type', async ({page, rcePage}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<h3>a heading 3</h3>')
    })
    await rcePage.contentFrame().locator('h3').click()
    // The bespoke button should display the current block type
    const blocksLabel = await page.locator(blocksBtn).textContent()
    expect(blocksLabel).toContain('Heading 3')
  })
})
