import {test, expect} from '../../fixtures/test'

// Links toolbar button → dropdown → "External Link" opens RCELinkOptionsDialog modal
const linksBtn = '.tox-toolbar__primary [aria-label="Links"]'

async function openInsertLink(page: any) {
  await page.locator(linksBtn).click()
  await page.locator('.tox-collection__item[title="External Link"]').click()
  await page
    .locator('[data-testid="RCELinkOptionsDialog"]')
    .waitFor({state: 'visible', timeout: 10_000})
}

test.describe('links', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await rcePage.contentFrame().locator('body').click()
  })

  test('External Link menu item opens Insert Link dialog', async ({page}) => {
    await openInsertLink(page)
    await expect(page.getByRole('dialog', {name: 'Insert Link'})).toBeVisible()
  })

  test('Insert Link dialog has Text and Link inputs', async ({page}) => {
    await openInsertLink(page)
    const dialog = page.locator('[data-testid="RCELinkOptionsDialog"]')
    await expect(dialog.getByLabel('Text')).toBeVisible()
    await expect(dialog.getByLabel('Link')).toBeVisible()
  })

  test('inserting a link creates an <a> tag in the content', async ({page, rcePage}) => {
    await openInsertLink(page)
    const dialog = page.locator('[data-testid="RCELinkOptionsDialog"]')
    await dialog.getByLabel('Text').fill('Canvas')
    await expect(dialog.getByLabel('Text')).toHaveValue('Canvas')
    await dialog.getByLabel('Link').fill('https://canvas.instructure.com')
    await expect(dialog.getByLabel('Link')).toHaveValue('https://canvas.instructure.com')
    await dialog.getByRole('button', {name: 'Done'}).click()
    await expect(dialog).not.toBeVisible({timeout: 5_000})
    const content = await rcePage.getContent()
    expect(content).toMatch(/<a[^>]+href="https:\/\/canvas\.instructure\.com"/)
    expect(content).toContain('Canvas')
  })

  test('pre-selected text pre-fills the Text field', async ({page, rcePage}) => {
    await rcePage.typeContent('visit Canvas')
    await rcePage.contentFrame().locator('body').press('Control+a')
    await openInsertLink(page)
    const textValue = await page
      .locator('[data-testid="RCELinkOptionsDialog"]')
      .getByLabel('Text')
      .inputValue()
    expect(textValue).toContain('visit Canvas')
  })

  test('closing the dialog without submitting leaves content unchanged', async ({
    page,
    rcePage,
  }) => {
    await rcePage.typeContent('original text')
    const before = await rcePage.getContent()
    await openInsertLink(page)
    await page
      .locator('[data-testid="RCELinkOptionsDialog"]')
      .getByRole('button', {name: 'Close'})
      .first()
      .click()
    await expect(page.locator('[data-testid="RCELinkOptionsDialog"]')).not.toBeVisible({
      timeout: 5_000,
    })
    const after = await rcePage.getContent()
    expect(after).toBe(before)
  })
})
