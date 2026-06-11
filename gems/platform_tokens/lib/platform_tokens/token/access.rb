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

module PlatformTokens
  module Token
    class Access < Token::Base
      validate :azp_not_sole_audience

      private

      def ttl
        PlatformTokens.configuration.access_token_ttl_seconds
      end

      def azp_not_sole_audience
        return unless aud.length == 1 && aud.first == azp

        errors.add(:aud, "must not be the sole audience when equal to the authorized party")
      end
    end
  end
end
