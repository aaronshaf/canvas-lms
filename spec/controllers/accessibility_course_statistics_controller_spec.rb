# frozen_string_literal: true

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

describe AccessibilityCourseStatisticsController, type: :request do
  describe "GET #index" do
    context "authorization" do
      it "requires authentication" do
        account = Account.default
        account.enable_feature!(:educator_dashboard)
        account.enable_feature!(:a11y_checker)
        account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_account_statistics)
        teacher = user_factory(active_all: true)
        course1 = course_factory(account:, active_all: true)
        course1.enroll_teacher(teacher, enrollment_state: "active")

        get "/api/v1/users/#{teacher.id}/educator_accessibility_course_statistics.json"

        expect(response).to have_http_status(:unauthorized)
      end

      it "returns 403 when educator_dashboard feature flag is disabled" do
        account = Account.default
        account.enable_feature!(:educator_dashboard)
        account.enable_feature!(:a11y_checker)
        account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_account_statistics)
        teacher = user_factory(active_all: true)
        course1 = course_factory(account:, active_all: true)
        course1.enroll_teacher(teacher, enrollment_state: "active")
        account.disable_feature!(:educator_dashboard)
        user_session(teacher)

        get "/api/v1/users/#{teacher.id}/educator_accessibility_course_statistics.json"

        expect(response).to have_http_status(:forbidden)
      end

      it "returns 403 when user_id resolves to a different user" do
        account = Account.default
        account.enable_feature!(:educator_dashboard)
        account.enable_feature!(:a11y_checker)
        account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_account_statistics)
        teacher = user_factory(active_all: true)
        other_user = user_factory(active_all: true)
        course1 = course_factory(account:, active_all: true)
        course1.enroll_teacher(teacher, enrollment_state: "active")
        user_session(other_user)

        get "/api/v1/users/#{teacher.id}/educator_accessibility_course_statistics.json"

        expect(response).to have_http_status(:forbidden)
      end

      it "returns 403 when the user has no teacher or designer enrollments" do
        account = Account.default
        account.enable_feature!(:educator_dashboard)
        account.enable_feature!(:a11y_checker)
        account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_account_statistics)
        teacher = user_factory(active_all: true)
        student = user_factory(active_all: true)
        course1 = course_factory(account:, active_all: true)
        course1.enroll_teacher(teacher, enrollment_state: "active")
        course1.enroll_student(student, enrollment_state: "active")
        user_session(student)

        get "/api/v1/users/#{student.id}/educator_accessibility_course_statistics.json"

        expect(response).to have_http_status(:forbidden)
      end

      it "allows a user to access their own data" do
        account = Account.default
        account.enable_feature!(:educator_dashboard)
        account.enable_feature!(:a11y_checker)
        account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_account_statistics)
        teacher = user_factory(active_all: true)
        course1 = course_factory(account:, active_all: true)
        course1.enroll_teacher(teacher, enrollment_state: "active")
        user_session(teacher)

        get "/api/v1/users/#{teacher.id}/educator_accessibility_course_statistics.json"

        expect(response).to have_http_status(:ok)
        expect(response.parsed_body).to eq([])
      end

      it "allows a user to access their own data via 'self'" do
        account = Account.default
        account.enable_feature!(:educator_dashboard)
        account.enable_feature!(:a11y_checker)
        account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_account_statistics)
        teacher = user_factory(active_all: true)
        course1 = course_factory(account:, active_all: true)
        course1.enroll_teacher(teacher, enrollment_state: "active")
        user_session(teacher)

        get "/api/v1/users/self/educator_accessibility_course_statistics.json"

        expect(response).to have_http_status(:ok)
        expect(response.parsed_body).to eq([])
      end
    end

    context "data retrieval" do
      it "returns an empty array when no active statistics exist" do
        account = Account.default
        account.enable_feature!(:educator_dashboard)
        account.enable_feature!(:a11y_checker)
        account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_account_statistics)
        teacher = user_factory(active_all: true)
        course1 = course_factory(account:, active_all: true)
        course1.enroll_teacher(teacher, enrollment_state: "active")
        user_session(teacher)

        get "/api/v1/users/#{teacher.id}/educator_accessibility_course_statistics.json"

        expect(response).to have_http_status(:ok)
        expect(response.parsed_body).to eq([])
      end

      it "includes course_name and course_code in the response" do
        account = Account.default
        account.enable_feature!(:educator_dashboard)
        account.enable_feature!(:a11y_checker)
        account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_account_statistics)
        teacher = user_factory(active_all: true)
        course1 = course_factory(account:, active_all: true, course_name: "Biology 101", course_code: "BIO101")
        course1.enroll_teacher(teacher, enrollment_state: "active")
        AccessibilityCourseStatistic.create!(
          course: course1,
          workflow_state: "active",
          active_issue_count: 5
        )
        user_session(teacher)

        get "/api/v1/users/#{teacher.id}/educator_accessibility_course_statistics.json"

        expect(response).to have_http_status(:ok)
        row = response.parsed_body.first
        expect(row["course_name"]).to eq("Biology 101")
        expect(row["course_code"]).to eq("BIO101")
      end

      it "returns active statistics for the teacher's courses" do
        account = Account.default
        account.enable_feature!(:educator_dashboard)
        account.enable_feature!(:a11y_checker)
        account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_account_statistics)
        teacher = user_factory(active_all: true)
        course1 = course_factory(account:, active_all: true)
        course2 = course_factory(account:, active_all: true)
        course1.enroll_teacher(teacher, enrollment_state: "active")
        course2.enroll_teacher(teacher, enrollment_state: "active")
        stat1 = AccessibilityCourseStatistic.create!(
          course: course1,
          workflow_state: "active",
          active_issue_count: 5,
          resolved_issue_count: 3,
          closed_issue_count: 2
        )
        AccessibilityCourseStatistic.create!(
          course: course2,
          workflow_state: "active",
          active_issue_count: 10,
          resolved_issue_count: 7,
          closed_issue_count: 4
        )
        user_session(teacher)

        get "/api/v1/users/#{teacher.id}/educator_accessibility_course_statistics.json"

        expect(response).to have_http_status(:ok)
        data = response.parsed_body
        expect(data.length).to eq(2)

        course_ids = data.pluck("course_id")
        expect(course_ids).to contain_exactly(course1.id, course2.id)

        row1 = data.find { |r| r["course_id"] == stat1.course_id }
        expect(row1["active_issue_count"]).to eql(5) # rubocop:disable RSpec/BeEql
        expect(row1["resolved_issue_count"]).to eql(3) # rubocop:disable RSpec/BeEql
        expect(row1["closed_issue_count"]).to eql(2) # rubocop:disable RSpec/BeEql
      end

      it "includes closed_issue_count in the response" do
        account = Account.default
        account.enable_feature!(:educator_dashboard)
        account.enable_feature!(:a11y_checker)
        account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_account_statistics)
        teacher = user_factory(active_all: true)
        course1 = course_factory(account:, active_all: true)
        course1.enroll_teacher(teacher, enrollment_state: "active")
        AccessibilityCourseStatistic.create!(
          course: course1,
          workflow_state: "active",
          active_issue_count: 1,
          resolved_issue_count: 1,
          closed_issue_count: 9
        )
        user_session(teacher)

        get "/api/v1/users/#{teacher.id}/educator_accessibility_course_statistics.json"

        expect(response).to have_http_status(:ok)
        row = response.parsed_body.first
        expect(row["closed_issue_count"]).to eql(9) # rubocop:disable RSpec/BeEql
      end

      it "excludes statistics with non-active workflow states" do
        account = Account.default
        account.enable_feature!(:educator_dashboard)
        account.enable_feature!(:a11y_checker)
        account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_account_statistics)
        teacher = user_factory(active_all: true)
        course1 = course_factory(account:, active_all: true)
        course2 = course_factory(account:, active_all: true)
        course1.enroll_teacher(teacher, enrollment_state: "active")
        course2.enroll_teacher(teacher, enrollment_state: "active")
        AccessibilityCourseStatistic.create!(
          course: course1,
          workflow_state: "active",
          active_issue_count: 5
        )
        AccessibilityCourseStatistic.create!(
          course: course2,
          workflow_state: "in_progress",
          active_issue_count: 10
        )
        user_session(teacher)

        get "/api/v1/users/#{teacher.id}/educator_accessibility_course_statistics.json"

        expect(response).to have_http_status(:ok)
        data = response.parsed_body
        expect(data.length).to eq(1)
        expect(data.first["course_id"]).to eq(course1.id)
      end

      it "excludes courses where the user is not a teacher or designer" do
        account = Account.default
        account.enable_feature!(:educator_dashboard)
        account.enable_feature!(:a11y_checker)
        account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_account_statistics)
        teacher = user_factory(active_all: true)
        course1 = course_factory(account:, active_all: true)
        other_course = course_factory(account:, active_course: true)
        course1.enroll_teacher(teacher, enrollment_state: "active")
        AccessibilityCourseStatistic.create!(
          course: course1,
          workflow_state: "active",
          active_issue_count: 5
        )
        AccessibilityCourseStatistic.create!(
          course: other_course,
          workflow_state: "active",
          active_issue_count: 99
        )
        user_session(teacher)

        get "/api/v1/users/#{teacher.id}/educator_accessibility_course_statistics.json"

        expect(response).to have_http_status(:ok)
        course_ids = response.parsed_body.pluck("course_id")
        expect(course_ids).to include(course1.id)
        expect(course_ids).not_to include(other_course.id)
      end

      it "returns 403 when a11y_checker_ga1 is disabled on the account" do
        account = Account.default
        account.enable_feature!(:educator_dashboard)
        account.enable_feature!(:a11y_checker)
        account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_account_statistics)
        teacher = user_factory(active_all: true)
        course1 = course_factory(account:, active_all: true)
        course1.enroll_teacher(teacher, enrollment_state: "active")
        AccessibilityCourseStatistic.create!(
          course: course1,
          workflow_state: "active",
          active_issue_count: 5
        )
        account.disable_feature!(:a11y_checker_ga1)
        user_session(teacher)

        get "/api/v1/users/#{teacher.id}/educator_accessibility_course_statistics.json"

        expect(response).to have_http_status(:forbidden)
      end

      it "includes all teacher courses when a11y_checker_ga1 is enabled" do
        account = Account.default
        account.enable_feature!(:educator_dashboard)
        account.enable_feature!(:a11y_checker)
        account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_account_statistics)
        teacher = user_factory(active_all: true)
        course1 = course_factory(account:, active_all: true)
        course2 = course_factory(account:, active_all: true)
        course1.enroll_teacher(teacher, enrollment_state: "active")
        course2.enroll_teacher(teacher, enrollment_state: "active")
        AccessibilityCourseStatistic.create!(
          course: course1,
          workflow_state: "active",
          active_issue_count: 5
        )
        AccessibilityCourseStatistic.create!(
          course: course2,
          workflow_state: "active",
          active_issue_count: 10
        )
        user_session(teacher)

        get "/api/v1/users/#{teacher.id}/educator_accessibility_course_statistics.json"

        expect(response).to have_http_status(:ok)
        course_ids = response.parsed_body.pluck("course_id")
        expect(course_ids).to contain_exactly(course1.id, course2.id)
      end

      it "includes courses where the user has a DesignerEnrollment" do
        account = Account.default
        account.enable_feature!(:educator_dashboard)
        account.enable_feature!(:a11y_checker)
        account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_account_statistics)
        teacher = user_factory(active_all: true)
        course1 = course_factory(account:, active_all: true)
        designer_course = course_factory(account:, active_course: true)
        course1.enroll_teacher(teacher, enrollment_state: "active")
        designer_course.enroll_designer(teacher, enrollment_state: "active")
        AccessibilityCourseStatistic.create!(
          course: designer_course,
          workflow_state: "active",
          active_issue_count: 3
        )
        user_session(teacher)

        get "/api/v1/users/#{teacher.id}/educator_accessibility_course_statistics.json"

        expect(response).to have_http_status(:ok)
        stat_json = response.parsed_body.find { |s| s["course_id"] == designer_course.id }
        expect(stat_json["course_id"]).to eql(designer_course.id)
        expect(stat_json["active_issue_count"]).to eql(3) # rubocop:disable RSpec/BeEql
      end

      it "excludes completed (concluded) courses" do
        account = Account.default
        account.enable_feature!(:educator_dashboard)
        account.enable_feature!(:a11y_checker)
        account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_account_statistics)
        teacher = user_factory(active_all: true)
        course1 = course_factory(account:, active_all: true)
        course2 = course_factory(account:, active_all: true)
        course1.enroll_teacher(teacher, enrollment_state: "active")
        course2.enroll_teacher(teacher, enrollment_state: "active")
        course1.update!(workflow_state: "completed")
        AccessibilityCourseStatistic.create!(
          course: course1,
          workflow_state: "active",
          active_issue_count: 5
        )
        AccessibilityCourseStatistic.create!(
          course: course2,
          workflow_state: "active",
          active_issue_count: 10
        )
        user_session(teacher)

        get "/api/v1/users/#{teacher.id}/educator_accessibility_course_statistics.json"

        expect(response).to have_http_status(:ok)
        course_ids = response.parsed_body.pluck("course_id")
        expect(course_ids).not_to include(course1.id)
        expect(course_ids).to include(course2.id)
      end

      it "excludes deleted courses" do
        account = Account.default
        account.enable_feature!(:educator_dashboard)
        account.enable_feature!(:a11y_checker)
        account.enable_feature!(:a11y_checker_ga1)
        Account.site_admin.enable_feature!(:a11y_checker_account_statistics)
        teacher = user_factory(active_all: true)
        course1 = course_factory(account:, active_all: true)
        course2 = course_factory(account:, active_all: true)
        course1.enroll_teacher(teacher, enrollment_state: "active")
        course2.enroll_teacher(teacher, enrollment_state: "active")
        course1.update!(workflow_state: "deleted")
        AccessibilityCourseStatistic.create!(
          course: course1,
          workflow_state: "active",
          active_issue_count: 5
        )
        AccessibilityCourseStatistic.create!(
          course: course2,
          workflow_state: "active",
          active_issue_count: 10
        )
        user_session(teacher)

        get "/api/v1/users/#{teacher.id}/educator_accessibility_course_statistics.json"

        expect(response).to have_http_status(:ok)
        course_ids = response.parsed_body.pluck("course_id")
        expect(course_ids).not_to include(course1.id)
        expect(course_ids).to include(course2.id)
      end
    end
  end
end
