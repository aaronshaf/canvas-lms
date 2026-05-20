import {test, expect} from '../../fixtures/test'

// Canvas course pages can contain very large amounts of content — full lecture
// notes, complete syllabi, rich rubrics. canvas-rce must handle large documents
// without dropping content, corrupting structure, or failing serialization.
test.describe('large document stability', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('50 paragraphs all survive getContent round-trip', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      const paragraphs = Array.from(
        {length: 50},
        (_, i) => `<p>Paragraph number ${i + 1} with some course content text.</p>`,
      ).join('')
      ed.setContent(paragraphs)
      return ed.getContent()
    })
    expect(result).toContain('Paragraph number 1')
    expect(result).toContain('Paragraph number 25')
    expect(result).toContain('Paragraph number 50')
    // Verify no duplication
    const count = (result.match(/Paragraph number 50/g) ?? []).length
    expect(count).toBe(1)
  })

  test('document with 20 headings and body text preserves all', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      const sections = Array.from(
        {length: 20},
        (_, i) => `<h2>Section ${i + 1}</h2><p>Content for section ${i + 1}.</p>`,
      ).join('')
      ed.setContent(sections)
      return ed.getContent()
    })
    expect(result).toContain('Section 1')
    expect(result).toContain('Section 10')
    expect(result).toContain('Section 20')
    const headingCount = (result.match(/<h2/g) ?? []).length
    expect(headingCount).toBe(20)
  })

  test('large table with 10 rows x 5 columns preserves all cells', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      const rows = Array.from(
        {length: 10},
        (_, r) =>
          `<tr>${Array.from({length: 5}, (_, c) => `<td>R${r + 1}C${c + 1}</td>`).join('')}</tr>`,
      ).join('')
      ed.setContent(`<table><tbody>${rows}</tbody></table>`)
      return ed.getContent()
    })
    expect(result).toContain('R1C1')
    expect(result).toContain('R5C3')
    expect(result).toContain('R10C5')
  })

  test('getContent is deterministic on a large document (called 3 times)', async ({page}) => {
    const results = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      const content = Array.from(
        {length: 30},
        (_, i) => `<p>Paragraph ${i + 1}: The quick brown fox jumped over the lazy dog.</p>`,
      ).join('')
      ed.setContent(content)
      return [ed.getContent(), ed.getContent(), ed.getContent()]
    })
    expect(results[0]).toBe(results[1])
    expect(results[1]).toBe(results[2])
  })

  test('document with 15 nested lists all preserve content', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      const lists = Array.from(
        {length: 15},
        (_, i) =>
          `<ul><li>Topic ${i + 1}A</li><li>Topic ${i + 1}B</li><li>Topic ${i + 1}C</li></ul>`,
      ).join('')
      ed.setContent(lists)
      return ed.getContent()
    })
    expect(result).toContain('Topic 1A')
    expect(result).toContain('Topic 8B')
    expect(result).toContain('Topic 15C')
  })
})
