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

module CanvasCareer
  class LearnerDashboardController < ApplicationController
    include Api::V1::LearnerDashboardLayout

    before_action :require_feature_flag
    before_action :require_user

    def show
      layout = LearnerDashboardResolver.new(@current_user, @domain_root_account).resolve
      return render json: { error: "not found" }, status: :not_found unless layout

      render json: learner_dashboard_layout_json(layout, @current_user, session, include_block_editor_data: true)
    rescue InstructureMiscPlugin::Extensions::ContentServiceClient::ClientError => e
      rescue_content_service_error(e)
    end

    private

    def require_feature_flag
      unless @domain_root_account.feature_enabled?(:horizon_configurable_learner_dashboard)
        render json: { error: "The specified resource does not exist." }, status: :not_found
      end
    end

    def rescue_content_service_error(error)
      error_report = ErrorReport.log_error(
        "content_service_client_error",
        { message: error.message, service_errors: error.service_errors }
      )
      render json: { error: error.message, error_report_id: error_report.id }, status: :service_unavailable
    end
  end
end
