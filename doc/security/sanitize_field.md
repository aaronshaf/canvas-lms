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

## When NOT to declare `sanitize_field`

Skip it when **any** of the following hold:

- The column is rendered as plain text by contract (names, slugs, codes, enums,
  identifiers, URLs stored as bare strings). Sanitizing plain text adds
  no protection and can corrupt values that legitimately contain `<` or
  `&`.
- The column is system-generated and never accepts user input (audit
  metadata, computed digests, serialized internal state).
- The column stores text in a non-HTML grammar (e.g., WebVTT/SRT
  captions). Running an HTML allowlist against a non-HTML grammar
  corrupts the format without adding security. See
  [Structured non-HTML text grammar](#structured-non-html-text-grammar)
  below for the alternative defenses.
- The column stores JSON/JSONB/YAML or other structured data with
  varying sub-keys (e.g., `*.settings`, `users.preferences`). A
  whole-column `sanitize_field` would either over-sanitize plain-text
  or non-string sub-keys, or under-sanitize HTML-bearing ones. See
  [JSON/JSONB/YAML columns with mixed sub-keys](#jsonjsonbyaml-columns-with-mixed-sub-keys)
  below for the per-key audit approach.

If a "plain text" column might later accept HTML, add `sanitize_field`
at the same time you change the contract — not after.
Existing data should be processed one time with `sanitize_field` as a backfill.

## JSON/JSONB/YAML columns with mixed sub-keys

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

## Structured non-HTML text grammar

- **What it stores:** text in a non-HTML grammar that has its own inline
  markup (e.g., WebVTT cue tags, SRT timing). Not Plain Text (it has
  markup), not Rich HTML (the markup is a different grammar).
- **Examples:** `media_tracks.content`, `media_tracks.webvtt_content`
  (WebVTT/SRT captions).
- **Strategy:** Do **not** declare `sanitize_field`.
  `CanvasSanitize::SANITIZE` is an HTML allowlist; parsing the value as
  HTML mangles the format (whitespace normalization, allowlist mismatch
  on grammar-specific tags like WebVTT's `<c>`, `<v>`, `<lang>`) without
  adding security. Safety relies on three defenses, documented in the
  model:
  1. **Save-time format guard** — reject content shapes that a consumer
     parser would misread as HTML (e.g., `MediaTrack` rejects
     `<tt xml`-prefixed content because the legacy DFXP/TTML parser
     interpreted it as HTML).
  2. **Consumer parser restriction** — the egress path must reach a
     parser that restricts DOM output by its own grammar (e.g., the
     browser's WebVTT parser via `<track src=URL>` allows only a fixed
     inline-tag set in cue payloads).
  3. **MIME discipline at egress** — return the content with a
     Content-Type that names its grammar (e.g., `text/vtt`) and rely on
     Rails' default `X-Content-Type-Options: nosniff` so the response
     can't be re-sniffed as HTML.
- **Egress asymmetry to watch for:** if defensive re-validation runs at
  one egress path (e.g., `MediaTracksController#show` calls `validate!`
  before `render plain:`), every other path that exposes the column
  must apply the same validation. The JSON serializer at
  `lib/api/v1/media_track.rb` and the GraphQL resolver at
  `app/graphql/types/media_track_type.rb` read the column directly
  without re-validating. Either validate at every read, or restrict
  egress to a single chokepoint.

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
└─ Yes → classify the column:
   ├─ Plain Text (no markup by contract)
   │     → do NOT add sanitize_field. Escape on render.
   ├─ Rich HTML (user-authored HTML markup)
   │     → add `sanitize_field :col, CanvasSanitize::SANITIZE` in the model.
   │       Add a coverage spec asserting `<script>` is stripped on save.
   ├─ JSON/JSONB/YAML (bag-of-keys structured data)
   │     → do NOT add a whole-column sanitize_field. Do a per-key audit;
   │       see "JSON/JSONB/YAML columns with mixed sub-keys".
   ├─ Structured non-HTML grammar (e.g., WebVTT/SRT)
   │     → do NOT add sanitize_field. Apply the three defenses;
   │       see "Structured non-HTML text grammar".
   └─ System-generated (no user input)
         → do NOT add sanitize_field. Sanitize user input as it flows in.
```

### I am adding a new render path for an existing column

```
Does the column already declare sanitize_field?
├─ Yes → call DOMPurify on the value before rendering as HTML.
└─ No  → classify the column:
   ├─ Plain Text
   │     → escape on render (`h`, React text node,
   │       `ERB::Util.html_escape`, etc). Do NOT add sanitize_field —
   │       it would change the column contract.
   ├─ Rich HTML (column accepts HTML but is not sanitized at save time)
   │     → add `sanitize_field` to the model in the same change that
   │       introduces the render path, and backfill-sanitize existing
   │       rows if the column is non-empty in production.
   ├─ JSON/JSONB/YAML
   │     → per-key audit. See "JSON/JSONB/YAML columns with mixed sub-keys".
   ├─ Structured non-HTML grammar
   │     → render through the grammar's parser (e.g., `<track src=URL>`
   │       for WebVTT). Do NOT render the value as HTML or interpolate
   │       it into HTML attributes. See "Structured non-HTML text grammar".
   └─ System-generated
         → if user input is being rendered into the value, sanitize the
           user input as it flows in. See "System-generated column".
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
