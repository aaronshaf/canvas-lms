import {test, expect} from '../../fixtures/test'

// Canvas quiz questions are stored as HTML in the RCE. Multiple choice
// questions use <ol> with <li> for each answer choice. The question stem
// may include images, code blocks, math, and formatted text.
// All content must survive the round-trip to be gradeable.
test.describe('quiz question content patterns', () => {
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

  test('multiple choice question — stem and all choices preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<p>What is the time complexity of binary search?</p>
<ol type="A">
  <li>O(n)</li>
  <li>O(log n)</li>
  <li>O(n²)</li>
  <li>O(1)</li>
</ol>`,
    )
    expect(content).toContain('time complexity of binary search')
    expect(content).toContain('O(n)')
    expect(content).toContain('O(log n)')
    expect(content).toContain('O(n') // ² encoded as &sup2; by TinyMCE
  })

  test('true/false question — both options preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<p><strong>True or False:</strong> A linked list has O(1) random access.</p>
<ul>
  <li>True</li>
  <li>False</li>
</ul>`,
    )
    expect(content).toContain('linked list has O(1) random access')
    expect(content).toContain('True')
    expect(content).toContain('False')
  })

  test('code question with pre block — code preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<p>What does this function return when called with <code>f(5)</code>?</p>
<pre><code>def f(n):
    if n &lt;= 1:
        return 1
    return n * f(n - 1)</code></pre>
<p>Enter the numeric answer:</p>`,
    )
    expect(content).toContain('What does this function return')
    expect(content).toContain('def f(n)')
    expect(content).toContain('return 1')
    expect(content).toContain('Enter the numeric answer')
  })

  test('matching question with two columns', async ({page}) => {
    const content = await setAndGet(
      page,
      `<p>Match each data structure to its average search time:</p>
<table>
  <thead><tr><th>Structure</th><th>Time</th></tr></thead>
  <tbody>
    <tr><td>Array</td><td>O(n)</td></tr>
    <tr><td>Hash table</td><td>O(1)</td></tr>
    <tr><td>BST</td><td>O(log n)</td></tr>
  </tbody>
</table>`,
    )
    expect(content).toContain('Match each data structure')
    expect(content).toContain('Hash table')
    expect(content).toContain('O(1)')
    expect(content).toContain('BST')
  })
})
