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
#

# Two-phase rollout gate from lenient subdomain matching to RFC 6749
# §3.1.2.3 strict matching for OAuth2 redirect_uri validation.
module OAuthRedirectUriValidationConfig
  Canvas::Reloader.on_reload { reset! }

  def self.report?
    !!config["report"]
  end

  def self.enforce?
    !!config["enforce"]
  end

  def self.disallow_implicit_oob_redirect_uri?
    !!config["disallow_implicit_oob_redirect_uri"]
  end

  def self.enforce_disallow_implicit_oob_redirect_uri?
    !!config["enforce_disallow_implicit_oob_redirect_uri"]
  end

  def self.reset!
    @config = nil
  end

  def self.config
    @config ||= Canvas.load_config_file_or_consul("oauth_redirect_uri_validation", failsafe_cache: true) || {}
  end
  private_class_method :config
end
