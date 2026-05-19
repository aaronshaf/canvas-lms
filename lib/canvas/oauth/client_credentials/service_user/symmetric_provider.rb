# frozen_string_literal: true

#
# Copyright (C) 2023 - present Instructure, Inc.
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
  module ClientCredentials
    module ServiceUser
      # Symmetric (client_secret) provider for site-admin service keys.
      # Issues InstAccess tokens scoped to the key's associated service_user
      # rather than a regular OAuth access token.
      class SymmetricProvider < Canvas::OAuth::ClientCredentials::ServiceUser::Provider
        def initialize(...)
          @errors = []

          super
        end

        def valid?
          validate!

          errors.empty?
        end

        def error_message
          errors.join(", ")
        end

        private

        def validate!
          @errors = []

          if key.nil? || !key.usable?
            errors << "Unknown client_id"
            return
          end

          if key.service_user.blank? || key.service_user.deleted? || key.service_user.suspended?
            errors << "No active service"
          end
        end

        attr_accessor :errors
      end
    end
  end
end
