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

class AnalyticsDashboardController < ApplicationController
  before_action :require_account_context
  before_action :require_view_analytics_dashboard_permission
  before_action { |c| c.active_tab = "analytics_dashboard" }

  def require_view_analytics_dashboard_permission
    authorized_action(@context, current_principal, :view_analytics_dashboard)
  end

  def show
    add_crumb "Analytics Dashboard"
    @page_title = "Analytics Dashboard"
    @body_classes << "full-width padless-content"

    # The remote entry URL comes from canvas-consul-config (analytics_dashboard.yml),
    # but can be overridden per-session via MicrofrontendsReleaseTagOverrideController.
    override = MicrofrontendsReleaseTagOverrideService.new(session).get_override("analytics_dashboard")
    remote_env(analytics_dashboard: {
                 launch_url: override || Services::AnalyticsDashboard.launch_url
               })

    deferred_js_bundle :analytics_dashboard

    env = {
      ANALYTICS_DASHBOARD: {
        ACCOUNT_ID: @account.id.to_s
      }
    }

    js_env(env)
    render html: "", layout: true
  end
end
