# Local oxlint plugins

Canvas runs [oxlint](https://oxc.rs/docs/guide/usage/linter/) for JS/TS linting.
Local custom rules are loaded as oxlint
[`jsPlugins`](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
from this directory and registered in `oxlint.json`.

## Plugins

### `canvas-copyright` (`canvas-copyright.js`)

Rule: `canvas-copyright/notice` — every `ui/**` source file must start with the
AGPL copyright header from `config/copyright-template.js`. Fixable.

### `canvas-sanitize-url` (`canvas-sanitize-url.js`)

Rule: `canvas-sanitize-url/at-href` — JSX URL sinks must be a string literal or
wrapped in `sanitizeUrl(...)`. Defense-in-depth against XSS via
`javascript:` / `data:` schemes flowing into navigation.

Sinks checked:

| JSX element | Attribute(s) |
|-------------|--------------|
| `<a>`       | `href` |
| `<iframe>`  | `src` |
| `<form>`    | `action` |
| `<button>`  | `formAction` / `formaction` |

Allowed values:

- String literal — `<a href="/foo" />` or `<a href={"/foo"} />`
- Template literal with no interpolation — `<a href={` `/foo` `} />`
- `sanitizeUrl(value)` or `obj.sanitizeUrl(value)`
- `null` / `undefined` (produces no attribute in React)
- `cond ? safe : safe` where both branches are safe

Anything else (identifiers, member access, other calls, template literals with
expressions, logical-OR with a default, etc.) errors. Either wrap with
`sanitizeUrl(...)` from `@canvas/util/sanitizeUrl`, or add
`// oxlint-disable-next-line canvas-sanitize-url/at-href` with a justification
comment for the rare cases where the URL is provably trusted.

InstUI `<Link>` and react-router-dom `<Link>` are not yet covered while their
in-tree usages are audited and wrapped; tracked as a follow-up.

Spread props (`<a {...props} />`) and dynamic JSX element names are not
visible to the rule — these are known gaps of static analysis.

Rule: `canvas-sanitize-url/imperative` — imperative URL sinks must be a string
literal or wrapped in `sanitizeUrl(...)`. Defense-in-depth backstop for the
patterns JSX-only `at-href` can't see.

Sinks checked:

| Pattern | Example |
|---------|---------|
| `window.location = ...`         | `window.location = url` |
| `window.location.href = ...`    | `window.location.href = url` |
| `*.href = ...` / `*.src = ...`  | `el.href = url` |
| `window.open(...)`              | `window.open(url, '_blank')` |
| `*.setAttribute('href'\|'src'\|'action'\|'formaction', ...)` | `el.setAttribute('href', url)` |

Allowed values mirror `at-href`: string literal, template literal with no
interpolation, `sanitizeUrl(...)` call, `null` / `undefined`, conditional with
both branches safe.

Known gaps: computed property access (`el['href'] = url`), dynamic
`setAttribute` attribute names, indirect aliases (`const set = el.setAttribute;
set('href', url)`).

To unwind a flagged site: wrap with `sanitizeUrl(...)`, or — for provably
trusted URLs — add
`// oxlint-disable-next-line canvas-sanitize-url/imperative`
with a justification comment.

Pre-existing sinks are listed in `config/canvas-sanitize-url-baseline.json`
and are silently skipped by the rule. New sinks in any other file fail CI.
Cleanup sweep tracked as a follow-up. When wrapping a site, remove its entry
from the baseline in the same commit — the rule will start flagging any
remaining sinks in that file. The baseline is shrink-only.

### `canvas-xss` (`oxlint-plugins/canvas-xss.js`)

Rule: `canvas-xss/no-unsafe-html` — ports the old `script/xsslint.js` checks
into oxlint. The rule uses the same `xsslint` engine/config, plus the Canvas
extensions for TypeScript casts, optional chaining, URL API receiver
whitelisting, `I18n.t(..., {wrapper|wrappers: ...})`, and
`dangerouslySetInnerHTML={{__html: ...}}`.

Sinks checked:

| Pattern | Example |
|---------|---------|
| XSS-able calls from `xsslint` | `$('#target').html(value)` |
| Htmly string concatenation | `'<span>' + userInput + '</span>'` |
| Htmly template literals | `` `<span>${userInput}</span>` `` |
| Unsanitized React HTML sinks | `<div dangerouslySetInnerHTML={{__html: content}} />` |

Allowed values mirror the old xsslint safe-string configuration: literals,
known safe helpers such as `sanitizeHTML(...)` / `htmlEscape(...)`, Canvas
template/view wrappers, DOM node constructors, and `I18n.t` calls with
`wrapper` / `wrappers`.

To unwind a flagged site: sanitize the value with the shared helper, prove the
value is already safe through one of the configured wrappers, or add
`// oxlint-disable-next-line canvas-xss/no-unsafe-html`
with a justification comment.

## Tests

```sh
node --test config/__tests__/canvas-sanitize-url.test.js
node --test config/__tests__/canvas-xss.test.js
```
