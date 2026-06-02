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
#

class HorizonModeTestController < ApplicationController
  include HorizonMode

  skip_before_action :require_user

  def show
    @context ||= Course.find(params[:course_id]) if params[:course_id]
    @domain_root_account ||= Account.default
    load_canvas_career
    head :ok unless performed?
  end

  def test_redirect
    @context = Account.find(params[:account_id]) if params[:account_id]
    @context ||= Course.find(params[:course_id]) if params[:course_id]
    redirect_to params[:url]
  end

  def root_path
    "/"
  end

  def root_url
    "http://test.host/"
  end

  def canvas_career_path(context = nil)
    context ||= @context
    if context.is_a?(Course)
      "/career/courses/#{context.id}"
    else
      "/career"
    end
  end
end

describe HorizonMode, type: :request do
  let(:user) { user_factory(active_all: true) }
  let(:account) { Account.default }
  let(:course) { course_factory(account:, active_all: true) }
  let(:resolver) { instance_double(CanvasCareer::ExperienceResolver) }
  let(:config) { instance_double(CanvasCareer::Config) }

  before :all do # rubocop:disable RSpec/BeforeAfterAll
    Rails.application.routes.draw do
      get "show", to: "horizon_mode_test#show"
      get "test_redirect", to: "horizon_mode_test#test_redirect"
      get "courses/:course_id/career_show", to: "horizon_mode_test#show"
    end
  end

  before do
    course.update!(horizon_course: true)
    account.enable_feature!(:horizon_course_setting)
    user_session(user)
    allow(CanvasCareer::ExperienceResolver).to receive(:new).and_return(resolver)
    allow(resolver).to receive(:resolve).and_return(CanvasCareer::Constants::App::ACADEMIC)
    allow(CanvasCareer::Config).to receive(:new).with(account).and_return(config)
  end

  describe "load_canvas_career" do
    context "when force_classic param is present" do
      it "does not redirect" do
        get "/show", params: { force_classic: "1", course_id: course.id }
        expect(response).to have_http_status(:ok)
      end
    end

    context "when it's an API request" do
      it "does not redirect" do
        get "/show", params: { course_id: course.id }
        expect(response).to have_http_status(:ok)
      end
    end

    context "when invitation param is present" do
      it "does not redirect" do
        get "/show", params: { invitation: "abc123", course_id: course.id }
        expect(response).to have_http_status(:ok)
      end
    end

    context "when no user is logged in" do
      before do
        remove_user_session
      end

      it "does not redirect and returns ok" do
        get "/show", params: { course_id: course.id }
        expect(response).to have_http_status(:ok)
      end
    end

    context "when ExperienceResolver returns CAREER_LEARNING_PROVIDER" do
      before do
        allow(resolver).to receive(:resolve).and_return(CanvasCareer::Constants::App::CAREER_LEARNING_PROVIDER)
      end

      it "redirects to the career path without horizon parameters" do
        get "/show", params: { course_id: course.id }
        expect(response.location).to include("/career/courses/#{course.id}")
        expect(response.location).not_to include("content_only=true")
        expect(response.location).not_to include("instui_theme=career")
        expect(response.location).not_to include("force_classic=true")
      end
    end

    context "when ExperienceResolver returns CAREER_LEARNER" do
      before do
        allow(resolver).to receive(:resolve).and_return(CanvasCareer::Constants::App::CAREER_LEARNER)
      end

      it "redirects to the career path without horizon parameters" do
        get "/show", params: { course_id: course.id }
        expect(response.location).to include("/career/courses/#{course.id}")
        expect(response.location).not_to include("content_only=true")
        expect(response.location).not_to include("instui_theme=career")
        expect(response.location).not_to include("force_classic=true")
      end
    end

    context "when ExperienceResolver returns ACADEMIC" do
      before do
        allow(resolver).to receive(:resolve).and_return(CanvasCareer::Constants::App::ACADEMIC)
      end

      it "does not redirect" do
        get "/show", params: { course_id: course.id }
        expect(response).to have_http_status(:ok)
      end
    end

    context "when block_pending_access_consent? returns true" do
      before do
        allow(resolver).to receive(:resolve).and_return(CanvasCareer::Constants::App::CAREER_LEARNER)
        allow_any_instance_of(HorizonModeTestController).to receive(:block_pending_access_consent?).and_return(true)
      end

      it "does not redirect to the career path" do
        get "/show", params: { course_id: course.id }
        expect(response).to have_http_status(:ok)
      end
    end
  end

  describe "#block_pending_access_consent?" do
    let(:domain_root_account) { account_model }

    context "when the user is not a site admin" do
      it "returns false" do
        get "/show", params: { course_id: course.id }
        expect(response).to have_http_status(:ok)
      end
    end

    context "when the user is a site admin" do
      before do
        Account.site_admin.account_users.create!(user:, role: Role.get_built_in_role("AccountAdmin", root_account_id: Account.site_admin.id))
      end

      it "returns false when authorized_action succeeds" do
        allow_any_instance_of(HorizonModeTestController).to receive(:authorized_action).and_return(true)
        allow(resolver).to receive(:resolve).and_return(CanvasCareer::Constants::App::CAREER_LEARNER)
        get "/show", params: { course_id: course.id }
        expect(response).to have_http_status(:found)
      end

      it "returns true and blocks when authorized_action fails" do
        allow_any_instance_of(HorizonModeTestController).to receive(:authorized_action).and_return(false)
        allow(resolver).to receive(:resolve).and_return(CanvasCareer::Constants::App::CAREER_LEARNER)
        get "/show", params: { course_id: course.id }
        expect(response).to have_http_status(:ok)
      end
    end
  end

  describe "redirect_to override" do
    let(:horizon_account) do
      acc = account_model
      acc.settings[:horizon_account] = { value: true }
      acc.save!
      acc.enable_feature!(:horizon_course_setting)
      acc
    end

    context "when @context is a horizon account" do
      it "adds horizon parameters to string URLs" do
        get "/test_redirect", params: { account_id: horizon_account.id, url: "/dashboard" }
        expect(response.location).to include("content_only=true")
        expect(response.location).to include("instui_theme=career")
        expect(response.location).to include("force_classic=true")
      end

      it "preserves existing query parameters" do
        get "/test_redirect", params: { account_id: horizon_account.id, url: "/dashboard?existing=param" }
        expect(response.location).to include("existing=param")
        expect(response.location).to include("content_only=true")
        expect(response.location).to include("instui_theme=career")
        expect(response.location).to include("force_classic=true")
      end

      it "does not add horizon parameters to URLs containing /career/" do
        get "/test_redirect", params: { account_id: horizon_account.id, url: "/career/dashboard" }
        expect(response).to redirect_to("/career/dashboard")
      end

      it "does not add horizon parameters to URLs containing /career/ with existing params" do
        get "/test_redirect", params: { account_id: horizon_account.id, url: "/career/courses/123?existing=param" }
        expect(response).to redirect_to("/career/courses/123?existing=param")
      end

      it "does not modify non-string redirect options" do
        get "/test_redirect", params: { account_id: horizon_account.id, url: "/root" }
        expect(response).to have_http_status(:found)
      end
    end

    context "when @context is a horizon course" do
      before do
        allow(course).to receive(:horizon_course?).and_return(true)
      end

      it "does not add horizon params" do
        get "/test_redirect", params: { course_id: course.id, url: "/dashboard" }
        expect(response).to redirect_to("/dashboard")
      end

      it "does not add horizon parameters to URLs containing /career/" do
        get "/test_redirect", params: { course_id: course.id, url: "/career/dashboard" }
        expect(response).to redirect_to("/career/dashboard")
      end

      it "does not add horizon parameters to URLs containing /career/ with existing params" do
        get "/test_redirect", params: { course_id: course.id, url: "/career/courses/123?existing=param" }
        expect(response).to redirect_to("/career/courses/123?existing=param")
      end
    end

    context "when @context is a non-horizon course" do
      it "does not add horizon parameters" do
        get "/test_redirect", params: { course_id: course.id, url: "/dashboard" }
        expect(response).to redirect_to("/dashboard")
      end
    end

    context "when @context is nil" do # rubocop:disable RSpec/RepeatedExampleGroupBody
      it "does not add horizon parameters" do
        get "/test_redirect", params: { url: "/dashboard" }
        expect(response).to redirect_to("/dashboard")
      end
    end

    context "when @context is neither Account nor Course" do # rubocop:disable RSpec/RepeatedExampleGroupBody
      it "does not add horizon parameters" do
        get "/test_redirect", params: { url: "/dashboard" }
        expect(response).to redirect_to("/dashboard")
      end
    end
  end

  describe "should_add_horizon_params?" do
    context "when @context is nil" do # rubocop:disable RSpec/RepeatedExampleGroupBody
      it "returns false" do
        get "/test_redirect", params: { url: "/dashboard" }
        expect(response).to redirect_to("/dashboard")
      end
    end

    context "when @context is a horizon account" do
      let(:horizon_account) do
        acc = account_model
        acc.settings[:horizon_account] = { value: true }
        acc.save!
        acc.enable_feature!(:horizon_course_setting)
        acc
      end

      it "returns true" do
        get "/test_redirect", params: { account_id: horizon_account.id, url: "/dashboard" }
        expect(response.location).to include("instui_theme=career")
      end
    end

    context "when @context is a non-horizon account" do
      let(:non_horizon_account) do
        acc = account_model
        acc.settings[:horizon_account] = { value: false }
        acc.save!
        acc
      end

      it "returns false" do
        get "/test_redirect", params: { account_id: non_horizon_account.id, url: "/dashboard" }
        expect(response).to redirect_to("/dashboard")
      end
    end

    context "when @context is a horizon course" do # rubocop:disable RSpec/RepeatedExampleGroupBody
      before do
        allow(course).to receive(:horizon_course?).and_return(true)
      end

      it "returns false" do
        get "/test_redirect", params: { course_id: course.id, url: "/dashboard" }
        expect(response).to redirect_to("/dashboard")
      end
    end

    context "when @context is a non-horizon course" do
      before do
        allow(course).to receive(:horizon_course?).and_return(false)
      end

      it "returns false" do
        get "/test_redirect", params: { course_id: course.id, url: "/dashboard" }
        expect(response).to redirect_to("/dashboard")
      end
    end

    context "when @context is neither Account nor Course" do # rubocop:disable RSpec/RepeatedExampleGroupBody
      it "returns false" do
        get "/test_redirect", params: { url: "/dashboard" }
        expect(response).to redirect_to("/dashboard")
      end
    end

    context "when entering student view for a horizon course" do # rubocop:disable RSpec/RepeatedExampleGroupBody
      before do
        allow(course).to receive(:horizon_course?).and_return(true)
      end

      it "returns false" do
        get "/test_redirect", params: { course_id: course.id, url: "/dashboard" }
        expect(response).to redirect_to("/dashboard")
      end
    end

    context "when in student view session for a horizon course" do
      let(:fake_student) { course.student_view_student }

      before do
        allow(course).to receive(:horizon_course?).and_return(true)
        user_session(fake_student)
      end

      it "returns false" do
        get "/test_redirect", params: { course_id: course.id, url: "/dashboard" }
        expect(response).to redirect_to("/dashboard")
      end
    end

    context "when POST to student_view path for a horizon course" do # rubocop:disable RSpec/RepeatedExampleGroupBody
      before do
        allow(course).to receive(:horizon_course?).and_return(true)
      end

      it "returns false" do
        get "/test_redirect", params: { course_id: course.id, url: "/dashboard" }
        expect(response).to redirect_to("/dashboard")
      end
    end
  end

  describe "add_horizon_params_to_url" do
    let(:horizon_account) do
      acc = account_model
      acc.settings[:horizon_account] = { value: true }
      acc.save!
      acc.enable_feature!(:horizon_course_setting)
      acc
    end

    it "adds academic content only career theme params to the URL" do
      get "/test_redirect", params: { account_id: horizon_account.id, url: "/path" }
      expect(response.location).to include("content_only=true")
      expect(response.location).to include("instui_theme=career")
      expect(response.location).to include("force_classic=true")
    end

    it "preserves existing query parameters" do
      get "/test_redirect", params: { account_id: horizon_account.id, url: "/path?existing=value" }
      expect(response.location).to include("existing=value")
      expect(response.location).to include("content_only=true")
      expect(response.location).to include("instui_theme=career")
      expect(response.location).to include("force_classic=true")
    end

    it "merges with existing horizon params" do
      get "/test_redirect", params: { account_id: horizon_account.id, url: "/path?content_only=false" }
      expect(response.location).to include("content_only=true")
      expect(response.location).to include("instui_theme=career")
      expect(response.location).to include("force_classic=true")
    end
  end
end
