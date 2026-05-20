import {test, expect} from '../../fixtures/test'

// -webkit-line-clamp truncates multi-line text to N lines with an ellipsis.
// It requires display:-webkit-box and -webkit-box-orient:vertical to work.
// Canvas course cards and announcement previews use this pattern to show
// a fixed-height excerpt. The text content must survive the RCE round-trip
// even if TinyMCE strips the vendor-prefixed properties.
test.describe('CSS line-clamp and text truncation', () => {
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

  test('2-line clamp on announcement preview — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">This week we are covering neural networks and deep learning fundamentals. Please complete the readings before Thursday\'s lab session.</p>',
    )
    expect(content).toContain('neural networks')
    expect(content).toContain('Thursday')
  })

  test('3-line clamp on course description — content preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div style="-webkit-line-clamp:3;overflow:hidden;"><p>Introduction to Data Science covers statistical analysis, data visualization, machine learning fundamentals, and real-world data wrangling with Python and R.</p></div>',
    )
    expect(content).toContain('Introduction to Data Science')
    expect(content).toContain('machine learning fundamentals')
  })

  test('line-clamp with text-overflow ellipsis on single line — label preserved', async ({
    page,
  }) => {
    const content = await setAndGet(
      page,
      '<p style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:300px;">Assignment: Week 8 Research Paper Draft Submission</p>',
    )
    expect(content).toContain('Research Paper Draft Submission')
  })

  test('clamp inside table cell — cell text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><th>Assignment</th><th>Description</th></tr><tr><td>Essay 1</td><td style="-webkit-line-clamp:2;overflow:hidden;">Analyze the themes of isolation and community in modern dystopian fiction, focusing on three primary texts from the course reading list.</td></tr></table>',
    )
    expect(content).toContain('Essay 1')
    expect(content).toContain('dystopian fiction')
  })

  test('multiple clamped paragraphs — all content preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<div>
        <p style="-webkit-line-clamp:2;overflow:hidden;">Module 1: Introduction to programming concepts and computational thinking.</p>
        <p style="-webkit-line-clamp:2;overflow:hidden;">Module 2: Variables, data types, and control flow structures in Python.</p>
        <p style="-webkit-line-clamp:2;overflow:hidden;">Module 3: Functions, recursion, and algorithmic problem solving strategies.</p>
      </div>`,
    )
    expect(content).toContain('computational thinking')
    expect(content).toContain('control flow structures')
    expect(content).toContain('algorithmic problem solving')
  })
})
