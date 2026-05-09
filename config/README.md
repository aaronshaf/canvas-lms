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

## Tests

```sh
node --test config/__tests__/canvas-sanitize-url.test.js
```
