import {test, expect} from '../../fixtures/test'

// editor.on() / editor.off() / editor.fire() form TinyMCE's internal event bus.
// Plugins and the Canvas RCE wrapper listen for events like 'NodeChange',
// 'change', 'input', 'SetContent', 'GetContent'. Regressions here break
// plugin communication and toolbar state updates.
test.describe('editor event bus API (on/off/fire)', () => {
  test.beforeEach(async ({page, rcePage}) => {
    await page.goto('/scenarios/basic')
    await rcePage.waitForEditor()
  })

  test('editor.on() registers a handler that fires on SetContent', async ({page}) => {
    const fired = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      let wasFired = false
      ed.on('SetContent', () => {
        wasFired = true
      })
      ed.setContent('<p>Trigger event</p>')
      return wasFired
    })
    expect(fired).toBe(true)
  })

  test('editor.on() handler receives event object', async ({page}) => {
    const hasContent = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      let receivedEvent: any = null
      ed.on('SetContent', (e: any) => {
        receivedEvent = e
      })
      ed.setContent('<p>Event object test</p>')
      return receivedEvent !== null && typeof receivedEvent === 'object'
    })
    expect(hasContent).toBe(true)
  })

  test('editor.off() removes handler — no longer fires', async ({page}) => {
    const callCount = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      let count = 0
      const handler = () => {
        count++
      }
      ed.on('SetContent', handler)
      ed.setContent('<p>First set</p>')
      ed.off('SetContent', handler)
      ed.setContent('<p>Second set</p>')
      return count
    })
    expect(callCount).toBe(1)
  })

  test('editor.fire() dispatches a custom event — handler receives payload', async ({page}) => {
    const receivedValue = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      let capturedValue: number | null = null
      ed.on('CustomTestEvent', (e: any) => {
        capturedValue = e.testValue
      })
      ed.fire('CustomTestEvent', {testValue: 42})
      return capturedValue
    })
    // Return only the primitive testValue to avoid serializing TinyMCE event object
    expect(receivedValue).toBe(42)
  })

  test('BeforeSetContent event fires before content is set', async ({page}) => {
    const fired = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      let wasFired = false
      ed.on('BeforeSetContent', () => {
        wasFired = true
      })
      ed.setContent('<p>Before set content trigger</p>')
      return wasFired
    })
    expect(fired).toBe(true)
  })

  test('multiple handlers on same event — all called', async ({page}) => {
    const counts = await page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      const ed = window.tinymce.activeEditor
      let a = 0,
        b = 0
      ed.on('SetContent', () => {
        a++
      })
      ed.on('SetContent', () => {
        b++
      })
      ed.setContent('<p>Multi handler test</p>')
      return {a, b}
    })
    expect(counts.a).toBe(1)
    expect(counts.b).toBe(1)
  })
})
