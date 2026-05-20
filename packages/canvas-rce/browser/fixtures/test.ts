import {test as base} from '@playwright/test'
import {RcePage} from './rce-page'

type Fixtures = {
  rcePage: RcePage
}

export const test = base.extend<Fixtures>({
  rcePage: async ({page}, use) => {
    await use(new RcePage(page))
  },
})

export {expect} from '@playwright/test'
