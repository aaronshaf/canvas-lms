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

describe "FilesController" do
  # ---------------------------------------------------------------------------
  # Files index renders for enrolled student
  # Covers: spec/selenium/dashcards_spec.rb:99
  # ---------------------------------------------------------------------------
  describe "GET /courses/:course_id/files" do
    it "renders the files index page for an enrolled student" do
      # Arrange
      course = course_factory(active_all: true)
      student = student_in_course(active_all: true, course:).user
      folder = Folder.root_folders(course).first
      attachment_model(
        context: course,
        folder:,
        filename: "course_doc.txt",
        content_type: "text/plain"
      )
      user_session(student)

      # Act
      get "/courses/#{course.id}/files"

      # Assert
      expect(response).to have_http_status(:ok)
      js_env = js_env_from_response(response)
      contexts = js_env["FILES_CONTEXTS"] || []
      expect(contexts.first["name"]).to eq(course.name)
    end
  end
end
