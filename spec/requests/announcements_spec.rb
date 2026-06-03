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

describe 'AnnouncementsController' do
  # ---------------------------------------------------------------------------
  # Announcements index renders for enrolled student
  # Covers: spec/selenium/dashcards_spec.rb:72
  # ---------------------------------------------------------------------------
  describe 'GET /courses/:course_id/announcements' do
    it 'renders the announcements index page for an enrolled student' do
      # Arrange
      course = course_factory(active_all: true)
      teacher = teacher_in_course(active_all: true, course:).user
      student = student_in_course(active_all: true, course:).user
      course.announcements.create!(
        title: 'Welcome Announcement',
        message: 'Hello class',
        user: teacher
      )
      user_session(student)

      # Act
      get "/courses/#{course.id}/announcements"

      # Assert
      expect(response).to have_http_status(:ok)
      js_env = js_env_from_response(response)
      expect(js_env['is_showing_announcements']).to be(true)
    end
  end
end
