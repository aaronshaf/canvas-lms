import {test, expect} from '../../fixtures/test'

// <input type="hidden"> in a content body can exfiltrate data if a form
// submit is triggered, and can seed form data that another form on the page
// reads. It must be stripped from canvas-rce content. All visible surrounding
// text must survive.
test.describe('<input type="hidden"> and credential-like inputs stripped', () => {
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

  test('<input type="hidden"> is stripped — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Before.</p><input type="hidden" name="csrf_token" value="secret" /><p>After.</p>',
    )
    expect(content).not.toContain('<input')
    expect(content).not.toContain('csrf_token')
    expect(content).toContain('Before')
    expect(content).toContain('After')
  })

  test('<input type="password"> is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Enter: <input type="password" name="pin" /> here.</p>',
    )
    expect(content).not.toContain('<input')
    expect(content).toContain('Enter')
    expect(content).toContain('here')
  })

  test('<input type="email"> is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Email: <input type="email" name="user_email" /> end.</p>',
    )
    expect(content).not.toContain('<input')
    expect(content).toContain('Email')
    expect(content).toContain('end')
  })

  test('multiple hidden inputs stripped — visible text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<input type="hidden" name="a" value="1" /><p>Visible content</p><input type="hidden" name="b" value="2" />',
    )
    expect(content).not.toContain('<input')
    expect(content).toContain('Visible content')
  })

  test('<input type="text"> is stripped — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Answer: <input type="text" placeholder="type here" /> submit.</p>',
    )
    expect(content).not.toContain('<input')
    expect(content).toContain('Answer')
    expect(content).toContain('submit')
  })
})
