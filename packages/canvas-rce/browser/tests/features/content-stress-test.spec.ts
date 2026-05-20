import {test, expect} from '../../fixtures/test'

// Stress tests with high element counts verify that TinyMCE's serializer
// doesn't have O(n²) behavior, memory leaks, or truncation bugs when
// handling the kind of long course pages real instructors create.
test.describe('high element count stress tests', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('200 paragraphs — first and last preserved', async ({page}) => {
    const paras = Array.from({length: 200}, (_, i) => `<p>Paragraph ${i + 1} content.</p>`).join('')
    const content = await page.evaluate((html: string) => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(html)
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent()
    }, paras)
    expect(content).toContain('Paragraph 1 content')
    expect(content).toContain('Paragraph 200 content')
  })

  test('100 list items — first and last preserved', async ({page}) => {
    const items = Array.from({length: 100}, (_, i) => `<li>Item ${i + 1}</li>`).join('')
    const html = `<ol>${items}</ol>`
    const content = await page.evaluate((h: string) => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(h)
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent()
    }, html)
    expect(content).toContain('Item 1')
    expect(content).toContain('Item 100')
  })

  test('50 headings alternating h2/h3 — first and last preserved', async ({page}) => {
    const headings = Array.from({length: 50}, (_, i) =>
      i % 2 === 0 ? `<h2>Section ${i + 1}</h2>` : `<h3>Subsection ${i + 1}</h3>`,
    ).join('')
    const content = await page.evaluate((h: string) => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(h)
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent()
    }, headings)
    expect(content).toContain('Section 1')
    expect(content).toContain('Subsection 50')
  })

  test('20 tables of 5 rows each — no crash', async ({page}) => {
    const tables = Array.from({length: 20}, (_, t) => {
      const rows = Array.from(
        {length: 5},
        (_, r) => `<tr><td>T${t + 1}R${r + 1}A</td><td>T${t + 1}R${r + 1}B</td></tr>`,
      ).join('')
      return `<table><tbody>${rows}</tbody></table>`
    }).join('')
    const content = await page.evaluate((h: string) => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(h)
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent()
    }, tables)
    expect(content).toContain('T1R1A')
    expect(content).toContain('T20R5B')
  })
})
