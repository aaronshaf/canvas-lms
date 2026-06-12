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

class PlatformTokensSetup
  def self.configure!
    PlatformTokens.configure(
      env: -> { Canvas.environment },
      iss: -> { CanvasSecurity.services_issuer },
      region: -> { Canvas.region || Canvas.environment },
      signing_key: -> { CanvasSecurity::ServicesJwt::KeyStorage.present_key }
    )
  end
end

Rails.configuration.after_initialize { PlatformTokensSetup.configure! }
