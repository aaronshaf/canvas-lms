# frozen_string_literal: true

#
# Copyright (C) 2025 - present Instructure, Inc.
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

module Canvas::OAuth
  module ResourceIndicators
    private

    def normalize_resource(resource)
      Array(resource).flatten.compact
    end

    def valid_resource_uri?(uri_string)
      uri = URI.parse(uri_string)
      uri.is_a?(URI::Generic) && uri.absolute? && uri.fragment.nil? && %w[http https].include?(uri.scheme)
    rescue URI::InvalidURIError
      false
    end

    def valid_audience?(resource, key)
      key.allowed_audiences.include?(resource)
    end
  end
end
