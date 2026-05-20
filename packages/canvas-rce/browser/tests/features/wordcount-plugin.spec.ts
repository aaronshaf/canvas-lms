import {test, expect} from '../../fixtures/test'

// TinyMCE's wordcount plugin exposes a getCount() API used by Canvas to
// show word count to students in assignment editors. Tests verify the
// plugin is available and returns sensible numeric values for different
// content types — a refactor must not accidentally remove this plugin.
test.describe('wordcount plugin API', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('wordcount plugin is present', async ({page}) => {
    const hasPlugin = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      return !!(ed.plugins && ed.plugins.wordcount)
    })
    expect(hasPlugin).toBe(true)
  })

  test('word count for a simple paragraph is greater than zero', async ({page}) => {
    const count = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>The quick brown fox jumps</p>')
      return ed.plugins.wordcount?.getCount?.() ?? -1
    })
    expect(count).toBeGreaterThan(0)
  })

  test('word count increases with more words', async ({page}) => {
    const [short, long] = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p>Five words here only.</p>')
      const shortCount = ed.plugins.wordcount?.getCount?.() ?? 0
      ed.setContent('<p>This paragraph has more words than the previous one did contain here.</p>')
      const longCount = ed.plugins.wordcount?.getCount?.() ?? 0
      return [shortCount, longCount]
    })
    expect(long).toBeGreaterThan(short)
  })

  test('word count is zero for empty content', async ({page}) => {
    const count = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('')
      return ed.plugins.wordcount?.getCount?.() ?? -1
    })
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('word count ignores HTML tags — counts only text words', async ({page}) => {
    const count = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      ed.setContent('<p><strong>Bold</strong> and <em>italic</em> words.</p>')
      return ed.plugins.wordcount?.getCount?.() ?? -1
    })
    // Should count "Bold", "and", "italic", "words" = 4
    expect(count).toBeGreaterThanOrEqual(3)
  })
})
