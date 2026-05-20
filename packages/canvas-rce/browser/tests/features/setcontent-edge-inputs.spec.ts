import {test, expect} from '../../fixtures/test'

// setContent must handle edge-case inputs gracefully — empty strings, whitespace-
// only content, single characters, and extremely minimal HTML. These cover the
// boundary conditions of the content lifecycle (new empty page, cleared editor,
// one-character edit). None should crash the editor.
test.describe('setContent with edge-case inputs', () => {
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

  test('empty string — editor does not crash', async ({page}) => {
    const content = await setAndGet(page, '')
    expect(typeof content).toBe('string')
  })

  test('single space — editor does not crash', async ({page}) => {
    const content = await setAndGet(page, ' ')
    expect(typeof content).toBe('string')
  })

  test('just a newline character — editor does not crash', async ({page}) => {
    const content = await setAndGet(page, '\n')
    expect(typeof content).toBe('string')
  })

  test('single character — editor returns non-empty', async ({page}) => {
    const content = await setAndGet(page, '<p>A</p>')
    expect(content).toContain('A')
  })

  test('only whitespace paragraph — editor handles gracefully', async ({page}) => {
    const content = await setAndGet(page, '<p>   </p>')
    expect(typeof content).toBe('string')
  })

  test('only an hr element — editor does not crash', async ({page}) => {
    const content = await setAndGet(page, '<hr />')
    expect(typeof content).toBe('string')
  })

  test('setting content twice in sequence — second content wins', async ({page}) => {
    await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>First content</p>')
      // @ts-expect-error -- TinyMCE global
      window.tinymce.activeEditor.setContent('<p>Second content</p>')
    })
    const content = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return window.tinymce.activeEditor.getContent()
    })
    expect(content).toContain('Second content')
    expect(content).not.toContain('First content')
  })
})
