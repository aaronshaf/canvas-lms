import {test, expect} from '../../fixtures/test'

// <ins> and <del> are semantic elements for tracked-changes markup:
// <ins> marks inserted text (displayed with underline by default)
// <del> marks deleted text (displayed with strikethrough by default)
// They appear in course content that shows revisions, legal documents, or
// tracked edits. canvas-rce must preserve them through round-trips.
test.describe('<ins> and <del> tracked-change elements', () => {
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

  test('<del> text is preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>The answer is <del>42</del> <ins>43</ins>.</p>')
    expect(content).toContain('42')
    expect(content).toContain('43')
  })

  test('<ins> with datetime attribute — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>New clause: <ins datetime="2024-01-15">all students must register</ins></p>',
    )
    expect(content).toContain('all students must register')
  })

  test('<del> with cite attribute — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><del cite="https://example.com/policy">Old policy text</del></p>',
    )
    expect(content).toContain('Old policy text')
  })

  test('<ins> and <del> in a list item both preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul><li><del>Remove this step</del></li><li><ins>Add this step</ins></li></ul>',
    )
    expect(content).toContain('Remove this step')
    expect(content).toContain('Add this step')
  })

  test('<del> wrapping a long passage — all text survives', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><del>This entire sentence has been removed from the revised document.</del> New text here.</p>',
    )
    expect(content).toContain('New text here')
    expect(content).toContain('removed from the revised')
  })

  test('<ins> inside a table cell is preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><td><del>Old value</del> <ins>New value</ins></td></tr></table>',
    )
    expect(content).toContain('Old value')
    expect(content).toContain('New value')
  })
})
