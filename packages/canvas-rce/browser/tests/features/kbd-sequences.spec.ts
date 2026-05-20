import {test, expect} from '../../fixtures/test'

// <kbd> marks keyboard input. In course content for computing courses,
// instructors document keyboard shortcuts, hotkeys, and command sequences.
// <kbd> inside <kbd> represents a key combination (Ctrl+S), while <kbd>
// inside <samp> represents user input that appears in terminal output.
test.describe('<kbd> keyboard input sequences', () => {
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

  test('single <kbd> key — text preserved', async ({page}) => {
    const content = await setAndGet(page, '<p>Press <kbd>Enter</kbd> to submit.</p>')
    expect(content).toContain('Enter')
    expect(content).toContain('to submit')
  })

  test('<kbd> inside <kbd> for key combo — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Save with <kbd><kbd>Ctrl</kbd>+<kbd>S</kbd></kbd>.</p>',
    )
    expect(content).toContain('Ctrl')
    expect(content).toContain('Save with')
  })

  test('multi-step keyboard sequence — all steps preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>To open terminal: <kbd><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>T</kbd></kbd></p>',
    )
    expect(content).toContain('Ctrl')
    expect(content).toContain('Alt')
    expect(content).toContain('open terminal')
  })

  test('<samp> with <kbd> inside — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>When prompted, type: <samp>Enter password: <kbd>hunter2</kbd></samp></p>',
    )
    expect(content).toContain('Enter password')
    expect(content).toContain('hunter2')
  })

  test('keyboard shortcut reference table with <kbd> — all cells preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<table><tr><th>Action</th><th>Shortcut</th></tr><tr><td>Copy</td><td><kbd>Ctrl</kbd>+<kbd>C</kbd></td></tr><tr><td>Paste</td><td><kbd>Ctrl</kbd>+<kbd>V</kbd></td></tr><tr><td>Undo</td><td><kbd>Ctrl</kbd>+<kbd>Z</kbd></td></tr></table>',
    )
    expect(content).toContain('Copy')
    expect(content).toContain('Paste')
    expect(content).toContain('Undo')
  })

  test('<kbd> with function keys — text preserved', async ({page}) => {
    const content = await setAndGet(
      page,
      '<p>Refresh: <kbd>F5</kbd>. Full screen: <kbd>F11</kbd>. Help: <kbd>F1</kbd>.</p>',
    )
    expect(content).toContain('F5')
    expect(content).toContain('F11')
    expect(content).toContain('F1')
  })
})
