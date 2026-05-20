import {test, expect} from '../../fixtures/test'

// Enter creates a new <p> paragraph; Shift+Enter creates a <br> line break.
// These are distinct user actions with distinct HTML output — canvas-rce must
// preserve both behaviors across any refactor.
test.describe('line breaks — Enter vs Shift+Enter', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
    await rcePage.contentFrame().locator('body').click()
  })

  test('Enter key creates a new paragraph', async ({page, rcePage}) => {
    await rcePage.typeContent('line one')
    await page.keyboard.press('Enter')
    await rcePage.typeContent('line two')

    const content = await rcePage.getContent()
    // Two separate <p> tags
    const pTags = content.match(/<p[^>]*>/g) ?? []
    expect(pTags.length).toBeGreaterThanOrEqual(2)
    expect(content).toContain('line one')
    expect(content).toContain('line two')
    // Each paragraph element should contain only one of the lines, not both
    const pElements = content.match(/<p[^>]*>[\s\S]*?<\/p>/g) ?? []
    const noParagraphHasBoth = pElements.every(
      p => !(p.includes('line one') && p.includes('line two')),
    )
    expect(noParagraphHasBoth).toBe(true)
  })

  test('Shift+Enter creates a line break within the same paragraph', async ({page, rcePage}) => {
    await rcePage.typeContent('line one')
    await page.keyboard.press('Shift+Enter')
    await rcePage.typeContent('line two')

    const content = await rcePage.getContent()
    // Should contain a <br> and both texts should be in the same paragraph
    expect(content).toMatch(/<br\s*\/?>/)
    expect(content).toContain('line one')
    expect(content).toContain('line two')
    // Both lines in one <p>
    const paragraphs = content.match(/<p[^>]*>[\s\S]*?<\/p>/g) ?? []
    const containsBoth = paragraphs.some(p => p.includes('line one') && p.includes('line two'))
    expect(containsBoth).toBe(true)
  })

  test('multiple Enter keys create multiple paragraphs', async ({page, rcePage}) => {
    await rcePage.typeContent('p1')
    await page.keyboard.press('Enter')
    await rcePage.typeContent('p2')
    await page.keyboard.press('Enter')
    await rcePage.typeContent('p3')

    const content = await rcePage.getContent()
    const paragraphs = content.match(/<p[^>]*>/g) ?? []
    expect(paragraphs.length).toBeGreaterThanOrEqual(3)
  })

  test('multiple Shift+Enter keeps content in a single paragraph with multiple br', async ({
    page,
    rcePage,
  }) => {
    await rcePage.typeContent('a')
    await page.keyboard.press('Shift+Enter')
    await rcePage.typeContent('b')
    await page.keyboard.press('Shift+Enter')
    await rcePage.typeContent('c')

    const content = await rcePage.getContent()
    const brCount = (content.match(/<br\s*\/?>/g) ?? []).length
    expect(brCount).toBeGreaterThanOrEqual(2)
    const paragraphs = content.match(/<p[^>]*>/g) ?? []
    expect(paragraphs.length).toBe(1)
  })
})
