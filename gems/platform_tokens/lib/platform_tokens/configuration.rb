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
  class Configuration
    include ActiveModel::Validations

    ATTRIBUTES = %i[access_token_ttl_seconds env iss region].freeze

    attr_reader(*ATTRIBUTES)
    private attr_writer(*ATTRIBUTES)

    validates(*ATTRIBUTES, presence: true)
    validates :access_token_ttl_seconds,
              numericality: { greater_than: 0, less_than_or_equal_to: ->(_) { Token::Base::MAX_TTL.to_i } }

    def initialize(access_token_ttl_seconds:, env:, iss:, region:)
      self.access_token_ttl_seconds = access_token_ttl_seconds
      self.env = env
      self.iss = iss
      self.region = region
    end
  end
end
