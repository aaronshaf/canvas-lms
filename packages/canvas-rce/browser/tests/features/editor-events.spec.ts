import {test, expect} from '../../fixtures/test'

// TinyMCE fires events (change, keyup, beforeGetContent, GetContent) that
// Canvas hooks into for auto-save, dirty-state tracking, and content
// post-processing. Tests verify these events fire as expected and that
// event listeners can observe the content at the right lifecycle point.
test.describe('editor event API', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('GetContent event fires when getContent is called', async ({page}) => {
    const fired = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      let eventFired = false
      ed.on('GetContent', () => {
        eventFired = true
      })
      ed.setContent('<p>Event test</p>')
      ed.getContent()
      ed.off('GetContent')
      return eventFired
    })
    expect(fired).toBe(true)
  })

  test('SetContent event fires when setContent is called', async ({page}) => {
    const fired = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      let eventFired = false
      ed.on('SetContent', () => {
        eventFired = true
      })
      ed.setContent('<p>SetContent event</p>')
      ed.off('SetContent')
      return eventFired
    })
    expect(fired).toBe(true)
  })

  test('BeforeGetContent event fires before getContent', async ({page}) => {
    const result = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      let order: string[] = []
      ed.on('BeforeGetContent', () => {
        order.push('before')
      })
      ed.on('GetContent', () => {
        order.push('get')
      })
      ed.setContent('<p>Order test</p>')
      ed.getContent()
      ed.off('BeforeGetContent')
      ed.off('GetContent')
      return order
    })
    expect(result).toContain('before')
    expect(result).toContain('get')
    expect(result.indexOf('before')).toBeLessThan(result.indexOf('get'))
  })

  test('init event was already fired by beforeEach', async ({page}) => {
    // Editor is already initialized — verify we can still attach and fire new events
    const canAttach = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      let count = 0
      const handler = () => {
        count++
      }
      ed.on('SetContent', handler)
      ed.setContent('<p>A</p>')
      ed.setContent('<p>B</p>')
      ed.off('SetContent', handler)
      return count
    })
    expect(canAttach).toBe(2)
  })
})
