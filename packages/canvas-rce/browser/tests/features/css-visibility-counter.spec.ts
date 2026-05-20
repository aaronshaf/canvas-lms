import {test, expect} from '../../fixtures/test'

// visibility: hidden hides elements without removing them from layout —
// used for tooltip triggers, conditional content, and print-only elements.
// CSS counters (counter-reset/counter-increment) generate automatic numbering
// for outlines and ordered structures without <ol>. Text must survive both.
test.describe('CSS visibility and counter properties', () => {
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

  test('visibility: hidden — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Visible text <span style="visibility: hidden;">Hidden span</span> more visible text.</p>',
    )
    expect(content).toContain('Visible text')
    expect(content).toContain('more visible text')
  })

  test('visibility: visible (explicit) — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="visibility: visible;">Explicitly visible paragraph.</p>',
    )
    expect(content).toContain('Explicitly visible paragraph')
  })

  test('counter-reset on container — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="counter-reset: section 0;"><p>Counter reset container</p><p style="counter-increment: section;">First section item</p></div>',
    )
    expect(content).toContain('Counter reset container')
    expect(content).toContain('First section item')
  })

  test('CSS counter on heading hierarchy — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="counter-reset: chapter;"><h2 style="counter-increment: chapter;">Introduction</h2><h2 style="counter-increment: chapter;">Methodology</h2><h2 style="counter-increment: chapter;">Results</h2></div>',
    )
    expect(content).toContain('Introduction')
    expect(content).toContain('Methodology')
    expect(content).toContain('Results')
  })

  test('opacity: 0 (invisible but present) — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Normal text <span style="opacity: 0;">Transparent span text</span> after.</p>',
    )
    expect(content).toContain('Normal text')
    expect(content).toContain('after')
  })
})
