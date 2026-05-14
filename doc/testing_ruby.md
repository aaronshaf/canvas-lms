# Testing Ruby

## Outbound HTTP in specs

### Why network isolation matters

Canvas calls a long tail of HTTP services — canvas-rce, inst-fs, pandapub,
the Notification Service, LiveEvents, LTI tool callbacks, SIS, OAuth
providers, S3, Datadog, Mathman, the pact broker, etc. When a spec quietly
makes a real outbound call during a test run, two things go wrong:

1. **Silent flakiness.** The spec passes when the service is reachable and
   fails mysteriously when it isn't (CI network blips, vendor outages,
   sandbox DNS). Nothing in the spec output flags that the test depends on
   real network.
2. **Spec-to-spec pollution.** `WebMock.reset!` (the only between-test
   WebMock cleanup wired into `spec_helper.rb`) clears stub registrations
   and request history but **does not** revert the `allow_net_connect` /
   `allow_localhost` / `allow` flags.[^webmock-reset] Any spec that opts
   into `WebMock.disable_net_connect!` leaks the stricter posture to every
   subsequent spec in the same process, and any spec that opts back into
   `WebMock.allow_net_connect!` leaks the looser posture the same way.
   The bug class flows in both directions.

[^webmock-reset]: See [`WebMock.reset!` in `lib/webmock/webmock.rb`](https://github.com/bblimke/webmock/blob/master/lib/webmock/webmock.rb)
    — it only resets `WebMock::RequestRegistry` and `WebMock::StubRegistry`
    and never touches `WebMock::Config.instance`.

### The rule

In `type: :request` and `type: :integration` specs, outbound HTTP is off by
default. Any unstubbed request to a non-localhost host raises
`WebMock::NetConnectNotAllowedError`.

When you write one of these specs and the code under test calls an external
service, you have three options, in order of preference:

1. **Stub it** with `WebMock.stub_request(...)` and verify the call with
   `have_requested(...)`. This is the default for almost everything.
2. **Widen the allowlist** inline if the "external" host is actually an
   in-network test sidecar (e.g. LocalStack, `fake-s3`).
3. **Wrap in `with_real_network { ... }`** if the spec genuinely needs the
   public internet (contract tests, nightly smokes). Reach for this rarely.

Other spec types (model, controller, lib, etc.) currently run with
`allow_net_connect!` — see [Known tech debt](#known-tech-debt) below — so
the strict posture only fires where the payoff is highest. The mechanism is
described in [How it works](#how-it-works).

### Stub by default

Stub the call, exercise the code, then assert the call was made:

```ruby
it "posts the event to the notification service" do
  stub = WebMock.stub_request(:post, "https://notifications.example/events")
                .to_return(status: 204)

  post "/api/v1/foo", params: { ... }

  expect(stub).to have_been_requested
  # or, equivalently:
  # expect(WebMock).to have_requested(:post, "https://notifications.example/events")
end
```

The `have_requested` assertion is what turns a stub from a permissive
placeholder into an interaction assertion. Without it, a stub that's never
hit still passes silently and the spec stops testing what it claims to.

### Widening the allowlist for in-network sidecars

The around-each hook pre-allows `localhost` plus the DynamoDB-local host
(`dynamodb`, the docker-compose service name). If your spec needs to reach
a *different* in-network host — LocalStack on a docker hostname, etc. —
widen the allowlist inline. The hook restores the prior state on exit, so
there is no cleanup to write:

```ruby
it "publishes to LocalStack" do
  WebMock.disable_net_connect!(allow_localhost: true, allow: %w[localstack])
  # ...
end
```

This is the right tool when the "external" service is part of the test
environment itself — not a real third party.

### `with_real_network` for genuine outbound traffic

Some specs legitimately have to hit the public internet — contract tests
that validate the wire format against an upstream provider, deliberate
end-to-end smokes. For those, wrap the action in `with_real_network` and
leave a comment explaining why:

```ruby
it "pulls the latest schema from the vendor (contract test)" do
  # Real network is intentional here: this guards the wire-format contract
  # with the upstream provider and only runs in nightly CI.
  with_real_network { Vendor::Schema.refresh! }
end
```

`with_real_network` lives in `spec/support/web_mock_helpers.rb` and is
auto-included in every example group. It exists because the naïve
alternative —

```ruby
WebMock.allow_net_connect!
# ... do thing ...
WebMock.disable_net_connect!(allow_localhost: true)
```

— restores only the boolean. Any prior `allow:` allowlist is silently
dropped, and if the block raises, the state is never reset at all. The
helper snapshots all three config attributes (`allow_net_connect`,
`allow_localhost`, `allow`), yields, and restores in an `ensure`, including
when calls nest.

### How it works

`spec/spec_helper.rb` installs an `around(:each)` hook for `type: :request`
and `type: :integration` examples that:

1. Snapshots the current `WebMock::Config` connect state
   (`allow_net_connect`, `allow_localhost`, `allow`).
2. Applies `WebMock.disable_net_connect!(allow_localhost: true, allow: %w[dynamodb])`
   for the duration of the example.
3. Restores the exact prior state in an `ensure` block, regardless of
   whether the example passed, failed, or raised.

The snapshot/restore is load-bearing, not defensive boilerplate.
`WebMock.reset!` (the only between-test WebMock cleanup wired into
`spec_helper.rb`) clears stub registrations and request history but does
**not** revert the `allow_net_connect` / `allow_localhost` / `allow` flags.
Without the snapshot/restore, any spec that flipped the posture would leak
that state to every subsequent spec in the same process — in either
direction. The hook also tracks whatever the suite-wide default happens to
be, so if the default is ever flipped (see below), this hook will continue
to work without modification.

### Known tech debt

The suite-wide default in `spec/spec_helper.rb` is still
`WebMock.allow_net_connect!`. That has been in place since WebMock landed
in Canvas in 2016 (commit `5fd9010263c`) as an explicitly transitional
setting — the original intent was to flip it to `disable_net_connect!`
once Canvas plugins were migrated. That migration was never finished.

Flipping the suite-wide default is unbounded work: any spec across the
suite that quietly hits a real service today would start failing the
moment the default goes strict, and there is no current inventory of how
many specs that is or which services they touch. The around-each hook
described above is the pragmatic middle ground — it captures the
highest-value bucket (full request / API cycles, where production code is
most likely to reach a real external service) without requiring a
suite-wide discovery and migration pass first.

If you find yourself adding a new non-request spec that touches HTTP, lean
on `WebMock.stub_request` voluntarily; that makes the eventual default
flip cheaper.
