import {test, expect} from '../../fixtures/test'

// onload, onfocus, onblur, oninput, onchange are event handlers that fire
// without user interaction — making them higher-risk XSS vectors than onclick.
// onload on an img fires automatically when the image loads.
// onfocus can be triggered by tabbing. These must all be stripped.
test.describe('onload, onfocus, and other auto-firing event handlers', () => {
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

  test('onload on img is stripped — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><img src="x.png" onload="alert(1)" alt="img" />Text after</p>',
    )
    expect(content).not.toContain('onload')
    expect(content).toContain('Text after')
  })

  test('onfocus on input is stripped — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Before<input onfocus="steal()" type="text" />After</p>',
    )
    expect(content).not.toContain('onfocus')
    expect(content).toContain('Before')
    expect(content).toContain('After')
  })

  test('onblur on a div is stripped', async ({page}) => {
    const content = await setAndGet(page, '<div onblur="exfil()" tabindex="0">Div content</div>')
    expect(content).not.toContain('onblur')
    expect(content).toContain('Div content')
  })

  test('onerror on img is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><img src="bad.jpg" onerror="javascript:alert(document.cookie)" alt="bad" />Safe text</p>',
    )
    expect(content).not.toContain('onerror')
    expect(content).not.toContain('document.cookie')
    expect(content).toContain('Safe text')
  })

  test('onmouseover on a span is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><span onmouseover="track()">Hoverable text</span></p>',
    )
    expect(content).not.toContain('onmouseover')
    expect(content).toContain('Hoverable text')
  })

  test('onkeypress on a paragraph is stripped', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p onkeypress="log(event)">Keyboard listener paragraph</p>',
    )
    expect(content).not.toContain('onkeypress')
    expect(content).toContain('Keyboard listener paragraph')
  })

  test('onsubmit on form is stripped with other form attrs', async ({page}) => {
    const content = await setAndGet(
      page,
      '<form onsubmit="steal(event)"><p>Form paragraph</p></form><p>After</p>',
    )
    expect(content).not.toContain('onsubmit')
    expect(content).not.toContain('steal(')
    expect(content).toContain('After')
  })
})
