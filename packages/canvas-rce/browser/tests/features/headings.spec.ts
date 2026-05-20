import {test, expect} from '../../fixtures/test'

// Headings are in the Blocks select button (bespoke dropdown in toolbar)
const blocksSelect = '.tox-toolbar__primary .tox-tbtn--bespoke[aria-label="Blocks"]'

async function applyBlock(page: any, blockName: string) {
  await page.locator(blocksSelect).click()
  await page.locator(`.tox-collection__item:has-text("${blockName}")`).click()
}

test.describe('heading blocks', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await rcePage.contentFrame().locator('body').click()
  })

  test('Heading 2 wraps line in <h2>', async ({page, rcePage}) => {
    await page.keyboard.type('My Heading')
    await applyBlock(page, 'Heading 2')
    const content = await rcePage.getContent()
    expect(content).toMatch(/<h2[^>]*>My Heading<\/h2>/)
  })

  test('Heading 3 wraps line in <h3>', async ({page, rcePage}) => {
    await page.keyboard.type('Sub Heading')
    await applyBlock(page, 'Heading 3')
    const content = await rcePage.getContent()
    expect(content).toMatch(/<h3[^>]*>Sub Heading<\/h3>/)
  })

  test('Heading 4 wraps line in <h4>', async ({page, rcePage}) => {
    await page.keyboard.type('Minor Heading')
    await applyBlock(page, 'Heading 4')
    const content = await rcePage.getContent()
    expect(content).toMatch(/<h4[^>]*>Minor Heading<\/h4>/)
  })

  test('switching back to Paragraph restores <p>', async ({page, rcePage}) => {
    await page.keyboard.type('Normal text')
    await applyBlock(page, 'Heading 2')
    await applyBlock(page, 'Paragraph')
    const content = await rcePage.getContent()
    expect(content).toMatch(/<p>Normal text<\/p>/)
    expect(content).not.toMatch(/<h2/)
  })
})
