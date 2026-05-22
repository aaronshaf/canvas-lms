# frozen_string_literal: true

#
# Copyright (C) 2024 - present Instructure, Inc.
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

describe SectionsController, type: :request do
  describe "user_count" do
    before do
      course_with_teacher_logged_in(active_all: true)
      @section1 = @course.course_sections.create!(name: "Section1")
      @section2 = @course.course_sections.create!(name: "Section2")

      @student1 = user_with_pseudonym(active_all: true, name: "Student1", username: "student1@instructure.com")
      @student2 = user_with_pseudonym(active_all: true, name: "Student2", username: "student2@instructure.com")
    end

    it "should return the user count for each sections in a course" do
      @section1.enroll_user(@student1, "TeacherEnrollment")
      @section1.enroll_user(@student2, "StudentEnrollment")
      @section2.enroll_user(@student1, "StudentEnrollment")

      get "/courses/#{@course.id}/sections/user_count"

      json_response = response.parsed_body

      sec1 = json_response["sections"].find { |s| s["id"] == @section1.id }
      sec2 = json_response["sections"].find { |s| s["id"] == @section2.id }

      expect(sec1["user_count"]).to eq(2)
      expect(sec2["user_count"]).to eq(1)
    end

    it "should return the user count for each sections in a course not counting deleted users" do
      @section1.enroll_user(@student1, "TeacherEnrollment")
      @section1.enroll_user(@student2, "StudentEnrollment")
      @section2.enroll_user(@student1, "StudentEnrollment")
      @student2.destroy

      get "/courses/#{@course.id}/sections/user_count"

      json_response = response.parsed_body

      sec1 = json_response["sections"].find { |s| s["id"] == @section1.id }
      sec2 = json_response["sections"].find { |s| s["id"] == @section2.id }

      expect(sec1["user_count"]).to eq(1)
      expect(sec2["user_count"]).to eq(1)
    end

    it "should exclude sections if the section id is sent in the exclude param" do
      @section1.enroll_user(@teacher, "TeacherEnrollment")
      @section1.enroll_user(@student1, "StudentEnrollment")
      @section2.enroll_user(@student2, "StudentEnrollment")

      get "/courses/#{@course.id}/sections/user_count", params: { exclude: ["section_#{@section1.id}"] }

      json_response = response.parsed_body

      sec1 = json_response["sections"].find { |s| s["id"] == @section1.id }
      sec2 = json_response["sections"].find { |s| s["id"] == @section2.id }

      expect(sec1).to be_nil
      expect(sec2["user_count"]).to eq(1)
    end

    it "should exclude section if name does not match the search term" do
      get "/courses/#{@course.id}/sections/user_count", params: { search: "ion1" }

      json_response = response.parsed_body

      sec1 = json_response["sections"].find { |s| s["id"] == @section1.id }
      sec2 = json_response["sections"].find { |s| s["id"] == @section2.id }

      expect(sec1["user_count"]).to eq(0)
      expect(sec2).to be_nil
    end

    context "authorization" do
      it "blocks an authenticated user with no roster access from reading section counts" do
        unauthorized_user = user_with_pseudonym(active_all: true, name: "Unauthorized", username: "unauth-user-count@test.com")
        user_session(unauthorized_user)

        get "/courses/#{@course.id}/sections/user_count.json"

        expect(response).to have_http_status(:forbidden)
      end
    end

    context "section-level visibility filtering for students" do
      it "returns only sections the student is enrolled in" do
        student = user_with_pseudonym(active_all: true, name: "Student", username: "student-visibility@test.com")
        @section1.enroll_user(student, "StudentEnrollment", enrollment_state: "active")
        user_session(student)

        get "/courses/#{@course.id}/sections/user_count.json"

        expect(response).to have_http_status(:ok)
        returned_ids = response.parsed_body["sections"].pluck("id")
        expect(returned_ids).to include(@section1.id)
        expect(returned_ids).not_to include(@section2.id)
      end
    end

    context "section-level visibility filtering for section-restricted TAs" do
      it "returns only the sections the TA is enrolled in when restricted to their section" do
        restricted_ta = user_with_pseudonym(active_all: true, name: "Restricted TA", username: "restricted-ta-user-count@test.com")
        ta_enrollment = @section1.enroll_user(restricted_ta, "TaEnrollment", enrollment_state: "active")
        ta_enrollment.update!(limit_privileges_to_course_section: true)
        user_session(restricted_ta)

        get "/courses/#{@course.id}/sections/user_count.json"

        expect(response).to have_http_status(:ok)
        returned_ids = response.parsed_body["sections"].pluck("id")
        expect(returned_ids).to include(@section1.id)
        expect(returned_ids).not_to include(@section2.id)
      end
    end
  end

  describe "GET users" do
    before :once do
      course_with_teacher(active_all: true)
      @course.root_account.set_service_availability(:avatars, true)
      @course.root_account.save!

      @student1 = user_with_pseudonym(active_all: true, name: "Alice Student", username: "alice@test.com")
      @student2 = user_with_pseudonym(active_all: true, name: "Bob Student", username: "bob@test.com")
      @student3 = user_with_pseudonym(active_all: true, name: "Charlie Student", username: "charlie@test.com")
      @ta = user_with_pseudonym(active_all: true, name: "TA User", username: "ta@test.com")

      @section = @course.course_sections.create!(name: "Test Section")
      @section.enroll_user(@student1, "StudentEnrollment", "active")
      @section.enroll_user(@student2, "StudentEnrollment", "active")
      @section.enroll_user(@student3, "StudentEnrollment", "inactive")
      @section.enroll_user(@ta, "TaEnrollment", "active")
    end

    before { course_with_teacher_logged_in(active_all: true, course: @course) }

    it "returns all users in the section" do
      get "/api/v1/sections/#{@section.id}/users"

      expect(response).to be_successful
      expect(response.parsed_body.pluck("id")).to match_array([@student1.id, @student2.id, @student3.id, @ta.id])
    end

    it "returns users matching search_term" do
      get "/api/v1/sections/#{@section.id}/users", params: { search_term: "Alice" }

      json_response = response.parsed_body
      expect(response).to be_successful
      expect(json_response.length).to eq(1)
      expect(json_response.first["id"]).to eq(@student1.id)
      expect(json_response.first["name"]).to eq(@student1.name)
    end

    it "returns users matching partial search_term" do
      get "/api/v1/sections/#{@section.id}/users", params: { search_term: "Student" }

      expect(response).to be_successful
      expect(response.parsed_body.pluck("id")).to match_array([@student1.id, @student2.id, @student3.id])
    end

    it "excludes inactive enrollments when exclude_inactive is true" do
      get "/api/v1/sections/#{@section.id}/users", params: { exclude_inactive: true }

      expect(response).to be_successful
      expect(response.parsed_body.pluck("id")).to match_array([@student1.id, @student2.id, @ta.id])
    end

    it "includes inactive enrollments when exclude_inactive is false" do
      get "/api/v1/sections/#{@section.id}/users", params: { exclude_inactive: false }

      expect(response).to be_successful
      expect(response.parsed_body.pluck("id")).to match_array([@student1.id, @student2.id, @student3.id, @ta.id])
    end

    it "filters users by enrollment_type student" do
      get "/api/v1/sections/#{@section.id}/users", params: { enrollment_type: "student" }

      expect(response).to be_successful
      expect(response.parsed_body.pluck("id")).to match_array([@student1.id, @student2.id, @student3.id])
    end

    it "filters users by enrollment_type ta" do
      get "/api/v1/sections/#{@section.id}/users", params: { enrollment_type: "ta" }

      expect(response).to be_successful
      expect(response.parsed_body.pluck("id")).to match_array([@ta.id])
    end

    it "combines search_term with enrollment_type filter" do
      get "/api/v1/sections/#{@section.id}/users", params: { search_term: "li", enrollment_type: "student" }

      expect(response).to be_successful
      expect(response.parsed_body.pluck("id")).to match_array([@student1.id, @student3.id])
    end

    it "combines exclude_inactive with enrollment_type filter" do
      get "/api/v1/sections/#{@section.id}/users", params: { exclude_inactive: true, enrollment_type: "student" }

      expect(response).to be_successful
      expect(response.parsed_body.pluck("id")).to match_array([@student1.id, @student2.id])
    end

    it "includes avatar_url when requested" do
      get "/api/v1/sections/#{@section.id}/users", params: { include: ["avatar_url"] }

      json_response = response.parsed_body
      expect(response).to be_successful
      expect(json_response).not_to be_empty
      expect(json_response).to all(have_key("avatar_url"))
    end

    it "returns paginated results" do
      15.times do |i|
        student = user_with_pseudonym(active_all: true, name: "Student #{i}", username: "student#{i}@test.com")
        @section.enroll_user(student, "StudentEnrollment", "active")
      end

      get "/api/v1/sections/#{@section.id}/users", params: { per_page: 5 }

      expect(response).to be_successful
      json_response = response.parsed_body
      expect(json_response.length).to eq(5)
      expect(response.headers["Link"]).to be_present
    end

    it "returns 404 for non-existent section" do
      get "/api/v1/sections/999999/users"

      expect(response).to have_http_status(:not_found)
    end

    it "returns 404 for deleted section" do
      @section.destroy

      get "/api/v1/sections/#{@section.id}/users"

      expect(response).to have_http_status(:not_found)
    end

    context "authorization" do
      it "blocks users who are not enrolled in the section from using the endpoint" do
        unauthorized_user = user_with_pseudonym(active_all: true, name: "Unauthorized", username: "unauth@test.com")
        user_session(unauthorized_user)

        get "/api/v1/sections/#{@section.id}/users"

        expect(response).to have_http_status(:forbidden)
      end

      context "when TA is section-limited" do
        it "blocks section-limited TA from listing users in other sections" do
          section_limited_ta = user_with_pseudonym(name: "Section Limited TA", active_all: true)
          other_section = @course.course_sections.create!(name: "Other Section")
          ta_enrollment = other_section.enroll_user(section_limited_ta, "TaEnrollment", "active")
          ta_enrollment.update!(limit_privileges_to_course_section: true)
          user_session(section_limited_ta)

          get "/api/v1/sections/#{@section.id}/users"

          expect(response).to have_http_status(:forbidden)
          expect(response.parsed_body["error"]).to eq("section is not visible to the current user")
        end
      end

      context "when the student has no :read_roster permission for the course" do
        it "blocks student from listing users in the section" do
          Account.default.role_overrides.create!(permission: :read_roster, role: student_role, enabled: false)
          user_session(@student1)

          get "/api/v1/sections/#{@section.id}/users"

          expect(response).to have_http_status(:forbidden)
        end
      end
    end
  end
end
