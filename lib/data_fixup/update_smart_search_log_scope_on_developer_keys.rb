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

module DataFixup
  class UpdateSmartSearchLogScopeOnDeveloperKeys < CanvasOperations::DataFixup
    OLD_SCOPE = "url:GET|/api/v1/courses/:course_id/smartsearch/log"
    NEW_SCOPE = "url:POST|/api/v1/courses/:course_id/smartsearch/log"

    self.mode = :batch

    scope do
      DeveloperKey.where("scopes LIKE ?", "%#{OLD_SCOPE}%")
    end

    def process_batch(batch)
      batch.update_all(["scopes = REPLACE(scopes, ?, ?)", OLD_SCOPE, NEW_SCOPE])
    end
  end
end
