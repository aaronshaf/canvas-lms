import {test, expect} from '../../fixtures/test'

// ARIA 1.1+ extended properties fill gaps in the base set — aria-details links
// to a full description element, aria-errormessage points to validation error
// text, aria-keyshortcuts advertises keyboard shortcuts, aria-roledescription
// overrides the accessible role name, aria-placeholder suggests expected input.
// Canvas form elements and rich widgets rely on these for screen reader users.
test.describe('ARIA extended properties (1.1+)', () => {
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

  test('aria-details linking to description block — label preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p id="field-detail">This field accepts ISO 8601 date formats only.</p><p aria-details="field-detail">Due date field details above.</p>',
    )
    expect(content).toContain('ISO 8601 date formats')
    expect(content).toContain('Due date field details')
  })

  test('aria-errormessage on invalid field — error text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p id="err1" role="alert">Please enter a valid email address.</p><p aria-invalid="true" aria-errormessage="err1">Email input with error.</p>',
    )
    expect(content).toContain('valid email address')
    expect(content).toContain('Email input with error')
  })

  test('aria-keyshortcuts on button — shortcut text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p><strong aria-keyshortcuts="Alt+S">Save (Alt+S)</strong> — submits the form without closing.</p>',
    )
    expect(content).toContain('Save')
    expect(content).toContain('submits the form')
  })

  test('aria-roledescription on custom widget — description preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div role="group" aria-roledescription="slide" aria-label="Slide 1 of 5"><p>Introduction to the course objectives and learning outcomes.</p></div>',
    )
    expect(content).toContain('Introduction to the course')
    expect(content).toContain('learning outcomes')
  })

  test('aria-placeholder on editable region — surrounding text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Response area: <span contenteditable="true" aria-placeholder="Type your answer here" aria-multiline="true">Sample answer text goes here.</span></p>',
    )
    expect(content).toContain('Response area')
    expect(content).toContain('Sample answer text')
  })

  test('multiple extended aria attrs on one element — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p role="status" aria-live="polite" aria-atomic="true" aria-relevant="additions text">Form saved successfully at 3:45 PM.</p>',
    )
    expect(content).toContain('Form saved successfully')
  })
})
