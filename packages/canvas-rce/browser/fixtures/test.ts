import {test as base} from '@playwright/test'
import {RcePage} from './rce-page'

type Fixtures = {
  rcePage: RcePage
}

export const test = base.extend<Fixtures>({
  // oxlint-disable-next-line react/rules-of-hooks -- Playwright's `use` fixture is not a React Hook
  rcePage: async ({page}, use) => {
    await use(new RcePage(page))
  },
})

export {expect} from '@playwright/test'
