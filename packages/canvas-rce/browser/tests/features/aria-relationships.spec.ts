import {test, expect} from '../../fixtures/test'

// ARIA relationship attributes (aria-describedby, aria-controls, aria-labelledby,
// aria-expanded, aria-owns) link elements by id for screen readers.
// Course content with interactive widgets (tabs, accordions, tooltips) uses these.
// They must survive round-trips so accessibility relationships aren't broken.
test.describe('ARIA relationship attributes', () => {
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

  test('aria-describedby linking description — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p id="field-desc">Enter your student ID number (8 digits).</p><p aria-describedby="field-desc">Student ID field</p>',
    )
    expect(content).toContain('Enter your student ID')
    expect(content).toContain('Student ID field')
  })

  test('aria-labelledby cross-reference — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<h2 id="section-label">Module 3: Data Structures</h2><section aria-labelledby="section-label"><p>Section content.</p></section>',
    )
    expect(content).toContain('Module 3: Data Structures')
    expect(content).toContain('Section content')
  })

  test('aria-controls on button pattern — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p aria-controls="panel1" aria-expanded="false">Toggle Answer</p><div id="panel1"><p>The hidden answer text.</p></div>',
    )
    expect(content).toContain('Toggle Answer')
    expect(content).toContain('hidden answer text')
  })

  test('aria-expanded="true" — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<div role="button" aria-expanded="true" aria-controls="details">Show Less</div><div id="details"><p>Expanded details content.</p></div>',
    )
    expect(content).toContain('Show Less')
    expect(content).toContain('Expanded details content')
  })

  test('aria-owns attribute — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<ul aria-owns="extra-item"><li>Item One</li><li>Item Two</li></ul><li id="extra-item">Virtual item</li>',
    )
    expect(content).toContain('Item One')
    expect(content).toContain('Item Two')
  })

  test('aria-flowto chaining — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p id="step1" aria-flowto="step2">Step 1: Gather materials.</p><p id="step2">Step 2: Begin assembly.</p>',
    )
    expect(content).toContain('Step 1: Gather materials')
    expect(content).toContain('Step 2: Begin assembly')
  })
})
