import {test, expect} from '../../fixtures/test'

// Canvas announcements are broadcast messages from instructors to the whole
// class. They often contain formatted text, links to course materials, due-date
// reminders, embedded images, and collapsible sections. These realistic
// announcement patterns verify the RCE handles broadcast content correctly.
test.describe('Canvas announcement content patterns', () => {
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

  test('due-date reminder announcement — all details preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<p><strong>Reminder: Research Paper Due Friday at 11:59 PM</strong></p>
      <p>This is a friendly reminder that your research paper is due this Friday. Please submit through Canvas — email submissions will not be accepted.</p>
      <p>Requirements checklist:</p>
      <ul>
        <li>Minimum 2500 words (not including references)</li>
        <li>APA 7th edition formatting</li>
        <li>At least 8 peer-reviewed sources</li>
        <li>Submitted as a .docx or .pdf file</li>
      </ul>
      <p>Contact me at office hours (Tuesday 2-4 PM) with any last-minute questions.</p>`,
    )
    expect(content).toContain('Research Paper Due Friday')
    expect(content).toContain('APA 7th edition')
    expect(content).toContain('peer-reviewed sources')
    expect(content).toContain('office hours')
  })

  test('class cancellation announcement — message text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<p><strong>Class Cancelled Thursday — Async Work Instead</strong></p>
      <p>Due to a departmental conference, class will not meet on Thursday, October 17th. Please complete the following asynchronous activities instead:</p>
      <ol>
        <li>Watch the recorded lecture posted in Module 5 (approximately 45 minutes)</li>
        <li>Complete the reading response in the Discussion board by Friday noon</li>
        <li>Begin working on Problem Set 4 (not due until next Tuesday)</li>
      </ol>`,
    )
    expect(content).toContain('Class Cancelled Thursday')
    expect(content).toContain('asynchronous activities')
    expect(content).toContain('Problem Set 4')
  })

  test('exam logistics announcement — location and time preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<h3>Midterm Exam Information</h3>
      <p><strong>Date:</strong> Wednesday, October 23rd</p>
      <p><strong>Time:</strong> 7:00 PM - 9:00 PM (arrive by 6:45)</p>
      <p><strong>Location:</strong> Science Building, Rooms 101 and 102</p>
      <p><strong>What to bring:</strong></p>
      <ul>
        <li>Student ID</li>
        <li>Two #2 pencils</li>
        <li>A non-graphing scientific calculator</li>
      </ul>
      <p>No notes, phones, or smartwatches permitted. Review sheets are available on the course homepage.</p>`,
    )
    expect(content).toContain('Science Building')
    expect(content).toContain('non-graphing scientific calculator')
    expect(content).toContain('Review sheets')
  })

  test('guest speaker announcement with bio — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      `<p>We have a special guest speaker joining us next Monday!</p>
      <p><strong>Dr. Maria Chen</strong> is a principal researcher at the National Institute of Standards and Technology. Her work focuses on quantum computing applications in cryptography.</p>
      <p>She will discuss her recent paper <em>Post-Quantum Cryptographic Protocols for Financial Systems</em> and take questions from the class.</p>
      <p>Attendance is mandatory and counts toward your participation grade.</p>`,
    )
    expect(content).toContain('National Institute of Standards')
    expect(content).toContain('Post-Quantum Cryptographic Protocols')
    expect(content).toContain('participation grade')
  })
})
