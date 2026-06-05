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

describe "UsersController" do
  # ---------------------------------------------------------------------------
  # PATCH user color API updates hex color for a course calendar asset
  # Covers: spec/selenium/dashcards_spec.rb:220
  # ---------------------------------------------------------------------------
  describe "PUT /api/v1/users/:id/colors/:asset_string" do
    it "updates the course calendar color to the provided hex value for the user" do
      # Arrange
      course1 = course_factory(active_all: true)
      student = student_in_course(active_all: true, course: course1).user
      user_session(student)
      asset_string = course1.asset_string

      # Act
      put "/api/v1/users/#{student.id}/colors/#{asset_string}",
          params: { hexcode: "#0B9BE3" }

      # Assert
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json["hexcode"]).to eq("#0B9BE3")
      expect(student.reload.custom_colors[asset_string]).to eq("#0B9BE3")
    end
  end
end
