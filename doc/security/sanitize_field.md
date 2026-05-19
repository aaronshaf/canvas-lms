# sanitize_field

`sanitize_field` scrubs user-authored HTML before it is persisted.
It is a class macro added to an ActiveRecord model. It declares
that a column must be passed through `Sanitize.clean(...)`
with a given config before each save.

## Basic usage

```ruby
class WikiPage < ActiveRecord::Base
  sanitize_field :body, CanvasSanitize::SANITIZE
end
```

Every save runs `body` through the `CanvasSanitize::SANITIZE` allowlist.
No `include CanvasSanitize` is needed — the initializer mixes the macro
into every ActiveRecord model.

Sources:
- `gems/canvas_sanitize/lib/canvas_sanitize/canvas_sanitize.rb` — the gem
  (defines the macro, the sanitizer config `CanvasSanitize::SANITIZE`,
  and the `before_save` callback).
- `config/initializers/canvas_sanitize.rb` — Canvas-side wiring. It
  `require`s the gem and runs `ActiveRecord::Base.include CanvasSanitize`,
  so the `sanitize_field` macro is available on every ActiveRecord model
  without an explicit `include`.

## When to declare `sanitize_field`

Declare it on a column when **all** of the following hold:

- The column stores a `String` (or `text`) value
- The value can contain HTML markup.
- The value can originate from a user
- Downstream code renders the value as HTML (`raw`, `html_safe`,
  `dangerouslySetInnerHTML`, etc).

Use `CanvasSanitize::SANITIZE` config unless you have a documented reason to
diverge (e.g. `DiscussionEntry` overrides via `sanitize_config`).

Structured text columns are covered later.

## When NOT to declare `sanitize_field`

Skip it when **any** of the following hold:

- The column is rendered as plain text by contract (names, slugs, codes, enums,
  identifiers, URLs stored as bare strings). Sanitizing plain text adds
  no protection and can corrupt values that legitimately contain `<` or
  `&`.
- The column is system-generated and never accepts user input (audit
  metadata, computed digests, serialized internal state).

If a "plain text" column might later accept HTML, add `sanitize_field`
at the same time you change the contract — not after.
Existing data should be processed one time with `sanitize_field` as a backfill.

## JSON/JSONB/YAML or any other structured text column

- **What it stores:** structured data whose sub-keys vary; some keys may
  carry user-authored HTML, others are plain text or non-string.
- **Examples:**
  `assignments.settings`, `courses.settings`,
  `context_external_tools.settings`, `authentication_providers.settings`,
  `lti_tool_configurations.launch_settings`, `web_conferences.settings`, `users.preferences`,
  `user_preference_values.value`, `accounts.settings`,
  `plugin_settings.settings`, `content_tags.link_settings`,
  `llm_responses.prompt_dynamic_content`.
- **Strategy:** Each structured text column needs its own
  per-key audit to classify each sub-key as Rich HTML, Plain Text, or
  non-string, and to decide save-time or render-time sanitization for
  the HTML-bearing keys.

## System-generated column

- **What it stores:** content written by Canvas server code, not by
  users.
- **Examples:** `messages.body` (email / SMS / push body templated by
  Canvas), `migration_issues.description` (Canvas-authored migration
  status messages).
- **Strategy:** Sanitize user content that is rendered into these strings.

## Decision tree

### I am adding a new column

```
Is it a text column?
├─ No  → do NOT add sanitize_field.
└─ Yes
   │
   Can the value contain HTML markup?
   ├─ No  → do NOT add sanitize_field.
   └─ Yes → add `sanitize_field :col, CanvasSanitize::SANITIZE`
               in the model. Add a coverage spec that asserts a
               `<script>` payload is stripped on save.
```

### I am adding a new render path for an existing column

```
Does the column already declare sanitize_field?
├─ Yes → call DOMPurify on the value before rendering as HTML.
└─ No
   │
   Is the column plain text by contract?
   ├─ Yes → escape on render (`h`, React text node, `ERB::Util.html_escape`, etc).
   │        Do NOT add sanitize_field — it would change the column contract.
   └─ No  → The column accepts HTML but is not sanitized at save
            time. Add `sanitize_field` to the model in the same change
            that introduces the render path, and backfill-sanitize
            existing rows if the column is non-empty in production.
```

## Caveats

- **Not a URL rewriter**: `sanitize_field` does not adjust links to point
  at the new course/account during a content migration — that is the
  `canvas_link_migrator` gem's job. During imports the link migrator
  rewrites first; then Canvas-side persistence triggers `sanitize_field`.
  If a rewriter (or any caller) emits a tag/attribute outside the
  allowlist above, the sanitizer will drop it on save — verify produced
  HTML against `CanvasSanitize::SANITIZE` before adding new tags or
  attributes upstream.
- **`process_incoming_html_content` is NOT a sanitizer** — `lib/api.rb`
  explicitly documents this. Stored XSS defense relies on a separate
  `sanitize_field` declaration on the target column.
