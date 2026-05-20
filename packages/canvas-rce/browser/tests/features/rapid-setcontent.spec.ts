import {test, expect} from '../../fixtures/test'

// Repeated setContent calls simulate real-world usage: autosave loading a draft,
// a user switching between content templates, or a test harness resetting state.
// Each call must fully replace prior content with no bleed-through or corruption.
test.describe('rapid and repeated setContent calls', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('second setContent fully replaces first content', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Original content</p>')
      ed.setContent('<p>Replacement content</p>')
      return ed.getContent()
    })
    expect(result).toContain('Replacement content')
    expect(result).not.toContain('Original content')
  })

  test('ten sequential setContent calls leave only the last content', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      for (let i = 1; i <= 10; i++) {
        ed.setContent(`<p>Content version ${i}</p>`)
      }
      return ed.getContent()
    })
    expect(result).toContain('Content version 10')
    expect(result).not.toContain('Content version 9')
    expect(result).not.toContain('Content version 5')
  })

  test('setContent with empty string followed by real content works', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('')
      ed.setContent('<p>Content after empty reset</p>')
      return ed.getContent()
    })
    expect(result).toContain('Content after empty reset')
  })

  test('setContent alternating between rich and plain content is stable', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<ul><li>List item</li></ul>')
      ed.setContent('<p>Plain paragraph</p>')
      ed.setContent('<h2>Heading</h2><p>Body text</p>')
      return ed.getContent()
    })
    expect(result).toContain('Heading')
    expect(result).toContain('Body text')
    expect(result).not.toContain('List item')
    expect(result).not.toContain('Plain paragraph')
  })

  test('setContent with table followed by setContent with paragraph is clean', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<table><tr><td>Table cell</td></tr></table>')
      ed.setContent('<p>Just a paragraph now</p>')
      return ed.getContent()
    })
    expect(result).toContain('Just a paragraph now')
    expect(result).not.toContain('Table cell')
    expect(result).not.toContain('<table')
  })

  test('pre element with language class preserves code content', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<pre class="language-python">def hello():\n    print("Hello, World!")</pre>')
      return ed.getContent()
    })
    expect(result).toContain('def hello')
    expect(result).toContain('Hello, World')
    expect(result).toMatch(/<pre/)
  })

  test('pre with language-javascript class preserves JS code', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<pre class="language-javascript">const x = 42;\nconsole.log(x);</pre>')
      return ed.getContent()
    })
    expect(result).toContain('const x = 42')
    expect(result).toContain('console.log')
  })
})
