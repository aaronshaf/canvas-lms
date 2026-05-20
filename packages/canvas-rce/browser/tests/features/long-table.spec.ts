import {test, expect} from '../../fixtures/test'

// Grade tables, attendance sheets, and large datasets appear in course content.
// A 100-row table tests serialization stability — TinyMCE must not truncate,
// skip rows, or crash when processing large tables.
test.describe('large table stability', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('100-row table — first and last rows preserved', async ({page}) => {
    const rows = Array.from(
      {length: 100},
      (_, i) => `<tr><td>Student ${i + 1}</td><td>${80 + (i % 20)}</td></tr>`,
    ).join('')
    const html = `<table><thead><tr><th>Name</th><th>Score</th></tr></thead><tbody>${rows}</tbody></table>`

    const content = await page.evaluate((h: string) => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(h)
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent()
    }, html)

    expect(content).toContain('Student 1')
    expect(content).toContain('Student 100')
    expect(content).toContain('Name')
    expect(content).toContain('Score')
  })

  test('50-column table — first and last columns preserved', async ({page}) => {
    const headers = Array.from({length: 50}, (_, i) => `<th>Q${i + 1}</th>`).join('')
    const cells = Array.from({length: 50}, (_, i) => `<td>${i * 2}</td>`).join('')
    const html = `<table><thead><tr>${headers}</tr></thead><tbody><tr>${cells}</tr></tbody></table>`

    const content = await page.evaluate((h: string) => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(h)
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent()
    }, html)

    expect(content).toContain('Q1')
    expect(content).toContain('Q50')
  })

  test('table with 20 rows and 10 columns — content is non-empty', async ({page}) => {
    const rows = Array.from({length: 20}, (_, r) => {
      const cells = Array.from({length: 10}, (_, c) => `<td>R${r + 1}C${c + 1}</td>`).join('')
      return `<tr>${cells}</tr>`
    }).join('')
    const html = `<table><tbody>${rows}</tbody></table>`

    const content = await page.evaluate((h: string) => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent(h)
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent()
    }, html)

    expect(content).toContain('R1C1')
    expect(content).toContain('R20C10')
  })
})
