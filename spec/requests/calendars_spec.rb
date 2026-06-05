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
#

require_relative "../helpers/k5_common"

describe "CalendarsController" do
  include K5Common

  # ---------------------------------------------------------------------------
  # GET /calendar — k5 teacher course appears in CALENDAR.CONTEXTS js_env
  # Covers: k5_important_dates_teacher_spec.rb:124
  # ---------------------------------------------------------------------------
  describe "GET /calendar — k5 teacher contexts" do
    it "exposes k5 course context for teacher in CALENDAR.CONTEXTS js_env" do
      # Arrange
      teacher = user_factory(active_all: true)
      course = course_factory(active_all: true)
      course.account.enable_as_k5_account!
      course.enroll_teacher(teacher).accept!
      user_session(teacher)

      # Act
      get "/calendar", params: { user_id: teacher.id }

      # Assert
      expect(response).to have_http_status(:ok)
      contexts = js_env_from_response(response).dig("CALENDAR", "CONTEXTS")
      expect(contexts).not_to be_nil
      course_ctx = contexts.find { |c| c["id"].to_s == course.id.to_s }
      expect(course_ctx).not_to be_nil
      expect(course_ctx["asset_string"]).to eq(course.asset_string)
      expect(course_ctx["name"]).to eq(course.name)
    end

    # -------------------------------------------------------------------------
    # k5 teacher can create calendar events in their course context
    # Covers: k5_important_dates_teacher_spec.rb:153
    # -------------------------------------------------------------------------
    it "includes course context with can_create_calendar_events for k5 teacher" do
      # Arrange
      teacher = user_factory(active_all: true)
      course = course_factory(active_all: true, course_name: "K5 Important Dates Course")
      course.account.enable_as_k5_account!
      course.enroll_teacher(teacher).accept!
      user_session(teacher)

      # Act
      get "/calendar", params: { user_id: teacher.id }

      # Assert
      expect(response).to have_http_status(:ok)
      contexts = js_env_from_response(response).dig("CALENDAR", "CONTEXTS")
      course_ctx = contexts.find { |c| c["id"].to_s == course.id.to_s }
      expect(course_ctx).not_to be_nil
      expect(course_ctx["name"]).to eq(course.name)
      expect(course_ctx["can_create_calendar_events"]).to be(true)
    end
  end
end
