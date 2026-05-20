import {type Page, type FrameLocator, type Locator} from '@playwright/test'

export class RcePage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  contentFrame(): FrameLocator {
    return this.page.frameLocator('iframe.tox-edit-area__iframe')
  }

  toolbar(): Locator {
    return this.page.locator('.tox-toolbar__primary')
  }

  statusBar(): Locator {
    return this.page.locator('[data-testid="RCEStatusBar"]')
  }

  async waitForEditor(): Promise<void> {
    await this.page.locator('.tox-tinymce').waitFor({state: 'visible', timeout: 60_000})
    await this.contentFrame().locator('body').waitFor({state: 'visible', timeout: 60_000})
  }

  async typeContent(text: string): Promise<void> {
    await this.contentFrame().locator('body').click()
    await this.page.keyboard.type(text)
  }

  async getContent(): Promise<string> {
    return this.page.evaluate(() => {
      // @ts-expect-error -- TinyMCE global
      return window.tinymce?.activeEditor?.getContent() ?? ''
    })
  }

  async setContent(html: string): Promise<void> {
    await this.page.evaluate(content => {
      // @ts-expect-error -- TinyMCE global
      window.tinymce?.activeEditor?.setContent(content)
    }, html)
  }

  toolbarButton(label: string): Locator {
    return this.toolbar().getByRole('button', {name: label})
  }
}
