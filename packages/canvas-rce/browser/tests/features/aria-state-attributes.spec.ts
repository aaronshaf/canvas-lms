import {test, expect} from '../../fixtures/test'

// ARIA state attributes convey interactive widget state to screen readers:
// aria-current (location in set), aria-selected (chosen option),
// aria-pressed (toggle button), aria-checked (checkbox/radio state).
// These appear in custom course widgets and imported interactive content.
test.describe('ARIA state attributes', () => {
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

  test('aria-current="page" on nav link — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<nav><a href="/courses/1" aria-current="page">Course Home</a> | <a href="/courses/1/assignments">Assignments</a></nav>',
    )
    expect(content).toContain('Course Home')
    expect(content).toContain('Assignments')
  })

  test('aria-current="step" in wizard pattern — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ol><li aria-current="step">Step 1: Introduction</li><li>Step 2: Materials</li><li>Step 3: Procedure</li></ol>',
    )
    expect(content).toContain('Step 1: Introduction')
    expect(content).toContain('Step 3: Procedure')
  })

  test('aria-selected="true" on tab — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div role="tablist"><div role="tab" aria-selected="true">Overview</div><div role="tab" aria-selected="false">Details</div></div>',
    )
    expect(content).toContain('Overview')
    expect(content).toContain('Details')
  })

  test('aria-pressed="true" on toggle — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p role="button" aria-pressed="true">Show Answer (Active)</p>',
    )
    expect(content).toContain('Show Answer')
  })

  test('aria-checked="true" on custom checkbox — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div role="checkbox" aria-checked="true">I agree to the terms</div>',
    )
    expect(content).toContain('I agree to the terms')
  })

  test('aria-disabled="true" on element — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p role="button" aria-disabled="true">Submit (not available yet)</p>',
    )
    expect(content).toContain('Submit')
  })

  test('aria-invalid="true" on input description — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p id="err" aria-live="assertive" role="alert">Error: Field is required.</p>',
    )
    expect(content).toContain('Error: Field is required')
  })
})
