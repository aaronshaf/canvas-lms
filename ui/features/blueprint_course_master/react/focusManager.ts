/*
 * Copyright (C) 2017 - present Instructure, Inc.
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

interface FocusableElement {
  focus: () => void
}

// manages focus for a set of react components
// useful in a11y situations where managing focus from deleting or otherwise
// changing DOM structure
export default class FocusManager {
  private items: (FocusableElement | null)[] = []
  private before: FocusableElement | null = null
  private after: FocusableElement | null = null

  reset() {
    this.items = []
  }

  // allocate a new item to be managed by the FocusManager
  // returns {
  //  index: the position of the item in the list of items
  //  ref: a react ref function to be passed to the component to register it with
  //  the FocusManager
  // }
  allocateNext() {
    const index = this.items.length
    this.items.push(null)
    return {index, ref: this.registerItemRef(index)}
  }

  // register a node at a specified index
  registerItem(c: FocusableElement | null, index: number) {
    this.items[index] = c
  }

  // returns a react ref function that registers a component at the given index
  // inside the items array of the FocusManager
  registerItemRef = (index: number) => (c: FocusableElement | null) => this.registerItem(c, index)

  // register the node to go to if we try to go back from our first item
  registerBeforeRef = (c: FocusableElement | null) => {
    this.before = c
  }

  // register the node to go to if we try to go forward from our last item
  registerAfterRef = (c: FocusableElement | null) => {
    this.after = c
  }

  // based on the given index, move focus to the item before it in the items list
  movePrev(index: number) {
    if (index - 1 < 0) {
      this.moveBefore()
    } else {
      this.focus(this.items[index - 1])
    }
  }

  // based on the given index, move focus to the item after it in the items list
  moveNext(index: number) {
    if (index + 1 >= this.items.length) {
      this.moveAfter()
    } else {
      this.focus(this.items[index + 1])
    }
  }

  // move focus to the node we designated to come before our list of items
  moveBefore() {
    this.focus(this.before)
  }

  // move focus to the node we designated to come after our list of items
  moveAfter() {
    this.focus(this.after)
  }

  // moves focus to the node passed on, or show a console warning
  focus(thing: FocusableElement | null) {
    if (thing && thing.focus) {
      thing.focus()
    } else {
      console.warn('FocusManager could not handle focus change')
    }
  }
}
