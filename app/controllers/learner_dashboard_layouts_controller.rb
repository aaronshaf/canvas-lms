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

class LearnerDashboardLayoutsController < ApplicationController
  include Api::V1::LearnerDashboardLayout

  before_action :get_context
  before_action :require_feature_flag
  before_action :extract_block_editor_data, only: %i[create update]

  def index
    return unless authorized_action(@context, current_principal, :manage_learner_dashboards_view)

    layouts = LearnerDashboardLayout.visible_to_account(@context)
    render json: layouts.map { |l| learner_dashboard_layout_json(l, @current_user, session) }
  end

  def show
    return unless authorized_action(@context, current_principal, :manage_learner_dashboards_view)

    layout = LearnerDashboardLayout.visible_to_account(@context).find(params[:id])
    render json: learner_dashboard_layout_json(layout, @current_user, session, include_block_editor_data: true)
  rescue ActiveRecord::RecordNotFound
    render json: { error: "not found" }, status: :not_found
  rescue InstructureMiscPlugin::Extensions::ContentServiceClient::ClientError => e
    rescue_content_service_error(e)
  end

  def create
    return unless authorized_action(@context, current_principal, :manage_learner_dashboards_add)

    layout = @context.learner_dashboard_layouts.build(layout_params)
    if layout.save
      if @block_editor_data.present?
        layout.create_block_editor_data(user_uuid: @current_user.uuid, data: @block_editor_data)
      end
      render json: learner_dashboard_layout_json(layout, @current_user, session), status: :created
    else
      render json: { errors: layout.errors.full_messages }, status: :unprocessable_content
    end
  rescue InstructureMiscPlugin::Extensions::ContentServiceClient::ClientError => e
    rescue_content_service_error(e)
  end

  def update
    return unless authorized_action(@context, current_principal, :manage_learner_dashboards_edit)

    layout = @context.learner_dashboard_layouts.active.find(params[:id])
    if layout.update(layout_params)
      if @block_editor_data.present?
        layout.update_block_editor_data(user_uuid: @current_user.uuid, data: @block_editor_data)
      end
      render json: learner_dashboard_layout_json(layout, @current_user, session)
    else
      render json: { errors: layout.errors.full_messages }, status: :unprocessable_content
    end
  rescue ActiveRecord::RecordNotFound
    render json: { error: "not found" }, status: :not_found
  rescue InstructureMiscPlugin::Extensions::ContentServiceClient::ClientError => e
    rescue_content_service_error(e)
  end

  def destroy
    return unless authorized_action(@context, current_principal, :manage_learner_dashboards_delete)

    layout = @context.learner_dashboard_layouts.active.find(params[:id])
    layout.delete_block_editor_data(user_uuid: @current_user.uuid)
    layout.destroy
    head :no_content
  rescue ActiveRecord::RecordNotFound
    render json: { error: "not found" }, status: :not_found
  rescue InstructureMiscPlugin::Extensions::ContentServiceClient::ClientError => e
    rescue_content_service_error(e)
  end

  private

  def require_feature_flag
    unless @context.root_account.feature_enabled?(:horizon_configurable_learner_dashboard)
      render json: { error: "The specified resource does not exist." }, status: :not_found
    end
  end

  def layout_params
    params.permit(:name)
  end

  def extract_block_editor_data
    return if params[:block_editor_data].blank?

    permitted = params.permit(block_editor_data: strong_anything)
    extracted = permitted[:block_editor_data]
    @block_editor_data = extracted.is_a?(Hash) ? extracted.to_h : extracted
  end

  def rescue_content_service_error(error)
    error_report = ErrorReport.log_error(
      "content_service_client_error",
      { message: error.message, service_errors: error.service_errors }
    )
    render json: { error: error.message, error_report_id: error_report.id }, status: :service_unavailable
  end
end
