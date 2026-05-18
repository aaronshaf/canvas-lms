# KB Case 01 — Fixing Tests That Depend on a Transformation Pipeline

## Context

This KB Case was extracted from four failed attempts to fix a flaky test in
`spec/models/account/help_links_spec.rb`. The test exercises
`Account::HelpLinks#process_links_before_save`, a method that strips default
attribute values from help-menu link hashes before they are persisted to the
database.

The fix looked straightforward each time — control the number of links so the
test doesn't crash — but every attempt introduced a new failure. The root
problem turned out to be a violated data contract inside a multi-step
transformation pipeline, not a count problem at all.

---

## The Production Pipeline

```
default_links          filtered_links         instantiate_links        + custom_links
──────────────    →    ──────────────    →    ─────────────────    →   ──────────────
text/subtext           show_feedback          calls all lambdas         account
are Procs              link filter            → actual strings          settings
```

`account.help_links` runs all four steps. `process_links_before_save` is the
next consumer. It expects the **output of `instantiate_links`** — strings — not
the raw output of `default_links` — Procs.

```ruby
# Inside process_links_before_save (help_links.rb)
link.delete(:text) if link[:text] == default_link[:text].call
#                      ^^^^^^^^^^
#                      must be a String; Proc != String → never deleted
```

---

## The Sequence of Failures

### Attempt 1 — `enable_feature!(:ada_chatbot)` side effect

**Goal:** guarantee exactly 4 default links (3 base + ada_chatbot).  
**What happened:** `enable_feature!` triggered `after_state_change_proc:
sync_with_salesforce`, which wrote 3 extra custom links into the account's
settings. `account.help_links` concatenated those onto the 4 defaults → 7
links.

```ruby
# BAD
account.enable_feature!(:ada_chatbot)   # side effect adds 3 custom links
links = account.help_links.sort_by { |a| a[:id] }.deep_dup
# links.length == 7, updates.length == 4 → TypeError on zip
```

### Attempt 2 — `updates.first(links.length)` clips the wrong end

