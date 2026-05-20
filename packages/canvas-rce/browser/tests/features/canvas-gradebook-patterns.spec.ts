import {test, expect} from '../../fixtures/test'

// Instructors write gradebook comments to give students detailed feedback on
// their work. These comments may include formatted text, code snippets for CS
// courses, mathematical notation, tables for rubric feedback, and links to
// resources. This spec verifies realistic gradebook comment content survives
// the RCE round-trip intact.
test.describe('Canvas gradebook comment content patterns', () => {
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

  test('essay feedback with inline suggestions — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<p>Your thesis statement is strong and clearly articulates your argument. However, the supporting evidence in paragraphs 2 and 3 could be more directly connected to your central claim.</p>
      <p><strong>Strengths:</strong></p>
      <ul>
        <li>Clear, arguable thesis</li>
        <li>Good use of primary sources</li>
        <li>Smooth transitions between paragraphs</li>
      </ul>
      <p><strong>Areas for improvement:</strong></p>
      <ul>
        <li>Paragraph 3 introduces a new argument not connected to the thesis</li>
        <li>The conclusion restates rather than synthesizes</li>
      </ul>`,
    )
    expect(content).toContain('arguable thesis')
    expect(content).toContain('primary sources')
    expect(content).toContain('restates rather than synthesizes')
  })

  test('code feedback with inline corrections — code text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<p>Your implementation is mostly correct. A few notes:</p>
      <p>Instead of:</p>
      <pre><code>for i in range(len(items)):
    print(items[i])</code></pre>
      <p>Prefer the Pythonic:</p>
      <pre><code>for item in items:
    print(item)</code></pre>
      <p>This avoids unnecessary index arithmetic and is more readable.</p>`,
    )
    expect(content).toContain('Pythonic')
    expect(content).toContain('index arithmetic')
    expect(content).toContain('for item in items')
  })

  test('rubric feedback table — all criteria comments preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<table>
        <thead><tr><th>Criterion</th><th>Points</th><th>Feedback</th></tr></thead>
        <tbody>
          <tr><td>Argument clarity</td><td>18/20</td><td>Well-structured but intro paragraph is too broad</td></tr>
          <tr><td>Evidence quality</td><td>15/20</td><td>Relies too heavily on secondary sources</td></tr>
          <tr><td>Citation format</td><td>10/10</td><td>APA style applied correctly throughout</td></tr>
          <tr><td>Grammar</td><td>9/10</td><td>One sentence fragment in paragraph 4</td></tr>
        </tbody>
      </table>`,
    )
    expect(content).toContain('Argument clarity')
    expect(content).toContain('secondary sources')
    expect(content).toContain('APA style applied correctly')
    expect(content).toContain('sentence fragment')
  })

  test('lab report feedback with data reference — numbers preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<p>Your experimental data shows a 12.3% deviation from the theoretical value of 9.81 m/s. This is outside the acceptable error range of 5%.</p>
      <p>Possible sources of error:</p>
      <ol>
        <li>Air resistance was not accounted for in your model</li>
        <li>The timing method introduced systematic error (reaction time ~0.15s)</li>
        <li>Surface friction was assumed negligible</li>
      </ol>
      <p>Please revise your error analysis section and resubmit by next Friday.</p>`,
    )
    expect(content).toContain('12.3%')
    expect(content).toContain('systematic error')
    expect(content).toContain('revise your error analysis')
  })

  test('encouraging comment with resource links — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<p>Excellent work this week! Your discussion post demonstrated a sophisticated understanding of the material.</p>
      <p>To continue developing these ideas, I recommend:</p>
      <ul>
        <li><a href="/courses/1/pages/supplemental-reading">Supplemental reading on Keynesian economics</a></li>
        <li>The Khan Academy series on macroeconomic policy</li>
        <li>Office hours Thursday 3-5 PM for further discussion</li>
      </ul>`,
    )
    expect(content).toContain('sophisticated understanding')
    expect(content).toContain('Keynesian economics')
    expect(content).toContain('macroeconomic policy')
  })
})
