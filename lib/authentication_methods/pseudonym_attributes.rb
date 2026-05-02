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

module AuthenticationMethods
  class PseudonymAttributes < ActiveSupport::CurrentAttributes
    attribute :auth_provider_id, :auth_provider

    def load_from(session)
      auth_provider_id = session["login_aac"]
      return if auth_provider_id.blank?

      self.auth_provider_id = auth_provider_id

      attributes.compact_blank!

      Rails.logger.info("[AUTH] Loaded pseudonym attributes: #{attributes.keys.join(", ")}") if attributes.present?
    end

    def load_auth_provider
      if auth_provider_id.blank?
        Rails.logger.warn("[AUTH] Auth provider was blank in the session ('#{auth_provider_id}'), skipping loading")
        return
      end

      self.auth_provider = GuardRail.activate(:secondary) { AuthenticationProvider.active.find_by(id: auth_provider_id) }
    end
  end
end
