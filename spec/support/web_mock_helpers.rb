# frozen_string_literal: true

#
# Copyright (C) 2026 - present Instructure, Inc.
#
# This file is part of Canvas.
#
# Canvas is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License along
# with this program. If not, see <http://www.gnu.org/licenses/>.

# Request- and integration-style specs run under a strict WebMock posture
# (disable_net_connect!(allow_localhost: true)) installed by an around-each
# hook in spec/spec_helper.rb. Specs that legitimately need to reach a
# non-localhost host (deliberate end-to-end smokes, contract tests against a
# fake-in-network service, etc.) can wrap the action in
# `with_real_network { ... }` to temporarily lift the restriction and have
# the prior state restored on exit — even if the block raises and even if
# calls are nested.
#
# Reach for this rarely. Stubbing with `WebMock.stub_request(...)` and
# verifying with `have_requested(...)` is the default; this helper exists for
# the cases where stubbing is the wrong tool.
module WebMockHelpers
  # Snapshot WebMock::Config's three connect-state attributes
  # (allow_net_connect, allow_localhost, allow), yield, and restore them in
  # an ensure — including when the block raises and when calls are nested.
  #
  # This is the primitive that both `with_real_network` and the
  # request/integration around-each hook in spec_helper.rb build on. The
  # block is expected to mutate WebMock config as it sees fit; this helper
  # only owns the save/restore.
  def self.with_webmock_config_snapshot
    config = WebMock::Config.instance
    prior_allow_net_connect = config.allow_net_connect
    prior_allow_localhost = config.allow_localhost
    prior_allow = config.allow
    yield
  ensure
    config.allow_net_connect = prior_allow_net_connect
    config.allow_localhost = prior_allow_localhost
    config.allow = prior_allow
  end

  def with_real_network
    WebMockHelpers.with_webmock_config_snapshot do
      WebMock.allow_net_connect!
      yield
    end
  end
end

RSpec.configure do |config|
  config.include WebMockHelpers
end
