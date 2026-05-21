/*
 * Copyright (C) 2026 - present Instructure, Inc.
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

import {toQueryString} from '../query-string-encoding'

describe('toQueryString', () => {
  describe('primitive values', () => {
    it('serializes a string value', () => {
      expect(toQueryString({key: 'value'})).toBe('key=value')
    })

    it('serializes a numeric value', () => {
      expect(toQueryString({count: 42})).toBe('count=42')
    })

    it('serializes a boolean true value', () => {
      expect(toQueryString({enabled: true})).toBe('enabled=true')
    })

    it('serializes a boolean false value', () => {
      expect(toQueryString({enabled: false})).toBe('enabled=false')
    })

    it('serializes null as the string "null"', () => {
      expect(toQueryString({val: null})).toBe('val=null')
    })

    it('serializes undefined as the string "undefined"', () => {
      expect(toQueryString({val: undefined})).toBe('val=undefined')
    })
  })

  describe('multiple parameters', () => {
    it('serializes multiple keys in insertion order', () => {
      const result = toQueryString({a: '1', b: '2'})
      expect(result).toContain('a=1')
      expect(result).toContain('b=2')
    })
  })

  describe('array values (PHP-style []= encoding)', () => {
    it('serializes an array with PHP-style repeated keys', () => {
      const result = toQueryString({items: ['a', 'b', 'c']})
      // PHP-style: items[]=a&items[]=b&items[]=c
      expect(result).toContain('items%5B%5D=a')
      expect(result).toContain('items%5B%5D=b')
      expect(result).toContain('items%5B%5D=c')
    })

    it('serializes an array of numbers', () => {
      const result = toQueryString({ids: [1, 2, 3]})
      expect(result).toContain('ids%5B%5D=1')
      expect(result).toContain('ids%5B%5D=2')
      expect(result).toContain('ids%5B%5D=3')
    })
  })

  describe('nested object values', () => {
    it('serializes a nested object with bracket notation', () => {
      const result = toQueryString({filter: {type: 'image', size: 'small'}})
      // jQuery/PHP-style: filter[type]=image&filter[size]=small
      expect(result).toContain('filter%5Btype%5D=image')
      expect(result).toContain('filter%5Bsize%5D=small')
    })
  })

  describe('function values', () => {
    it('calls the function and serializes its return value', () => {
      const result = toQueryString({timestamp: () => '12345'})
      expect(result).toBe('timestamp=12345')
    })
  })

  describe('empty inputs', () => {
    it('returns an empty string for an empty params object', () => {
      expect(toQueryString({})).toBe('')
    })
  })

  describe('URL encoding', () => {
    it('percent-encodes special characters in values', () => {
      const result = toQueryString({q: 'hello world'})
      expect(result).toBe('q=hello+world')
    })
  })
})
