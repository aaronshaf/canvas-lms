import {test, expect} from '../../fixtures/test'

// Canvas course pages use h1-h6 for document outline and screen reader navigation.
// TinyMCE typically restricts to h2-h4 via toolbar, but content can include
// all heading levels via setContent. All levels must survive serialization.
test.describe('heading hierarchy h1 through h6', () => {
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

  test('h1 element is preserved', async ({page}) => {
    const content = await setAndGet(page, '<h1>Top Level Title</h1>')
    expect(content).toContain('Top Level Title')
    expect(content).toMatch(/<h1/)
  })

  test('h2 element is preserved', async ({page}) => {
    const content = await setAndGet(page, '<h2>Chapter Title</h2>')
    expect(content).toContain('Chapter Title')
    expect(content).toMatch(/<h2/)
  })

  test('h3 element is preserved', async ({page}) => {
    const content = await setAndGet(page, '<h3>Section Heading</h3>')
    expect(content).toContain('Section Heading')
    expect(content).toMatch(/<h3/)
  })

  test('h4 element is preserved', async ({page}) => {
    const content = await setAndGet(page, '<h4>Subsection</h4>')
    expect(content).toContain('Subsection')
    expect(content).toMatch(/<h4/)
  })

  test('h5 element is preserved', async ({page}) => {
    const content = await setAndGet(page, '<h5>Minor Heading</h5>')
    expect(content).toContain('Minor Heading')
    expect(content).toMatch(/<h5/)
  })

  test('h6 element is preserved', async ({page}) => {
    const content = await setAndGet(page, '<h6>Fine Print</h6>')
    expect(content).toContain('Fine Print')
    expect(content).toMatch(/<h6/)
  })

  test('complete outline with h1-h6 preserves all levels', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h1>Course Title</h1>
       <h2>Unit 1</h2>
       <h3>Lesson 1.1</h3>
       <h4>Topic A</h4>
       <h5>Detail i</h5>
       <h6>Note</h6>`,
    )
    expect(content).toContain('Course Title')
    expect(content).toContain('Unit 1')
    expect(content).toContain('Lesson 1.1')
    expect(content).toContain('Topic A')
    expect(content).toContain('Detail i')
    expect(content).toContain('Note')
    expect(content).toMatch(/<h1/)
    expect(content).toMatch(/<h2/)
    expect(content).toMatch(/<h3/)
    expect(content).toMatch(/<h4/)
    expect(content).toMatch(/<h5/)
    expect(content).toMatch(/<h6/)
  })

  test('heading levels are not promoted or demoted (h3 stays h3)', async ({page}) => {
    const content = await setAndGet(page, '<h3>Must remain h3</h3>')
    expect(content).toMatch(/<h3[^>]*>Must remain h3<\/h3>/)
    expect(content).not.toMatch(/<h2[^>]*>Must remain h3/)
    expect(content).not.toMatch(/<h4[^>]*>Must remain h3/)
  })

  test('heading with mixed content (text + inline elements)', async ({page}) => {
    const content = await setAndGet(page, '<h2>Introduction to <em>Machine Learning</em></h2>')
    expect(content).toContain('Introduction to')
    expect(content).toContain('Machine Learning')
    expect(content).toMatch(/<em>Machine Learning<\/em>/)
    expect(content).toMatch(/<h2/)
  })

  test('empty heading tag is handled without crash', async ({page}) => {
    const content = await setAndGet(page, '<h2></h2><p>After empty heading</p>')
    expect(content).toContain('After empty heading')
    expect(typeof content).toBe('string')
  })
})
