# frozen_string_literal: true

#
# Copyright (C) 2022 - present Instructure, Inc.
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

class GranularPermissionEnforcementTestController < ApplicationController
  include GranularPermissionEnforcement

  skip_before_action :require_user, raise: false
  skip_before_action :set_user_session_options, raise: false

  before_action :authorize_action

  def index
    respond_to do |format|
      format.html do
        head :ok
      end
    end
  end

  def new
    respond_to do |format|
      format.html do
        head :ok
      end
    end
  end

  def authorize_action
    @context = api_find(Course, params[:id])
    enforce_granular_permissions(
      @context,
      overrides: [:manage_content],
      actions: {
        index: RoleOverride::GRANULAR_MANAGE_COURSE_CONTENT_PERMISSIONS,
        show: [:manage_course_content_add],
      }
    )
  end

  def user_profile_url(user)
    "/users/#{user.id}"
  end

  def errors_path
    "/errors"
  end
end

describe GranularPermissionEnforcement, type: :request do
  before :all do # rubocop:disable RSpec/BeforeAfterAll
    Rails.application.routes.draw do
      root "granular_permission_enforcement_test#index"
      resources :courses do
        member do
          get "test_index", to: "granular_permission_enforcement_test#index", action: :index
          get "test_new", to: "granular_permission_enforcement_test#new", action: :new
        end
      end
    end
  end

  before do
    course_with_teacher(active_all: true)
    course_with_student(active_all: true)
  end

  it "is not authorized" do
    user_session(@student)
    get "/courses/#{@course.id}/test_index.json"
    expect(response).to have_http_status :forbidden
  end

  it "is authorized" do
    user_session(@teacher)
    get "/courses/#{@course.id}/test_index"
    expect(response).to have_http_status :ok
  end

  it "raises error if current controller action is missing from provided actions" do
    user_session(@teacher)
    get "/courses/#{@course.id}/test_new"
    expect(response).to have_http_status(:internal_server_error)
  end
end
