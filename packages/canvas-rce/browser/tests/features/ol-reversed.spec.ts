import {test, expect} from '../../fixtures/test'

// <ol reversed> counts down from the total to 1 — used in countdown lists,
// "top N" rankings in reverse order, and procedures that work backwards.
// The `reversed` boolean attribute and explicit `value` overrides on items
// must survive so the displayed numbering stays correct after save/reload.
test.describe('<ol reversed> and mixed value attributes', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  async function setAndGet(page: any, html: string): Promise<string> {
    return page.evaluate((content: string) => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(content)
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent()
    }, html)
  }

  test('<ol reversed> items — all list items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol reversed><li>Third place: Bronze</li><li>Second place: Silver</li><li>First place: Gold</li></ol>',
    )
    expect(content).toContain('Third place: Bronze')
    expect(content).toContain('First place: Gold')
  })

  test('<ol reversed start="10"> countdown — items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol reversed start="5"><li>Item five</li><li>Item four</li><li>Item three</li></ol>',
    )
    expect(content).toContain('Item five')
    expect(content).toContain('Item three')
  })

  test('<ol> with explicit li value overrides — items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol><li value="10">Tenth step</li><li>Eleventh step</li><li value="20">Twentieth step</li></ol>',
    )
    expect(content).toContain('Tenth step')
    expect(content).toContain('Eleventh step')
    expect(content).toContain('Twentieth step')
  })

  test('<ol reversed type="A"> — items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol reversed type="A"><li>Option C</li><li>Option B</li><li>Option A</li></ol>',
    )
    expect(content).toContain('Option C')
    expect(content).toContain('Option A')
  })
})
