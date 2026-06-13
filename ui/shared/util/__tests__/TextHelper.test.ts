/*
 * Copyright (C) 2019 - present Instructure, Inc.
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

import * as TextHelper from '../TextHelper'
import fc from 'fast-check'

describe('formatMessage', () => {
  test('detects and linkify URLs', () => {
    const testNode = document.createElement('div')
    let link: HTMLAnchorElement
    let str: string
    str = TextHelper.formatMessage(
      'click here: (http://www.instructure.com) to check things out\nnewline',
    )
    testNode.innerHTML = str
    link = testNode.getElementsByTagName('a')[0]
    expect(link.href).toBe('http://www.instructure.com/')

    str = TextHelper.formatMessage('click here: http://www.instructure.com\nnewline')
    testNode.innerHTML = str
    link = testNode.getElementsByTagName('a')[0]
    expect(link.href).toBe('http://www.instructure.com/')

    str = TextHelper.formatMessage('click here: www.instructure.com/a/b?a=1&b=2\nnewline')
    testNode.innerHTML = str
    link = testNode.getElementsByTagName('a')[0]
    expect(link.href).toBe('http://www.instructure.com/a/b?a=1&b=2')

    str = TextHelper.formatMessage('click here: http://www.instructure.com/\nnewline')
    testNode.innerHTML = str
    link = testNode.getElementsByTagName('a')[0]
    expect(link.href).toBe('http://www.instructure.com/')

    str = TextHelper.formatMessage(
      'click here: http://www.instructure.com/courses/1/pages/informação',
    )
    testNode.innerHTML = str
    link = testNode.getElementsByTagName('a')[0]
    expect(link.href).toBe('http://www.instructure.com/courses/1/pages/informa%C3%A7%C3%A3o')

    str = TextHelper.formatMessage('click here: http://www.instructure.com/courses/1/pages#anchor')
    testNode.innerHTML = str
    link = testNode.getElementsByTagName('a')[0]
    expect(link.href).toBe('http://www.instructure.com/courses/1/pages#anchor')

    str = TextHelper.formatMessage(
      "click here: http://www.instructure.com/'onclick=alert(document.cookie)//\nnewline",
    )
    testNode.innerHTML = str
    link = testNode.getElementsByTagName('a')[0]
    expect(link.href).toBe("http://www.instructure.com/'onclick=alert(document.cookie)//")

    // > ~15 chars in parens used to blow up the parser to take forever
    str = TextHelper.formatMessage(
      'click here: http://www.instructure.com/(012345678901234567890123456789012345678901234567890)',
    )
    testNode.innerHTML = str
    link = testNode.getElementsByTagName('a')[0]
    expect(link.href).toBe(
      'http://www.instructure.com/(012345678901234567890123456789012345678901234567890)',
    )
  })

  test('handles having the placeholder in the text body', () => {
    const str = TextHelper.formatMessage(
      `this text has the placeholder ${TextHelper.AUTO_LINKIFY_PLACEHOLDER} embedded right in it.\nhttp://www.instructure.com/\n`,
    )
    expect(str).toBe(
      `this text has the placeholder ${TextHelper.AUTO_LINKIFY_PLACEHOLDER} embedded right in it.<br />\n<a href='http:&#x2F;&#x2F;www.instructure.com&#x2F;'>http:&#x2F;&#x2F;www.instructure.com&#x2F;</a><br />\n`,
    )
  })
})

describe('delimit', () => {
  test('comma-delimits long numbers', () => {
    expect(TextHelper.delimit(123456)).toBe('123,456')
    expect(TextHelper.delimit(9999999)).toBe('9,999,999')
    expect(TextHelper.delimit(-123456)).toBe('-123,456')
    expect(TextHelper.delimit(123456)).toBe('123,456')
  })

  test('comma-delimits integer portion only of decimal numbers', () => {
    expect(TextHelper.delimit(123456.12521)).toBe('123,456.12521')
    expect(TextHelper.delimit(9999999.99999)).toBe('9,999,999.99999')
  })

  test('does not comma-delimit short numbers', () => {
    expect(TextHelper.delimit(123)).toBe('123')
    expect(TextHelper.delimit(0)).toBe('0')
  })

  test('should not error on NaN', () => {
    expect(TextHelper.delimit(0 / 0)).toBe('NaN')
    expect(TextHelper.delimit(5 / 0)).toBe('Infinity')
    expect(TextHelper.delimit(-5 / 0)).toBe('-Infinity')
  })
})

describe('truncateText', () => {
  test('should work in the basic case', () => {
    expect(TextHelper.truncateText('this is longer than 30 characters')).toBe(
      'this is longer than 30...',
    )
  })

  test('should truncate on word boundaries without exceeding max', () => {
    expect(TextHelper.truncateText('zomg zomg zomg', {max: 11})).toBe('zomg...')
    expect(TextHelper.truncateText('zomg zomg zomg', {max: 12})).toBe('zomg zomg...')
    expect(TextHelper.truncateText('zomg zomg zomg', {max: 13})).toBe('zomg zomg...')
    expect(TextHelper.truncateText('zomg      whitespace!   ', {max: 15})).toBe('zomg...')
  })

  test('should not truncate if the string fits', () => {
    expect(TextHelper.truncateText('zomg zomg zomg', {max: 14})).toBe('zomg zomg zomg')
    expect(TextHelper.truncateText('zomg      whitespace!   ', {max: 16})).toBe('zomg whitespace!')
  })

  test('should break up the first word if it exceeds max', () => {
    expect(TextHelper.truncateText('zomgzomg', {max: 6})).toBe('zom...')
    expect(TextHelper.truncateText('zomgzomg', {max: 7})).toBe('zomg...')
  })
})

describe('containsHtmlTags', () => {
  test('should return true if html tags present', () => {
    expect(TextHelper.containsHtmlTags('<p>Html detected</p>')).toBeTruthy()
  })

  test('should return false if not present', () => {
    expect(TextHelper.containsHtmlTags('No html present')).toBeFalsy()
  })
})

describe('stripHtmlTags', () => {
  it('strips tags and returns inner text', () => {
    expect(TextHelper.stripHtmlTags('<p>Test <strong>Content</strong></p>')).toBe('Test Content')
  })

  it('returns empty string for empty input', () => {
    expect(TextHelper.stripHtmlTags('')).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(TextHelper.stripHtmlTags()).toBe('')
  })

  it('returns empty string for null (JS callers)', () => {
    expect(TextHelper.stripHtmlTags(null as unknown as string)).toBe('')
  })

  it('returns plain text unchanged', () => {
    expect(TextHelper.stripHtmlTags('Hello world')).toBe('Hello world')
  })

  it('strips tags that have attributes', () => {
    expect(TextHelper.stripHtmlTags('<a href="http://example.com" class="foo">link text</a>')).toBe(
      'link text',
    )
  })

  it('strips self-closing tags', () => {
    expect(TextHelper.stripHtmlTags('before<br/>after')).toBe('beforeafter')
    expect(TextHelper.stripHtmlTags('<img src="x.png" alt="pic"/>')).toBe('')
  })

  it('strips deeply nested tags', () => {
    expect(TextHelper.stripHtmlTags('<div><p><span>deep</span></p></div>')).toBe('deep')
  })

  it('strips tags with event handler attributes', () => {
    expect(TextHelper.stripHtmlTags('<div onclick="evil()">safe text</div>')).toBe('safe text')
  })

  it('strips script and style tags, leaving their text content', () => {
    expect(TextHelper.stripHtmlTags('<script>alert(1)</script>')).toBe('alert(1)')
    expect(TextHelper.stripHtmlTags('<style>.foo{color:red}</style>')).toBe('.foo{color:red}')
  })

  it('returns empty string for tag-only input', () => {
    expect(TextHelper.stripHtmlTags('<br/>')).toBe('')
    expect(TextHelper.stripHtmlTags('<p></p>')).toBe('')
    expect(TextHelper.stripHtmlTags('<>')).toBe('')
  })

  it('decodes named HTML entities', () => {
    expect(TextHelper.stripHtmlTags('&quot;')).toBe('"')
    expect(TextHelper.stripHtmlTags('&amp;')).toBe('&')
    expect(TextHelper.stripHtmlTags('&lt;')).toBe('<')
    expect(TextHelper.stripHtmlTags('&gt;')).toBe('>')
  })

  it('decodes numeric and hex entities', () => {
    expect(TextHelper.stripHtmlTags('it&#39;s')).toBe("it's")
    expect(TextHelper.stripHtmlTags('it&#x27;s')).toBe("it's")
    expect(TextHelper.stripHtmlTags('&#65;')).toBe('A')
  })

  it('decodes entities mixed with tags', () => {
    expect(TextHelper.stripHtmlTags('<b>Hello &amp; world</b>')).toBe('Hello & world')
    expect(TextHelper.stripHtmlTags('Hello &amp; welcome to &lt;Canvas&gt;!')).toBe(
      'Hello & welcome to <Canvas>!',
    )
  })

  it('decodes international character entities', () => {
    expect(TextHelper.stripHtmlTags('Caf&eacute;')).toBe('Café')
    expect(TextHelper.stripHtmlTags('&copy; 2025')).toBe('© 2025')
    expect(TextHelper.stripHtmlTags('Fran&ccedil;ois')).toBe('François')
  })

  it('preserves whitespace within text', () => {
    expect(TextHelper.stripHtmlTags('<p>  spaced  </p>')).toBe('  spaced  ')
  })

  it('strips tags containing newlines and tabs', () => {
    expect(TextHelper.stripHtmlTags('<img\nsrc=x\nonerror=alert(1)>')).toBe('')
    expect(TextHelper.stripHtmlTags('<img\tsrc=x>')).toBe('')
  })

  // The regex /<[^>]*>/g stops at the first literal `>` it finds.
  // A `>` inside a quoted attribute causes a partial match, leaking
  // the remainder of the attribute as plain text. Callers that need
  // guaranteed-clean output for HTML contexts must use sanitizeHTML.
  it('partially strips tags where `>` appears inside a quoted attribute', () => {
    expect(TextHelper.stripHtmlTags('<div title="a>b">text</div>')).toBe('b">text')
  })

  // An unclosed tag (no `>`) is not matched and passes through as-is.
  it('does not strip unclosed tags', () => {
    expect(TextHelper.stripHtmlTags('<script')).toBe('<script')
    expect(TextHelper.stripHtmlTags('<img src=x onerror=alert(1)')).toBe(
      '<img src=x onerror=alert(1)',
    )
  })

  // Tags are stripped FIRST, then entities decoded. Entity-encoded angle
  // brackets survive the regex pass and decode into raw `<`/`>` characters.
  // The output is plain text — safe as textContent but NOT safe for innerHTML.
  it('decodes entity-encoded angle brackets after stripping — output is plain text with literal <>', () => {
    expect(TextHelper.stripHtmlTags('&lt;script&gt;alert(1)&lt;/script&gt;')).toBe(
      '<script>alert(1)</script>',
    )
    expect(TextHelper.stripHtmlTags('&#60;img src=x&#62;')).toBe('<img src=x>')
    expect(TextHelper.stripHtmlTags('&#x3C;b&#x3E;bold&#x3C;/b&#x3E;')).toBe('<b>bold</b>')
  })

  // Double-encoded entities are only decoded one level — output stays encoded,
  // which is safe for HTML contexts.
  it('only decodes one layer of entity encoding', () => {
    expect(TextHelper.stripHtmlTags('&amp;lt;script&amp;gt;')).toBe('&lt;script&gt;')
  })
})

describe('newlinesToBrTags', () => {
  it('returns empty string unchanged', () => {
    expect(TextHelper.newlinesToBrTags('')).toBe('')
  })

  it('returns plain text unchanged', () => {
    expect(TextHelper.newlinesToBrTags('hello world')).toBe('hello world')
  })

  it('converts \\n to <br />', () => {
    expect(TextHelper.newlinesToBrTags('line1\nline2')).toBe('line1<br />line2')
  })

  it('normalizes <br/> to <br />', () => {
    expect(TextHelper.newlinesToBrTags('line1<br/>line2')).toBe('line1<br />line2')
  })

  it('normalizes <br> to <br />', () => {
    expect(TextHelper.newlinesToBrTags('line1<br>line2')).toBe('line1<br />line2')
  })

  it('normalizes <BR /> (case-insensitive) to <br />', () => {
    expect(TextHelper.newlinesToBrTags('line1<BR />line2')).toBe('line1<br />line2')
  })

  it('handles mixed \\n and <br/>', () => {
    expect(TextHelper.newlinesToBrTags('a<br/>b\nc')).toBe('a<br />b<br />c')
  })
})

describe('brTagsToNewlines', () => {
  it('returns empty string unchanged', () => {
    expect(TextHelper.brTagsToNewlines('')).toBe('')
  })

  it('returns plain text unchanged', () => {
    expect(TextHelper.brTagsToNewlines('hello world')).toBe('hello world')
  })

  it('converts <br/> to \\n', () => {
    expect(TextHelper.brTagsToNewlines('line1<br/>line2')).toBe('line1\nline2')
  })

  it('converts <br> to \\n', () => {
    expect(TextHelper.brTagsToNewlines('line1<br>line2')).toBe('line1\nline2')
  })

  it('converts <br /> (with space) to \\n', () => {
    expect(TextHelper.brTagsToNewlines('line1<br />line2')).toBe('line1\nline2')
  })

  it('converts <BR/> (case-insensitive) to \\n', () => {
    expect(TextHelper.brTagsToNewlines('line1<BR/>line2')).toBe('line1\nline2')
  })

  it('preserves <word>-shaped plain-text tokens (does NOT strip non-br tags)', () => {
    expect(TextHelper.brTagsToNewlines('Sign with <your initials>')).toBe(
      'Sign with <your initials>',
    )
    expect(TextHelper.brTagsToNewlines('Identify <key concepts>')).toBe('Identify <key concepts>')
  })

  it('preserves a bare < followed by a space', () => {
    expect(TextHelper.brTagsToNewlines('5 < 10 students')).toBe('5 < 10 students')
  })

  it('handles multiple <br/> tags', () => {
    expect(TextHelper.brTagsToNewlines('a<br/>b<br/>c')).toBe('a\nb\nc')
  })
})

describe('htmlDecode', () => {
  test('should return the same result when decoding twice', () => {
    fc.assert(
      fc.property(fc.string(), input => {
        const once = TextHelper.htmlDecode(input)
        const twice = TextHelper.htmlDecode(once)
        expect(once).toBe(twice)
      }),
    )
  })

  test.each([
    ['empty string', ''],
    ['undefined', undefined],
    ['null', null],
  ])('should return empty string for %s input', (_, input) => {
    expect(TextHelper.htmlDecode(input)).toBe('')
  })

  test.each([
    ['&amp;', '&', 'ampersand'],
    ['&lt;', '<', 'less than'],
    ['&gt;', '>', 'greater than'],
    ['&quot;', '"', 'quotation mark'],
    ['&#x27;', "'", 'apostrophe'],
  ])('decodes %s (%s)', (input, expected) => {
    expect(TextHelper.htmlDecode(input)).toBe(expected)
  })

  test('decodes numeric entities', () => {
    expect(TextHelper.htmlDecode('&#65;')).toBe('A')
    expect(TextHelper.htmlDecode('&#8364;')).toBe('€')
  })

  test('strips simple HTML tags', () => {
    expect(TextHelper.htmlDecode('<p>Hello</p>')).toBe('Hello')
    expect(TextHelper.htmlDecode('<div><strong>Bold</strong> text</div>')).toBe('Bold text')
  })

  test('handles self-closing tags', () => {
    expect(TextHelper.htmlDecode('Line 1<br/>Line 2')).toBe('Line 1Line 2')
  })

  test('handles simple mixed tags and entities', () => {
    expect(TextHelper.htmlDecode('<p>Hello &amp; goodbye</p>')).toBe('Hello & goodbye')
  })

  test('handles complex mixed tags and entities', () => {
    expect(TextHelper.htmlDecode('<b>User: &quot;John&quot; &lt;john@test.com&gt;</b>')).toBe(
      'User: "John" <john@test.com>',
    )
  })

  test.each([
    ['Caf&eacute;', 'Café', 'accented e'],
    ['&copy; 2023', '© 2023', 'copyright symbol'],
    ['&nbsp;', '\u00A0', 'non-breaking space'],
    ['Smith &amp; Johnson', 'Smith & Johnson', 'ampersand in name'],
  ])('decodes %s (%s)', (input, expected) => {
    expect(TextHelper.htmlDecode(input)).toBe(expected)
  })

  test.each([
    ['Jos&eacute; Mart&iacute;nez', 'José Martínez', 'Spanish accents'],
    ['Fran&ccedil;ois Dubois', 'François Dubois', 'French cedilla'],
    ['O&apos;Connor', "O'Connor", 'Irish apostrophe'],
    ['M&uuml;ller', 'Müller', 'German umlaut'],
    ['&Aring;se Larsson', 'Åse Larsson', 'Scandinavian ring'],
    ['&Ntilde;u&ntilde;ez', 'Ñuñez', 'Spanish tildes'],
  ])('decodes international name %s (%s)', (input, expected) => {
    expect(TextHelper.htmlDecode(input)).toBe(expected)
  })

  test('handles emails with encoded characters', () => {
    expect(TextHelper.htmlDecode('some&apos;email@gmail.com')).toBe("some'email@gmail.com")
  })

  test('does not transform unencoded emails', () => {
    expect(TextHelper.htmlDecode("user+tes't@example.com")).toBe("user+tes't@example.com")
  })

  test('handles whitespace-only input', () => {
    expect(TextHelper.htmlDecode('   ')).toBe('   ')
  })

  test('decodes entities with trailing whitespace', () => {
    expect(TextHelper.htmlDecode('&lt;Test&gt;  ')).toBe('<Test>  ')
  })

  test('decodes entities with leading whitespace', () => {
    expect(TextHelper.htmlDecode('  A&amp;Test')).toBe('  A&Test')
  })

  test('handles malformed HTML', () => {
    expect(TextHelper.htmlDecode('<div>Unclosed')).toBe('Unclosed')
  })

  test('returns unchanged text with no HTML entities or tags', () => {
    const input = 'Normal text without HTML'
    expect(TextHelper.htmlDecode(input)).toBe(input)
  })
})
