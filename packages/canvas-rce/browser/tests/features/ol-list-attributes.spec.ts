import {test, expect} from '../../fixtures/test'

// Ordered lists support type (1/a/A/i/I), start (begin numbering at N), and
// reversed attributes. These appear in course outlines, legal citations, and
// multi-part problem sets where numbering continuity matters across page edits.
test.describe('ordered list type, start, and reversed attributes', () => {
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

  test('ol type="a" lowercase alpha — list items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol type="a"><li>First option</li><li>Second option</li><li>Third option</li></ol>',
    )
    expect(content).toContain('First option')
    expect(content).toContain('Third option')
  })

  test('ol type="A" uppercase alpha — list items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol type="A"><li>Option Alpha</li><li>Option Bravo</li></ol>',
    )
    expect(content).toContain('Option Alpha')
    expect(content).toContain('Option Bravo')
  })

  test('ol type="i" lowercase roman — list items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol type="i"><li>Part one</li><li>Part two</li><li>Part three</li></ol>',
    )
    expect(content).toContain('Part one')
    expect(content).toContain('Part three')
  })

  test('ol type="I" uppercase roman — list items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol type="I"><li>Chapter I content</li><li>Chapter II content</li></ol>',
    )
    expect(content).toContain('Chapter I content')
    expect(content).toContain('Chapter II content')
  })

  test('ol start="5" — items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol start="5"><li>Fifth item</li><li>Sixth item</li></ol>',
    )
    expect(content).toContain('Fifth item')
    expect(content).toContain('Sixth item')
  })

  test('ol start="3" type="a" — combined attributes, items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol start="3" type="a"><li>Continued from c</li><li>Next item d</li></ol>',
    )
    expect(content).toContain('Continued from c')
    expect(content).toContain('Next item d')
  })

  test('nested ol with different types — all items preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol type="I"><li>Roman one<ol type="a"><li>Alpha sub-item</li><li>Beta sub-item</li></ol></li><li>Roman two</li></ol>',
    )
    expect(content).toContain('Roman one')
    expect(content).toContain('Alpha sub-item')
    expect(content).toContain('Roman two')
  })
})
