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

require_relative "../helpers/k5_common"

describe "NewQuizzesController", type: :request do
  include K5Common

  def build_new_quizzes_context
    course = course_model
    teacher = teacher_in_course(course:, active_all: true).user
    tool = course.context_external_tools.create!(
      name: "New Quizzes",
      url: "http://example.com/launch",
      consumer_key: "key",
      shared_secret: "secret",
      tool_id: "Quizzes 2",
      course_navigation: { enabled: true }
    )
    assignment = assignment_model(context: course, submission_types: "external_tool")
    assignment.external_tool_tag = ContentTag.create!(
      context: assignment,
      content: tool,
      url: tool.url,
      content_type: "ContextExternalTool"
    )
    assignment.save!
    [course, teacher, tool, assignment]
  end

  def enable_new_quizzes_for(context)
    Account.site_admin.enable_feature!(:new_quizzes_native_experience)
    context.enable_feature!(:new_quizzes_native_experience)
  end

  describe "#launch" do
    context "when feature flag is disabled" do
      it "returns unauthorized" do
        # Arrange
        course, teacher, _tool, assignment = build_new_quizzes_context
        user_session(teacher)

        # Act
        get "/courses/#{course.id}/assignments/#{assignment.id}/launch"

        # Assert
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "when user is not logged in" do
      it "redirects to login" do
        # Arrange
        course, _teacher, _tool, assignment = build_new_quizzes_context
        enable_new_quizzes_for(course)

        # Act
        get "/courses/#{course.id}/assignments/#{assignment.id}/launch"

        # Assert
        expect(response).to redirect_to(login_url)
      end
    end

    context "when user is logged in and feature flag is enabled" do
      it "renders the native new quizzes view" do
        # Arrange
        course, teacher, _tool, assignment = build_new_quizzes_context
        enable_new_quizzes_for(course)
        user_session(teacher)

        # Act
        get "/courses/#{course.id}/assignments/#{assignment.id}/launch"

        # Assert
        expect(response).to have_http_status(:ok)
        expect(response.body).to include("native_new_quizzes")
      end

      it "includes new quizzes env data in the page" do
        # Arrange
        course, teacher, _tool, assignment = build_new_quizzes_context
        enable_new_quizzes_for(course)
        user_session(teacher)

        # Act
        get "/courses/#{course.id}/assignments/#{assignment.id}/launch"

        # Assert
        env = js_env_from_response(response)
        expect(env["NEW_QUIZZES"]).not_to be_nil
        expect(env["NEW_QUIZZES"]["basename"]).to be_a(String)
      end

      it "sets the basename in js_env" do
        # Arrange
        course, teacher, _tool, assignment = build_new_quizzes_context
        enable_new_quizzes_for(course)
        user_session(teacher)

        # Act
        get "/courses/#{course.id}/assignments/#{assignment.id}/launch"

        # Assert
        env = js_env_from_response(response)
        expect(env["NEW_QUIZZES"]["basename"]).to eq("/courses/#{course.id}/assignments/#{assignment.id}")
      end

      it "calculates basename correctly when path param is present" do
        # Arrange
        course, teacher, _tool, assignment = build_new_quizzes_context
        enable_new_quizzes_for(course)
        user_session(teacher)

        # Act
        get "/courses/#{course.id}/assignments/#{assignment.id}/settings/some_path"

        # Assert
        env = js_env_from_response(response)
        expect(env["NEW_QUIZZES"]["basename"]).to eq("/courses/#{course.id}/assignments/#{assignment.id}")
      end

      it "removes build workflow segment from basename for subroutes" do
        # Arrange
        course, teacher, _tool, assignment = build_new_quizzes_context
        enable_new_quizzes_for(course)
        user_session(teacher)

        # Act
        get "/courses/#{course.id}/assignments/#{assignment.id}/build/123"

        # Assert
        env = js_env_from_response(response)
        expect(env["NEW_QUIZZES"]["basename"]).to eq("/courses/#{course.id}/assignments/#{assignment.id}")
      end

      it "removes moderation workflow segment from basename for subroutes" do
        # Arrange
        course, teacher, _tool, assignment = build_new_quizzes_context
        enable_new_quizzes_for(course)
        user_session(teacher)

        # Act
        get "/courses/#{course.id}/assignments/#{assignment.id}/moderation/123"

        # Assert
        env = js_env_from_response(response)
        expect(env["NEW_QUIZZES"]["basename"]).to eq("/courses/#{course.id}/assignments/#{assignment.id}")
      end

      it "removes reporting workflow segment from basename for subroutes" do
        # Arrange
        course, teacher, _tool, assignment = build_new_quizzes_context
        enable_new_quizzes_for(course)
        user_session(teacher)

        # Act
        get "/courses/#{course.id}/assignments/#{assignment.id}/reporting/123"

        # Assert
        env = js_env_from_response(response)
        expect(env["NEW_QUIZZES"]["basename"]).to eq("/courses/#{course.id}/assignments/#{assignment.id}")
      end

      it "removes exports workflow segment from basename for subroutes" do
        # Arrange
        course, teacher, _tool, assignment = build_new_quizzes_context
        enable_new_quizzes_for(course)
        user_session(teacher)

        # Act
        get "/courses/#{course.id}/assignments/#{assignment.id}/exports/123"

        # Assert
        env = js_env_from_response(response)
        expect(env["NEW_QUIZZES"]["basename"]).to eq("/courses/#{course.id}/assignments/#{assignment.id}")
      end

      it "removes taking workflow segment from basename for subroutes" do
        # Arrange
        course, teacher, _tool, assignment = build_new_quizzes_context
        enable_new_quizzes_for(course)
        user_session(teacher)

        # Act
        get "/courses/#{course.id}/assignments/#{assignment.id}/taking/123"

        # Assert
        env = js_env_from_response(response)
        expect(env["NEW_QUIZZES"]["basename"]).to eq("/courses/#{course.id}/assignments/#{assignment.id}")
      end

      it "removes observing workflow segment from basename for subroutes" do
        # Arrange
        course, teacher, _tool, assignment = build_new_quizzes_context
        enable_new_quizzes_for(course)
        user_session(teacher)

        # Act
        get "/courses/#{course.id}/assignments/#{assignment.id}/observing/123"

        # Assert
        env = js_env_from_response(response)
        expect(env["NEW_QUIZZES"]["basename"]).to eq("/courses/#{course.id}/assignments/#{assignment.id}")
      end

      it "removes errors workflow segment from basename for subroutes" do
        # Arrange
        course, teacher, _tool, assignment = build_new_quizzes_context
        enable_new_quizzes_for(course)
        user_session(teacher)

        # Act
        get "/courses/#{course.id}/assignments/#{assignment.id}/errors/123"

        # Assert
        env = js_env_from_response(response)
        expect(env["NEW_QUIZZES"]["basename"]).to eq("/courses/#{course.id}/assignments/#{assignment.id}")
      end

      context "when assignment is not quiz_lti" do
        it "returns unauthorized" do
          # Arrange
          course, teacher, _tool, _assignment = build_new_quizzes_context
          enable_new_quizzes_for(course)
          regular_assignment = assignment_model(context: course)
          user_session(teacher)

          # Act
          get "/courses/#{course.id}/assignments/#{regular_assignment.id}/launch"

          # Assert
          expect(response).to have_http_status(:unauthorized)
        end
      end

      context "with different route actions" do
        it "renders native new quizzes for build route" do
          # Arrange
          course, teacher, _tool, assignment = build_new_quizzes_context
          enable_new_quizzes_for(course)
          user_session(teacher)

          # Act
          get "/courses/#{course.id}/assignments/#{assignment.id}/build"

          # Assert
          expect(response).to have_http_status(:ok)
          expect(response.body).to include("native_new_quizzes")
        end

        it "renders native new quizzes for reporting route" do
          # Arrange
          course, teacher, _tool, assignment = build_new_quizzes_context
          enable_new_quizzes_for(course)
          user_session(teacher)

          # Act
          get "/courses/#{course.id}/assignments/#{assignment.id}/reporting"

          # Assert
          expect(response).to have_http_status(:ok)
          expect(response.body).to include("native_new_quizzes")
        end

        it "renders native new quizzes for moderation route" do
          # Arrange
          course, teacher, _tool, assignment = build_new_quizzes_context
          enable_new_quizzes_for(course)
          user_session(teacher)

          # Act
          get "/courses/#{course.id}/assignments/#{assignment.id}/moderation"

          # Assert
          expect(response).to have_http_status(:ok)
          expect(response.body).to include("native_new_quizzes")
        end

        it "renders native new quizzes for exports route" do
          # Arrange
          course, teacher, _tool, assignment = build_new_quizzes_context
          enable_new_quizzes_for(course)
          user_session(teacher)

          # Act
          get "/courses/#{course.id}/assignments/#{assignment.id}/exports"

          # Assert
          expect(response).to have_http_status(:ok)
          expect(response.body).to include("native_new_quizzes")
        end

        it "renders native new quizzes for taking route" do
          # Arrange
          course, teacher, _tool, assignment = build_new_quizzes_context
          enable_new_quizzes_for(course)
          user_session(teacher)

          # Act
          get "/courses/#{course.id}/assignments/#{assignment.id}/taking"

          # Assert
          expect(response).to have_http_status(:ok)
          expect(response.body).to include("native_new_quizzes")
        end

        it "renders native new quizzes for observing route" do
          # Arrange
          course, teacher, _tool, assignment = build_new_quizzes_context
          enable_new_quizzes_for(course)
          user_session(teacher)

          # Act
          get "/courses/#{course.id}/assignments/#{assignment.id}/observing"

          # Assert
          expect(response).to have_http_status(:ok)
          expect(response.body).to include("native_new_quizzes")
        end
      end

      context "with module_item_id" do
        it "uses the specific module tag when module_item_id is provided" do
          # Arrange
          course, teacher, _tool, assignment = build_new_quizzes_context
          enable_new_quizzes_for(course)
          context_module = course.context_modules.create!(name: "Test Module")
          module_tag = context_module.add_item(type: "assignment", id: assignment.id)
          user_session(teacher)

          # Act
          get "/courses/#{course.id}/assignments/#{assignment.id}/launch", params: {
            module_item_id: module_tag.id
          }

          # Assert
          expect(response).to have_http_status(:ok)
          env = js_env_from_response(response)
          expect(env["NEW_QUIZZES"]["basename"]).to eq("/courses/#{course.id}/assignments/#{assignment.id}")
        end
      end

      context "with content_only param" do
        it "includes new quizzes env data with content_only param" do
          # Arrange
          course, teacher, _tool, assignment = build_new_quizzes_context
          enable_new_quizzes_for(course)
          user_session(teacher)

          # Act
          get "/courses/#{course.id}/assignments/#{assignment.id}/launch", params: {
            content_only: true
          }

          # Assert
          expect(response).to have_http_status(:ok)
          env = js_env_from_response(response)
          expect(env["NEW_QUIZZES"]["basename"]).to eq("/courses/#{course.id}/assignments/#{assignment.id}")
        end
      end

      context "with sessionless_launch" do
        it "responds successfully" do
          # Arrange
          course, teacher, _tool, assignment = build_new_quizzes_context
          enable_new_quizzes_for(course)
          user_session(teacher)

          # Act
          get "/courses/#{course.id}/assignments/#{assignment.id}/launch", params: {
            sessionless_launch: true
          }

          # Assert
          expect(response).to have_http_status(:ok)
        end
      end

      context "when assignment is in a module but no module_item_id is provided" do
        it "auto-resolves the first module tag for the assignment" do
          # Arrange
          course, teacher, _tool, assignment = build_new_quizzes_context
          enable_new_quizzes_for(course)
          context_module = course.context_modules.create!(name: "Test Module")
          context_module.add_item(type: "assignment", id: assignment.id)
          user_session(teacher)

          # Act
          get "/courses/#{course.id}/assignments/#{assignment.id}/launch"

          # Assert
          expect(response).to have_http_status(:ok)
          env = js_env_from_response(response)
          expect(env["NEW_QUIZZES"]["basename"]).to eq("/courses/#{course.id}/assignments/#{assignment.id}")
        end
      end
    end

    context "when sessionless_launch param is present" do
      it "renders the native new quizzes view" do
        # Arrange
        course, teacher, _tool, assignment = build_new_quizzes_context
        enable_new_quizzes_for(course)
        user_session(teacher)

        # Act
        get "/courses/#{course.id}/assignments/#{assignment.id}/launch", params: { sessionless_launch: true }

        # Assert
        expect(response).to have_http_status(:ok)
        expect(response.body).to include("native_new_quizzes")
      end

      it "does not alter the basename" do
        # Arrange
        course, teacher, _tool, assignment = build_new_quizzes_context
        enable_new_quizzes_for(course)
        user_session(teacher)

        # Act
        get "/courses/#{course.id}/assignments/#{assignment.id}/launch", params: { sessionless_launch: true }

        # Assert
        env = js_env_from_response(response)
        expect(env["NEW_QUIZZES"]["basename"]).to eq("/courses/#{course.id}/assignments/#{assignment.id}")
      end
    end

    context "when user is a student" do
      it "renders the native new quizzes view for authorized students" do
        # Arrange
        course, _teacher, _tool, assignment = build_new_quizzes_context
        enable_new_quizzes_for(course)
        course.offer!
        student = student_in_course(course:, active_all: true).user
        user_session(student)

        # Act
        get "/courses/#{course.id}/assignments/#{assignment.id}/launch"

        # Assert
        expect(response).to have_http_status(:ok)
        expect(response.body).to include("native_new_quizzes")
      end

      context "when assignment is locked" do
        it "returns unauthorized when before unlock_at" do
          # Arrange
          course, _teacher, _tool, assignment = build_new_quizzes_context
          enable_new_quizzes_for(course)
          course.offer!
          student = student_in_course(course:, active_all: true).user
          assignment.update!(due_at: 36.hours.from_now, unlock_at: 1.day.from_now, lock_at: 2.days.from_now)
          user_session(student)

          # Act
          get "/courses/#{course.id}/assignments/#{assignment.id}/taking/123"

          # Assert
          expect(response).to have_http_status(:unauthorized)
        end

        it "returns unauthorized when after lock_at" do
          # Arrange
          course, _teacher, _tool, assignment = build_new_quizzes_context
          enable_new_quizzes_for(course)
          course.offer!
          student = student_in_course(course:, active_all: true).user
          assignment.update!(due_at: 36.hours.ago, unlock_at: 2.days.ago, lock_at: 1.day.ago)
          user_session(student)

          # Act
          get "/courses/#{course.id}/assignments/#{assignment.id}/taking/123"

          # Assert
          expect(response).to have_http_status(:unauthorized)
        end

        it "renders when within the lock window" do
          # Arrange
          course, _teacher, _tool, assignment = build_new_quizzes_context
          enable_new_quizzes_for(course)
          course.offer!
          student = student_in_course(course:, active_all: true).user
          assignment.update!(due_at: Time.zone.now, unlock_at: 1.day.ago, lock_at: 1.day.from_now)
          user_session(student)

          # Act
          get "/courses/#{course.id}/assignments/#{assignment.id}/taking/123"

          # Assert
          expect(response).to have_http_status(:ok)
          expect(response.body).to include("native_new_quizzes")
        end

        it "does not block non-taking actions" do
          # Arrange
          course, _teacher, _tool, assignment = build_new_quizzes_context
          enable_new_quizzes_for(course)
          course.offer!
          student = student_in_course(course:, active_all: true).user
          assignment.update!(due_at: 36.hours.from_now, unlock_at: 1.day.from_now, lock_at: 2.days.from_now)
          user_session(student)

          # Act
          get "/courses/#{course.id}/assignments/#{assignment.id}/launch"

          # Assert
          expect(response).to have_http_status(:ok)
          expect(response.body).to include("native_new_quizzes")
        end
      end

      context "when assignment has student-specific overrides" do
        it "respects the override dates" do
          # Arrange
          course, _teacher, _tool, assignment = build_new_quizzes_context
          enable_new_quizzes_for(course)
          course.offer!
          student = student_in_course(course:, active_all: true).user
          assignment.update!(due_at: 36.hours.from_now, unlock_at: 1.day.from_now, lock_at: 2.days.from_now)
          override = assignment.assignment_overrides.create!(set_type: "ADHOC")
          override.assignment_override_students.create!(user: student)
          override.override_unlock_at(1.day.ago)
          override.override_lock_at(1.day.from_now)
          override.save!
          user_session(student)

          # Act
          get "/courses/#{course.id}/assignments/#{assignment.id}/launch"

          # Assert
          expect(response).to have_http_status(:ok)
          expect(response.body).to include("native_new_quizzes")
        end
      end
    end

    context "when user is a teacher" do
      it "renders even when assignment is locked" do
        # Arrange
        course, teacher, _tool, assignment = build_new_quizzes_context
        enable_new_quizzes_for(course)
        course.offer!
        assignment.update!(due_at: 36.hours.from_now, unlock_at: 1.day.from_now, lock_at: 2.days.from_now)
        user_session(teacher)

        # Act
        get "/courses/#{course.id}/assignments/#{assignment.id}/launch"

        # Assert
        expect(response).to have_http_status(:ok)
        expect(response.body).to include("native_new_quizzes")
      end
    end

    context "in a K5 (Canvas for Elementary) course" do
      context "when user is a student" do
        it "renders successfully" do
          # Arrange
          course, _teacher, _tool, assignment = build_new_quizzes_context
          enable_new_quizzes_for(course)
          toggle_k5_setting(course.account)
          course.offer!
          student = student_in_course(course:, active_all: true).user
          user_session(student)

          # Act
          get "/courses/#{course.id}/assignments/#{assignment.id}/launch"

          # Assert
          expect(response).to have_http_status(:ok)
        end
      end

      context "when user is a teacher" do
        it "renders successfully" do
          # Arrange
          course, teacher, _tool, assignment = build_new_quizzes_context
          enable_new_quizzes_for(course)
          toggle_k5_setting(course.account)
          course.offer!
          user_session(teacher)

          # Act
          get "/courses/#{course.id}/assignments/#{assignment.id}/launch"

          # Assert
          expect(response).to have_http_status(:ok)
        end
      end

      context "when account is not K5" do
        it "renders successfully" do
          # Arrange
          course, _teacher, _tool, assignment = build_new_quizzes_context
          enable_new_quizzes_for(course)
          toggle_k5_setting(course.account)
          toggle_k5_setting(course.account, enable: false)
          course.offer!
          student = student_in_course(course:, active_all: true).user
          user_session(student)

          # Act
          get "/courses/#{course.id}/assignments/#{assignment.id}/launch"

          # Assert
          expect(response).to have_http_status(:ok)
        end
      end
    end
  end

  describe "#banks" do
    context "when feature flag is disabled" do
      it "returns unauthorized" do
        # Arrange
        course, teacher, _tool, _assignment = build_new_quizzes_context
        user_session(teacher)

        # Act
        get "/courses/#{course.id}/banks"

        # Assert
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "when user is not logged in" do
      it "redirects to login" do
        # Arrange
        course, _teacher, _tool, _assignment = build_new_quizzes_context
        enable_new_quizzes_for(course)

        # Act
        get "/courses/#{course.id}/banks"

        # Assert
        expect(response).to redirect_to(login_url)
      end
    end

    context "when user is logged in and feature flag is enabled" do
      it "renders the native new quizzes view" do
        # Arrange
        course, teacher, _tool, _assignment = build_new_quizzes_context
        enable_new_quizzes_for(course)
        user_session(teacher)

        # Act
        get "/courses/#{course.id}/banks"

        # Assert
        expect(response).to have_http_status(:ok)
        expect(response.body).to include("native_new_quizzes")
      end

      it "includes new quizzes env data in the page" do
        # Arrange
        course, teacher, _tool, _assignment = build_new_quizzes_context
        enable_new_quizzes_for(course)
        user_session(teacher)

        # Act
        get "/courses/#{course.id}/banks"

        # Assert
        env = js_env_from_response(response)
        expect(env["NEW_QUIZZES"]).not_to be_nil
        expect(env["NEW_QUIZZES"]["basename"]).to be_a(String)
      end

      it "sets the basename in js_env for course context" do
        # Arrange
        course, teacher, _tool, _assignment = build_new_quizzes_context
        enable_new_quizzes_for(course)
        user_session(teacher)

        # Act
        get "/courses/#{course.id}/banks"

        # Assert
        env = js_env_from_response(response)
        expect(env["NEW_QUIZZES"]["basename"]).to eq("/courses/#{course.id}")
      end

      context "when no quiz_lti tool is found" do
        it "returns unauthorized" do
          # Arrange
          course, teacher, tool, _assignment = build_new_quizzes_context
          enable_new_quizzes_for(course)
          tool.destroy
          user_session(teacher)

          # Act
          get "/courses/#{course.id}/banks"

          # Assert
          expect(response).to have_http_status(:unauthorized)
        end
      end

      context "when only a non-quiz_lti tool with course_navigation exists" do
        it "returns unauthorized" do
          # Arrange
          course, teacher, tool, _assignment = build_new_quizzes_context
          enable_new_quizzes_for(course)
          tool.destroy
          course.context_external_tools.create!(
            name: "Regular Tool",
            url: "http://example.com/launch",
            consumer_key: "key",
            shared_secret: "secret",
            course_navigation: { enabled: true }
          )
          user_session(teacher)

          # Act
          get "/courses/#{course.id}/banks"

          # Assert
          expect(response).to have_http_status(:unauthorized)
        end
      end
    end

    context "with account context" do
      it "renders the native new quizzes view" do
        # Arrange
        account = Account.default
        Account.site_admin.enable_feature!(:new_quizzes_native_experience)
        account.enable_feature!(:new_quizzes_native_experience)
        account.context_external_tools.create!(
          name: "New Quizzes",
          url: "http://example.com/launch",
          consumer_key: "key",
          shared_secret: "secret",
          tool_id: "Quizzes 2",
          account_navigation: { enabled: true }
        )
        account_admin_user(account:, active_all: true)
        user_session(@user)

        # Act
        get "/accounts/#{account.id}/banks"

        # Assert
        expect(response).to have_http_status(:ok)
        expect(response.body).to include("native_new_quizzes")
      end

      it "sets the basename in js_env for account context" do
        # Arrange
        account = Account.default
        Account.site_admin.enable_feature!(:new_quizzes_native_experience)
        account.enable_feature!(:new_quizzes_native_experience)
        account.context_external_tools.create!(
          name: "New Quizzes",
          url: "http://example.com/launch",
          consumer_key: "key",
          shared_secret: "secret",
          tool_id: "Quizzes 2",
          account_navigation: { enabled: true }
        )
        account_admin_user(account:, active_all: true)
        user_session(@user)

        # Act
        get "/accounts/#{account.id}/banks"

        # Assert
        env = js_env_from_response(response)
        expect(env["NEW_QUIZZES"]["basename"]).to eq("/accounts/#{account.id}")
      end

      it "includes new quizzes env data in the page for account context" do
        # Arrange
        account = Account.default
        Account.site_admin.enable_feature!(:new_quizzes_native_experience)
        account.enable_feature!(:new_quizzes_native_experience)
        account.context_external_tools.create!(
          name: "New Quizzes",
          url: "http://example.com/launch",
          consumer_key: "key",
          shared_secret: "secret",
          tool_id: "Quizzes 2",
          account_navigation: { enabled: true }
        )
        account_admin_user(account:, active_all: true)
        user_session(@user)

        # Act
        get "/accounts/#{account.id}/banks"

        # Assert
        env = js_env_from_response(response)
        expect(env["NEW_QUIZZES"]).not_to be_nil
        expect(env["NEW_QUIZZES"]["basename"]).to eq("/accounts/#{account.id}")
      end
    end
  end
end
