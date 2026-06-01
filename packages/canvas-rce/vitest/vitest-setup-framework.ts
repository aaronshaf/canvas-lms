/*
 * Copyright (C) 2025 - present Instructure, Inc.
 *
 * This file is part of Canvas.
 *
 * Canvas is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import '@testing-library/jest-dom'
import {StyleSheetTestUtils} from 'aphrodite'
import '@instructure/ui-themes'

StyleSheetTestUtils.suppressStyleInjection()

// Throw on unhandled console.error / console.warn to keep test logs clean.
// Add patterns to the ignore lists below when the warning is expected.
/* eslint-disable no-console */
const globalError = global.console.error
const ignoredErrors = [
  /An update to %s inside a test was not wrapped in act/,
  /Can't perform a React state update on an unmounted component/,
  /The prop `sortBy.order` is marked as required in `Images`/,
  /Invalid prop `documents.searchString` of type `string` supplied to `DocumentsPanel`/,
  /The prop `sortBy.order` is marked as required in `DocumentsPanel`/,
  /The prop `sortBy.order` is marked as required in `SavedIconMakerList`/,
  /Invalid prop `images.searchString` of type `string` supplied to `SavedIconMakerList`/,
  /Invalid prop `media.searchString` of type `string` supplied to `MediaPanel`/,
  /Can't call %s on a component that is not yet mounted./,
  /The prop `videoOptions.naturalHeight` is marked as required in `VideoOptionsTray`/,
  /The prop `sortBy.order` is marked as required in `MediaPanel`/,
  /Invalid prop `images.searchString` of type `string` supplied to `Images`/,
  /failed updating video captions/,
  /You seem to have overlapping act\(\) calls/,
  /A theme registry has already been initialized/,
  /Warning: Failed prop type: Invalid prop `color` of value `secondary` supplied to `CondensedButton`, expected one of \["primary","primary-inverse"\]./,
  /ReactDOM.render is no longer supported in React 18/,
  /Warning: Failed %s type: %s%s/,
  /Warning: %s: Support for defaultProps will be removed from function components in a future major release. Use JavaScript default parameters instead.%s/,
  /Warning: `ReactDOMTestUtils.act` is deprecated in favor of `React.act`. Import `act` from `react` instead of `react-dom\/test-utils`. See https:\/\/react.dev\/warnings\/react-dom-test-utils for more info./,
  /Warning: `ReactDOMTestUtils.act` is deprecated in favor of `React.act`. Import `act` from `react` instead of `react-dom\/test-utils`./,
  /Warning: unmountComponentAtNode is deprecated and will be removed in the next major release. Switch to the createRoot API. Learn more: https:\/\/reactjs.org\/link\/switch-to-createroot/,
  /Warning: findDOMNode is deprecated and will be removed in the next major release. Instead, add a ref directly to the element you want to reference. Learn more about using refs safely here: https:\/\/reactjs.org\/link\/strict-mode-find-node/,
  /Warning: %s uses the legacy childContextTypes API which is no longer supported and will be removed in the next major release. Use React.createContext\(\) instead/,
  /Warning: %s uses the legacy contextTypes API which is no longer supported and will be removed in the next major release. Use React.createContext\(\) with static contextType instead./,
  /Warning: Unknown event handler property `%s`. It will be ignored.%s/,
  /`ref` is not a prop\. Trying to access it will result in `undefined` being returned/,
  /A suspended resource finished loading inside a test/,
  /No outer iframe found/,
  /Cannot access outer iframe content \(cross-origin\)/,
  /EnvironmentTeardownError/,
  // React logs this generic wrapper via console.error immediately after an
  // uncaught render error (e.g. an EnvironmentTeardownError surfacing inside a
  // lazy/Suspense subtree). The wrapper carries no error-specific marker, so it
  // can't be matched on its own — but the underlying error is always logged in a
  // separate console.error first, which still throws here unless it is itself
  // ignorable. Suppressing only this redundant follow-up therefore never hides a
  // real error; it just stops teardown noise from being re-raised as a fresh
  // unhandled exception.
  /The above error occurred in (one of your|the)/,
]

const globalWarn = global.console.warn
const ignoredWarnings = [
  /Store interaction failed/,
  /Found bad LTI MRU data/,
  /Cannot save LTI MRU list/,
  /clicked sidebar (link|image) without a focused editor/,
  /Translation for/,
  /Exactly one focusable child is required/,
  /is deprecated and will be removed/,
]

global.console = {
  ...console,
  error: (error: unknown, ...args: unknown[]) => {
    const msg = String(error)
    if (ignoredErrors.some(regex => regex.test(msg))) return
    globalError(error, ...args)
    throw new Error(
      `Looks like you have an unhandled error. Keep our test logs clean by handling or filtering it. ${msg}`,
    )
  },
  warn: (warning: unknown, ...args: unknown[]) => {
    const msg = String(warning)
    if (ignoredWarnings.some(regex => regex.test(msg))) return
    globalWarn(warning, ...args)
    throw new Error(
      `Looks like you have an unhandled warning. Keep our test logs clean by handling or filtering it. ${msg}`,
    )
  },
}
/* eslint-enable no-console */
