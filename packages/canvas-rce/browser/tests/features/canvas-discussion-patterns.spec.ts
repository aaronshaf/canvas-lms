import {test, expect} from '../../fixtures/test'

// Canvas discussion posts combine formatted text, embedded images, links to
// course files, and quoted replies. Instructors write prompts and students
// paste rich content. These realistic full-post patterns verify the complete
// formatting pipeline works end-to-end for the second most-used Canvas editor.
test.describe('Canvas discussion post content patterns', () => {
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

  test('discussion prompt with questions and links — all text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h3>Week 3 Discussion: Ethical Implications of AI</h3>
      <p>Read the article <a href="/courses/1/pages/ai-ethics-reading">AI Ethics in Education</a> before responding.</p>
      <p>Please address <strong>all three</strong> of the following questions in your initial post:</p>
      <ol>
        <li>How might AI tools affect academic integrity in higher education?</li>
        <li>What safeguards should institutions implement?</li>
        <li>How do you personally plan to use AI tools ethically in your coursework?</li>
      </ol>
      <p>Your response should be <em>at least 250 words</em> and cite at least two sources.</p>`,
    )
    expect(content).toContain('Ethical Implications of AI')
    expect(content).toContain('AI Ethics in Education')
    expect(content).toContain('academic integrity')
    expect(content).toContain('at least 250 words')
  })

  test('student reply quoting original post — blockquote and response preserved', async ({
    page,
  }) => {
    const content = await setAndGet(
      page,
      `<blockquote>
        <p><strong>Original post:</strong> How might AI tools affect academic integrity?</p>
      </blockquote>
      <p>Building on the original question, I think the key concern is not the tools themselves but how students choose to use them. When I used ChatGPT for brainstorming my last essay, I was transparent about it in my methods section.</p>
      <p>According to <em>Johnson (2024)</em>, "the responsibility for ethical AI use rests with both institutions and individual learners."</p>`,
    )
    expect(content).toContain('academic integrity')
    expect(content).toContain('transparent about it')
    expect(content).toContain('responsibility for ethical AI use')
  })

  test('discussion post with embedded image and text — all preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<p>I found this diagram in the textbook very helpful:</p>
      <p><img src="/courses/1/files/88/preview" alt="Software development lifecycle diagram" width="600"></p>
      <p>As you can see from the diagram, the testing phase often takes as long as the development phase itself. This surprised me because I assumed most time was spent writing code.</p>`,
    )
    expect(content).toContain('Software development lifecycle diagram')
    expect(content).toContain('testing phase often takes')
  })
})
