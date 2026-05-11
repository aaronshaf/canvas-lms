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
  module BackfillManageLearnerDashboardsPermissions
    def self.run
      %i[manage_learner_dashboards_view manage_learner_dashboards_add manage_learner_dashboards_edit manage_learner_dashboards_delete].each do |perm|
        DataFixup::AddRoleOverridesForNewPermission.run(:manage_account_settings, perm)
      end
    end
  end
end
