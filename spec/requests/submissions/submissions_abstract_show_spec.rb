# frozen_string_literal: true

#
# Copyright (C) 2018 - present Instructure, Inc.
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

RSpec.describe "assignment resolution for submission preview" do
  describe "GET /courses/:course_id/assignments/:assignment_id/submissions/:id" do
    let(:course) { course_factory(active_course: true) }
    let(:student) { student_in_course(course:, active_all: true).user }
    let(:assignment) { course.assignments.create!(title: "Test Assignment") }

    before { user_session(student) }

    it "renders the preview when the assignment is active" do
      get "/courses/#{course.id}/assignments/#{assignment.id}/submissions/#{student.id}",
          params: { preview: true }
      expect(response).to have_http_status(:ok)
      expect(response.body).to include(assignment.title)
    end

    it "redirects to the course when the assignment has been deleted" do
      assignment.destroy!
      get "/courses/#{course.id}/assignments/#{assignment.id}/submissions/#{student.id}",
          params: { preview: true }
      expect(response).to have_http_status(:found)
      expect(response.headers["Location"]).to include("/courses/#{course.id}")
    end

    it "redirects to the course when the assignment belongs to a different course" do
      other_course = course_factory(active_course: true)
      other_assignment = other_course.assignments.create!
      get "/courses/#{course.id}/assignments/#{other_assignment.id}/submissions/#{student.id}",
          params: { preview: true }
      expect(response).to have_http_status(:found)
      expect(response.headers["Location"]).to include("/courses/#{course.id}")
    end
  end
end
