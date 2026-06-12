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

require "active_model"
require "active_support/core_ext/numeric/time"
require "json/jwt"
require_relative "platform_tokens/version"
require_relative "platform_tokens/configuration"
require_relative "platform_tokens/token"

module PlatformTokens
  class Error < StandardError; end
  class ConfigurationError < Error; end
  class InvalidTokenError < Error; end

  class << self
    private attr_accessor :configuration_data

    def configuration
      return configuration_data unless configuration_data.nil?

      raise ConfigurationError, "Platform tokens have not been configured."
    end

    def configure(...)
      new_configuration_data = Configuration.new(...)

      unless new_configuration_data.valid?
        log_message(new_configuration_data.errors.full_messages.join(", "), level: :warn)
        return
      end

      self.configuration_data = new_configuration_data
    end

    def log_message(message, level: :info)
      logger =
        begin
          configuration.logger
        rescue ConfigurationError
          Logger.new($stdout)
        end
      logger.public_send(level, "[PlatformTokens]: #{message}")
    rescue => e
      warn "[PlatformTokens]: #{message} (logging failed: #{e.class}: #{e.message})"
    end
  end
end
