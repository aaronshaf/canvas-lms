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

class LearnerDashboardActivationsController < ApplicationController
  include Api::V1::LearnerDashboardLayout

  before_action :get_context
  before_action :require_feature_flag

  def show
    return unless authorized_action(@context, current_principal, :manage_learner_dashboards_view)

    activation = @context.learner_dashboard_activations.first
    unless activation
      return render json: { error: "not found" }, status: :not_found
    end

    render json: activation_json(activation)
  end

  def update
    return unless authorized_action(@context, current_principal, :manage_learner_dashboards_edit)

    layout = LearnerDashboardLayout.visible_to_account(@context).find(params[:learner_dashboard_layout_id])

    activation = @context.learner_dashboard_activations.first_or_initialize
    activation.learner_dashboard_layout = layout
    activation.root_account_id ||= @context.resolved_root_account_id

    if activation.save
      render json: activation_json(activation)
    else
      render json: { errors: activation.errors.full_messages }, status: :unprocessable_content
    end
  rescue ActiveRecord::RecordNotFound
    render json: { error: "layout not found or not visible to this account" }, status: :not_found
  end

  def destroy
    return unless authorized_action(@context, current_principal, :manage_learner_dashboards_delete)

    activation = @context.learner_dashboard_activations.first
    unless activation
      return render json: { error: "not found" }, status: :not_found
    end

    activation.destroy!
    head :no_content
  end

  private

  def require_feature_flag
    unless @context.root_account.feature_enabled?(:horizon_configurable_learner_dashboard)
      render json: { error: "The specified resource does not exist." }, status: :not_found
    end
  end

  def activation_json(activation)
    {
      id: activation.id,
      account_id: activation.account_id,
      learner_dashboard_layout: learner_dashboard_layout_json(
        activation.learner_dashboard_layout, @current_user, session
      ),
      created_at: activation.created_at&.iso8601,
      updated_at: activation.updated_at&.iso8601
    }
  end
end
