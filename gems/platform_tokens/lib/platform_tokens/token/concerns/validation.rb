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
    module Concerns
      module Validation
        private

        def exp_not_elapsed
          return if exp.nil?

          errors.add(:exp, "token has expired") if exp + Base::CLOCK_SKEW_BUFFER <= Time.now.utc
        end

        def nbf_not_future
          return if nbf.nil?

          errors.add(:nbf, "token is not yet valid") if nbf > Time.now.utc
        end

        def timestamp_order
          return if iat.nil? || exp.nil?

          errors.add(:exp, "must be after iat") unless exp > iat
        end

        def env_matches_configuration
          return if env.nil?

          errors.add(:env, "does not match configured environment") unless env == PlatformTokens.configuration.env
        end
      end
    end
  end
end
