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

require "logger"

module PlatformTokens
  class Configuration
    include ActiveModel::Validations

    ATTRIBUTES = %i[access_token_ttl_seconds env iss region signing_key].freeze

    attr_reader(*ATTRIBUTES, :logger)
    private attr_writer(*ATTRIBUTES, :logger)

    validates(*ATTRIBUTES, presence: true)
    validates :access_token_ttl_seconds,
              numericality: { greater_than: 0, less_than_or_equal_to: ->(_) { Token::Base::MAX_TTL.to_i } }

    def initialize(env:, iss:, region:, signing_key:, logger: nil, access_token_ttl_seconds: nil)
      self.access_token_ttl_seconds = access_token_ttl_seconds || Token::Base::DEFAULT_TTL
      self.env = env
      self.iss = iss
      self.region = region
      self.signing_key = signing_key
      self.logger = logger || Logger.new($stdout)
    end
  end
end