**Goal:** adapt `updates` to match however many links exist.  
**What happened:** `updates.first(N)` where `N > updates.length` still returns
all 4 elements (Array#first caps at the array's own size). When plugins added
5+ default links, `zip` still produced nil entries.

```ruby
# BAD
links = subject.default_links.sort_by { |a| a[:id] }.deep_dup
updates = [...].first(links.length)   # if links.length > 4, returns all 4
links.zip(updates).each { |link, update| link.merge!(update) }
# TypeError: no implicit conversion of nil into Hash  (same crash)
```

### Attempt 3 — `links.first(updates.length)` fixes the count but breaks the contract

**Goal:** cap `links` to `updates.length` instead.  
**What happened:** `subject.default_links` skips `instantiate_links`. The links
still carry Proc objects for `text`, `subtext`, and `feature_headline`.
`process_links_before_save` compares `Proc == String` → always false → Procs
are never stripped → they leak into the output.

```ruby
# BAD
links = subject.default_links            # Procs, not strings
          .sort_by { |a| a[:id] }
          .first(updates.length)
          .deep_dup
# process_links_before_save sees link[:text] as a Proc
# default_link[:text].call returns a String
# Proc != String → link[:text] is never deleted
# non_trivial_text contains raw Proc objects → assertion fails
```

---

## The Correct Fix

Use `subject.instantiate_links(subject.default_links)` to run the full
filter-and-instantiate pipeline without pulling in any account-level custom
links. Cap the link count from above, and trim `updates` from below in case
there are fewer default links than expected.

```ruby
# GOOD
it "removes default values from default links" do
  Setting.set "show_feedback_link", "true"

  updates = [
    { text: "this is new text", subtext: "this is new subtext" },
    { url: "this is a new url" },
    { feature_headline: "this is a new headline", is_new: true },
    { url: "yet another new url" }
  ]

  # instantiate_links resolves Procs → strings, satisfying the contract
  # that process_links_before_save expects.
  # Capping to updates.length guards against plugins adding extra defaults.
  links = subject.instantiate_links(subject.default_links)
                 .sort_by { |a| a[:id] }
                 .first(updates.length)
                 .deep_dup
  updates = updates.first(links.length)   # trim if fewer defaults than updates

  links.zip(updates).each { |link, update| link.merge!(update) }

  processed = subject.process_links_before_save(links).sort_by { |a| a[:id] }
  non_trivial_text = processed.map { |link|
    link.slice(:text, :subtext, :url, :feature_headline, :is_new).compact
  }
  expect(non_trivial_text).to eq updates
end
```

### Why this works

| Property | Satisfied by |
|---|---|
| Links are strings, not Procs | `instantiate_links` |
| No account-level custom links mixed in | using `subject.default_links`, not `account.help_links` |
| `zip` always fully paired | `.first(updates.length)` caps links from above |
| Test passes with any number of defaults | `updates.first(links.length)` trims from below |

---

## The Core Rule

> Before substituting one data source for another in a test, map every
> transformation step between the source and the method under test. Identify
> which output properties each downstream step depends on. A "simpler" source
> is only safe if it satisfies the same contract.

Concretely: if the method under test calls `.call` on values, those values must
already be Strings (or whatever `.call` returns), not Procs. Skipping any
instantiation step silently breaks comparisons.

---

## Unsuccessful Strategies Summary

| Attempt | Fix tried | Root assumption violated |
|---|---|---|
| 1 | `enable_feature!` to add the 4th default | Feature flag callbacks have no side effects |
| 2 | `updates.first(links.length)` | `Array#first(N)` returns N elements even when N > array size |
| 3 | `default_links.first(updates.length)` | `default_links` output is interchangeable with `help_links` output |

## Successful Strategy Summary

1. Identify the full transformation pipeline the method under test expects as
   input.
2. Choose a data source that satisfies the same contract as the full pipeline
   output — or run the missing steps explicitly.
3. Control cardinality symmetrically: cap the longer sequence from above AND
   trim the shorter from below so `zip` always produces fully-paired tuples.

---

## Dictionary of Terms

**`default_links`** — `Account::HelpLinks` method that returns the canonical
help-menu link definitions. `text`, `subtext`, and `feature_headline` are
stored as Ruby lambdas (Procs) for deferred I18n evaluation. Does NOT call
those lambdas.

**`filtered_links`** — Applies the `show_feedback_link` setting to exclude
`instructor_question` and `report_a_problem` when feedback links are disabled.

**`instantiate_links`** — Calls all lambda values on each link (`.call`),
replacing Procs with their evaluated strings. Also partitions featured links to
the front. This is the step that makes links compatible with string comparisons.

**`process_links_before_save`** — Strips attributes from default-type links
when their values equal the canonical defaults (comparing with
`default_link[:text].call`). Expects instantiated (string) values. Returns the
minimal diff to store in account settings, preserving I18n for non-customized
attributes.

**`account.help_links`** — The full public pipeline: `default_links` →
`filtered_links` → `instantiate_links` → concatenate custom links from account
settings. Returns fully instantiated, filtered link hashes. Can include extra
links injected by plugins or feature-flag callbacks.

**`after_state_change_proc`** — A feature-flag hook executed when a feature is
enabled or disabled via `enable_feature!`/`disable_feature!`. Can trigger
database writes or third-party syncs as side effects. In this case
`sync_with_salesforce` runs on `:ada_chatbot` state change and wrote extra
custom links to account settings.

**Data contract** — The set of type and shape guarantees a method expects its
input to satisfy. Here: link hashes must have String values (not Procs) for
`text`, `subtext`, and `feature_headline`. Violated by providing links that
have not been through `instantiate_links`.

**Zip nil entry** — When `Array#zip` is called on two arrays of unequal length,
the shorter array is padded with `nil`. Calling `Hash#merge!(nil)` on such an
entry raises `TypeError: no implicit conversion of nil into Hash`. Guard by
ensuring both arrays have equal length before zipping.

**Pipeline substitution risk** — The danger of replacing one step of a data
pipeline with a "simpler" alternative without verifying the downstream
contract. The substitution may satisfy one property (e.g. link count) while
silently breaking another (e.g. value types).
