import {test, expect} from '../../fixtures/test'

// word-break, overflow-wrap (formerly word-wrap), and hyphens control how
// long words wrap within containers. Used for code blocks with long identifiers,
// URL display, and narrow table cells with long content. Text must survive
// regardless of TinyMCE's handling of these wrapping CSS properties.
test.describe('CSS word-break, overflow-wrap, and hyphens', () => {
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

  test('word-break: break-all — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="word-break: break-all;">superlongwordthatwillbreakanywhereinthemiddleofanycharacter</p>',
    )
    expect(content).toContain('superlongword')
  })

  test('word-break: keep-all — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="word-break: keep-all;">Keep all words together without breaking</p>',
    )
    expect(content).toContain('Keep all words together')
  })

  test('overflow-wrap: break-word — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="overflow-wrap: break-word;">https://very-long-url-example.instructure.com/courses/12345/assignments/67890</p>',
    )
    expect(content).toContain('courses')
  })

  test('overflow-wrap: anywhere — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<td style="overflow-wrap: anywhere; width: 100px;">VeryLongTableCellContentWithoutSpaces</td>',
    )
    expect(content).toContain('VeryLongTableCell')
  })

  test('hyphens: auto — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="hyphens: auto;" lang="en">This paragraph will use automatic hyphenation for long words in justified text.</p>',
    )
    expect(content).toContain('automatic hyphenation')
  })

  test('hyphens: none — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="hyphens: none;">No hyphenation applied to this paragraph.</p>',
    )
    expect(content).toContain('No hyphenation applied')
  })

  test('white-space: break-spaces — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p style="white-space: break-spaces;">Break spaces text content here.</p>',
    )
    expect(content).toContain('Break spaces text content')
  })
})
