import {test, expect} from '../../fixtures/test'

// javascript: URIs as XSS vectors appear in more attributes than just href.
// form action, input formaction, and button formaction can also execute JS.
// TinyMCE strips form elements entirely, but tests document this to ensure
// a refactor doesn't accidentally start passing these through.
test.describe('javascript: URI in form-related attributes', () => {
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

  test('form with javascript: action — form stripped or action removed', async ({page}) => {
    const content = await setAndGet(
      page,
      '<form action="javascript:alert(1)"><p>Form text</p></form><p>After form</p>',
    )
    expect(content).not.toContain('javascript:alert')
    expect(content).toContain('After form')
  })

  test('button with javascript: formaction — stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<button formaction="javascript:void(0)">Click</button><p>Safe text</p>',
    )
    expect(content).not.toContain('javascript:')
    expect(content).toContain('Safe text')
  })

  test('input with javascript: formaction — stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<input type="submit" formaction="javascript:alert(document.cookie)" value="Submit" /><p>Content</p>',
    )
    expect(content).not.toContain('javascript:')
    expect(content).toContain('Content')
  })

  test('iframe with javascript: src — stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Before</p><iframe src="javascript:alert(1)"></iframe><p>After</p>',
    )
    expect(content).not.toContain('javascript:alert')
    expect(content).toContain('Before')
    expect(content).toContain('After')
  })

  test('img with javascript: src — stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><img src="javascript:alert(1)" alt="xss" />Safe paragraph</p>',
    )
    expect(content).not.toContain('javascript:alert')
    expect(content).toContain('Safe paragraph')
  })

  test('blockquote cite with javascript: — blockquote text preserved', async ({page}) => {
    // TinyMCE preserves the cite attribute on blockquote even with javascript: value.
    // The text content must survive; the cite attribute is not an execution vector
    // (browsers do not execute javascript: in cite). Document actual behavior.
    const content = await setAndGet(
      page,
      '<blockquote cite="javascript:alert(1)"><p>Quote text</p></blockquote>',
    )
    expect(content).toContain('Quote text')
    expect(typeof content).toBe('string')
  })
})
