import {test, expect} from '../../fixtures/test'

// Canvas syllabi are the most-read documents in a course — instructors spend
// significant time formatting them. They contain weekly schedules, grading
// breakdowns, late-policy tables, contact information, and accessibility
// statements. These realistic full-syllabus patterns verify the RCE handles
// dense mixed-format content without losing text.
test.describe('Canvas syllabus content patterns', () => {
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

  test('grading breakdown table — all categories and weights preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h2>Grading</h2>
      <table>
        <thead><tr><th>Component</th><th>Weight</th><th>Notes</th></tr></thead>
        <tbody>
          <tr><td>Weekly Quizzes (10)</td><td>20%</td><td>Lowest score dropped</td></tr>
          <tr><td>Midterm Exam</td><td>25%</td><td>In-person, closed book</td></tr>
          <tr><td>Research Paper</td><td>30%</td><td>3000-word minimum</td></tr>
          <tr><td>Final Exam</td><td>25%</td><td>Comprehensive</td></tr>
        </tbody>
      </table>`,
    )
    expect(content).toContain('Weekly Quizzes')
    expect(content).toContain('Lowest score dropped')
    expect(content).toContain('Research Paper')
    expect(content).toContain('3000-word minimum')
    expect(content).toContain('Comprehensive')
  })

  test('weekly schedule section — dates and topics preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h2>Course Schedule</h2>
      <ol>
        <li><strong>Week 1 (Jan 13):</strong> Introduction to Sociology — Read Giddens Ch. 1</li>
        <li><strong>Week 2 (Jan 20):</strong> Culture and Society — Read Giddens Ch. 2-3; Quiz 1</li>
        <li><strong>Week 3 (Jan 27):</strong> Social Stratification — Read Giddens Ch. 4; Discussion post due</li>
        <li><strong>Week 4 (Feb 3):</strong> Race and Ethnicity — Guest lecture; Response paper due</li>
      </ol>`,
    )
    expect(content).toContain('Introduction to Sociology')
    expect(content).toContain('Culture and Society')
    expect(content).toContain('Social Stratification')
    expect(content).toContain('Race and Ethnicity')
    expect(content).toContain('Response paper due')
  })

  test('late policy section — policy text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h2>Late Work Policy</h2>
      <p>Assignments submitted after the deadline will be penalized as follows:</p>
      <ul>
        <li>1-24 hours late: 10% deduction</li>
        <li>25-48 hours late: 20% deduction</li>
        <li>More than 48 hours late: not accepted (zero)</li>
      </ul>
      <p>Exceptions may be granted for documented medical emergencies. Contact the instructor <em>before</em> the deadline whenever possible.</p>`,
    )
    expect(content).toContain('10% deduction')
    expect(content).toContain('not accepted')
    expect(content).toContain('documented medical emergencies')
  })

  test('accessibility statement — full paragraph text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h2>Accessibility Statement</h2>
      <p>Students who require academic accommodations due to a disability should contact the Office of Disability Services (ODS) at ods@university.edu or call 555-0100. Accommodations are not retroactive, so please contact ODS early in the semester.</p>
      <p>All course materials are available in accessible formats. If you encounter accessibility barriers, please notify the instructor immediately.</p>`,
    )
    expect(content).toContain('Office of Disability Services')
    expect(content).toContain('Accommodations are not retroactive')
    expect(content).toContain('accessible formats')
  })

  test('instructor contact block — contact info preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h2>Instructor Information</h2>
      <p><strong>Professor:</strong> Dr. Sarah Okonkwo<br>
      <strong>Office:</strong> Liberal Arts Building, Room 214<br>
      <strong>Office Hours:</strong> Monday/Wednesday 10:00 AM - 12:00 PM<br>
      <strong>Email:</strong> sokonkwo@university.edu (response within 24 hours)</p>
      <p>For urgent matters, post in the course discussion board rather than email.</p>`,
    )
    expect(content).toContain('Liberal Arts Building')
    expect(content).toContain('response within 24 hours')
    expect(content).toContain('course discussion board')
  })
})
