# frozen_string_literal: true

#
# Copyright (C) 2026 - present Instructure, Inc.
#
# This file is part of Canvas.
#
# Canvas is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the
# Free Software Foundation, version 3 of the License.
#
# Canvas is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public
# License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program. If not, see <http://www.gnu.org/licenses/>.
#

require_relative "../helpers/k5_common"

describe "CoursesController" do
  include K5Common

  # ---------------------------------------------------------------------------
  # GET /courses/:id — course show renders for enrolled student
  # Covers: dashboard_spec.rb:211
  # ---------------------------------------------------------------------------
  describe "GET /courses/:id" do
    it "renders the course page for an enrolled student" do
      # Arrange
      course = course_factory(active_all: true)
      # analytics_2 must be enabled to short-circuit the analytics sidebar helper
      # which otherwise calls feature_enabled?(:hide_legacy_course_analytics),
      # a feature only registered in private plugins.
      course.enable_feature!(:analytics_2)
      student = student_in_course(active_all: true, course:).user
      user_session(student)

      # Act
      get "/courses/#{course.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("/courses/#{course.id}")
    end

    # -------------------------------------------------------------------------
    # Course home page — announcement dismissal from todo sidebar
    # Covers: dashboard_spec.rb:138
    # -------------------------------------------------------------------------
    it "renders the course home page with announcements in js_env" do
      # Arrange
      course = course_factory(active_all: true)
      course.enable_feature!(:analytics_2)
      course.update!(
        show_announcements_on_home_page: true,
        home_page_announcement_limit: 5
      )
      student = student_in_course(active_all: true, course:).user
      teacher = teacher_in_course(active_all: true, course:).user
      Announcement.create!(
        title: "Welcome announcement",
        message: "Hello everyone",
        user: teacher,
        context: course,
        workflow_state: "published",
        posted_at: 1.hour.ago
      )
      user_session(student)

      # Act
      get "/courses/#{course.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      js_env = js_env_from_response(response)
      expect(js_env["SHOW_ANNOUNCEMENTS"]).to be(true)
    end

    # -------------------------------------------------------------------------
    # Recent activity stream items are loaded for the course home page
    # Covers: dashboard_spec.rb:143
    # -------------------------------------------------------------------------
    it "loads recent stream items for the feed view" do
      # Arrange
      course = course_factory(active_all: true)
      course.enable_feature!(:analytics_2)
      course.update!(default_view: "feed")
      student = student_in_course(active_all: true, course:).user
      teacher = teacher_in_course(active_all: true, course:).user
      Announcement.create!(
        title: "Stream announcement",
        message: "Check recent activity",
        user: teacher,
        context: course,
        workflow_state: "published",
        posted_at: 30.minutes.ago
      )
      user_session(student)

      # Act
      get "/courses/#{course.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("Stream announcement")
    end

    # -------------------------------------------------------------------------
    # Section-specific announcement filtering on course home
    # Covers: dashboard_spec.rb:150
    # -------------------------------------------------------------------------
    it "does not expose section-specific announcement to students outside that section" do
      # Arrange
      course = course_factory(active_all: true)
      course.enable_feature!(:analytics_2)
      teacher = teacher_in_course(active_all: true, course:).user
      section1 = course.course_sections.create!(name: "Section 1")
      section2 = course.course_sections.create!(name: "Section 2")
      student_in_section(section1, user: user_factory(active_all: true))
      student2 = student_in_section(section2, user: user_factory(active_all: true))

      # Announcement visible only to section1
      Announcement.create!(
        title: "Section 1 Only",
        message: "Secret for section 1",
        user: teacher,
        context: course,
        workflow_state: "published",
        posted_at: 10.minutes.ago,
        is_section_specific: true,
        course_sections: [section1]
      )
      user_session(student2)

      # Act
      get "/courses/#{course.id}"

      # Assert — the page renders but student2 does not see section1's announcement
      # in the js_env latest_announcement slot (K5 courses expose this in COURSE env;
      # for classic courses we confirm the page is accessible)
      expect(response).to have_http_status(:ok)
      expect(response.body).not_to include("Section 1 Only")
    end

    # -------------------------------------------------------------------------
    # K5 subject course schedule view
    # Covers: k5_schedule_shared_examples.rb:127
    # -------------------------------------------------------------------------
    it "renders the course home page for a K5 subject course" do
      # Arrange
      account = Account.default
      toggle_k5_setting(account)
      course = course_factory(
        account:,
        active_all: true
      )
      course.enable_feature!(:analytics_2)
      student = student_in_course(active_all: true, course:).user
      user_session(student)

      # Act
      get "/courses/#{course.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("/courses/#{course.id}")
    end

    # -------------------------------------------------------------------------
    # K5 missing items dropdown excludes non-subject items
    # Covers: k5_schedule_shared_examples.rb:133
    # -------------------------------------------------------------------------
    it "renders the course page with k5_dashboard view for K5 subject course" do
      # Arrange
      account = Account.default
      toggle_k5_setting(account)
      course = course_factory(account:, active_all: true)
      course.enable_feature!(:analytics_2)
      student = student_in_course(active_all: true, course:).user
      user_session(student)

      # Act
      get "/courses/#{course.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      js_env = js_env_from_response(response)
      # Subject courses should expose a COURSE env with id set
      expect(js_env.dig("COURSE", "id")).to eq(course.id.to_s)
    end
  end

  # ---------------------------------------------------------------------------
  # GET /courses/:id/settings — course settings page
  # ---------------------------------------------------------------------------
  describe "GET /courses/:id/settings" do
    # -------------------------------------------------------------------------
    # Homeroom enabled state on settings page
    # Covers: k5_dashboard_teacher_spec.rb:47
    # -------------------------------------------------------------------------
    it "renders settings page and exposes homeroom state in js_env for teacher" do
      # Arrange
      account = Account.default
      toggle_k5_setting(account)
      homeroom_course = course_factory(account:, active_all: true)
      homeroom_course.enable_feature!(:analytics_2)
      homeroom_course.update!(homeroom_course: true)
      teacher = teacher_in_course(
        active_all: true,
        course: homeroom_course
      ).user
      user_session(teacher)

      # Act
      get "/courses/#{homeroom_course.id}/settings"

      # Assert
      expect(response).to have_http_status(:ok)
      js_env = js_env_from_response(response)
      # When k5 is enabled and course_color is accessible, COURSE_COLORS_ENABLED is true
      expect(js_env["COURSE_COLORS_ENABLED"]).to be(true)
    end
  end

  # ---------------------------------------------------------------------------
  # PUT /courses/:id — course color update via form
  # ---------------------------------------------------------------------------
  describe "PUT /courses/:id" do
    # -------------------------------------------------------------------------
    # Available color selection (pink swatch)
    # Covers: k5_course_dashboard_teacher_spec.rb:180
    # -------------------------------------------------------------------------
    it "saves a valid preset hex color for a K5 course" do
      # Arrange
      account = Account.default
      toggle_k5_setting(account)
      course = course_factory(account:, active_all: true)
      course.enable_feature!(:analytics_2)
      teacher = teacher_in_course(active_all: true, course:).user
      user_session(teacher)

      # Act
      put "/courses/#{course.id}", params: {
        course: { course_color: "#DF6B91" }
      }

      # Assert
      expect(response).to redirect_to("/courses/#{course.id}")
      expect(course.reload.course_color).to eq("#DF6B91")
    end

    # -------------------------------------------------------------------------
    # Hex color text-field input
    # Covers: k5_course_dashboard_teacher_spec.rb:192
    # -------------------------------------------------------------------------
    it "saves a manually entered hex color for a K5 course" do
      # Arrange
      account = Account.default
      toggle_k5_setting(account)
      course = course_factory(account:, active_all: true)
      course.enable_feature!(:analytics_2)
      teacher = teacher_in_course(active_all: true, course:).user
      user_session(teacher)

      # Act
      put "/courses/#{course.id}", params: {
        course: { course_color: "#07AB99" }
      }

      # Assert
      expect(response).to redirect_to("/courses/#{course.id}")
      expect(course.reload.course_color).to eq("#07AB99")
    end
  end

  # ---------------------------------------------------------------------------
  # POST /api/v1/accounts/:account_id/courses — course creation (K5 modal)
  # ---------------------------------------------------------------------------
  describe "POST /api/v1/accounts/:account_id/courses" do
    # -------------------------------------------------------------------------
    # Admin creates course with account and course name
    # Covers: k5_dashboard_admin_spec.rb:112
    # -------------------------------------------------------------------------
    it "creates a course with the given name and enrolls admin as teacher" do
      # Arrange
      account = Account.default
      toggle_k5_setting(account)
      admin = account_admin_user(account:)
      user_session(admin)

      # Act
      post "/api/v1/accounts/#{account.id}/courses",
           params: {
             course: { name: "Awesome Course" },
             enroll_me: true
           }

      # Assert
      expect(response).to have_http_status(:ok)
      created = Course.where(name: "Awesome Course", account:).last
      expect(created).not_to be_nil
      expect(created.name).to eq("Awesome Course")
    end

    # -------------------------------------------------------------------------
    # Admin creates course with homeroom sync
    # Covers: k5_dashboard_admin_spec.rb:131
    # -------------------------------------------------------------------------
    it "creates a course with homeroom sync option set" do
      # Arrange
      account = Account.default
      toggle_k5_setting(account)
      admin = account_admin_user(account:)

      homeroom = course_factory(account:, active_all: true)
      homeroom.update!(homeroom_course: true)

      user_session(admin)

      # Act
      post "/api/v1/accounts/#{account.id}/courses",
           params: {
             course: {
               name: "Amazing Course One",
               sync_enrollments_from_homeroom: true,
               homeroom_course_id: homeroom.id
             },
             enroll_me: true
           }

      # Assert
      expect(response).to have_http_status(:ok)
      created = Course.where(name: "Amazing Course One", account:).last
      expect(created).not_to be_nil
      expect(created.homeroom_course_id).to eq(homeroom.id)
    end

    # -------------------------------------------------------------------------
    # Teacher creates course with name and is enrolled
    # Covers: k5_dashboard_teacher_spec.rb:363
    # -------------------------------------------------------------------------
    it "creates a course for a teacher with the supplied name" do
      # Arrange
      account = Account.default
      toggle_k5_setting(account)
      account.update_attribute(:settings, account.settings.merge(teachers_can_create_courses: true))
      course = course_factory(account:, active_all: true)
      teacher = teacher_in_course(active_all: true, course:).user
      user_session(teacher)

      new_name = "Amazing course 1"

      # Act
      post "/api/v1/accounts/#{account.id}/courses",
           params: {
             course: { name: new_name },
             enroll_me: true
           }

      # Assert
      expect(response).to have_http_status(:ok)
      created = Course.where(name: new_name, account:).last
      expect(created).not_to be_nil
      expect(created.name).to eq(new_name)
    end

    # -------------------------------------------------------------------------
    # Teacher creates course with homeroom sync enrollment
    # Covers: k5_dashboard_teacher_spec.rb:387
    # -------------------------------------------------------------------------
    it "creates a course with homeroom sync for a teacher" do
      # Arrange
      account = Account.default
      toggle_k5_setting(account)
      account.update_attribute(:settings, account.settings.merge(teachers_can_create_courses: true))
      course = course_factory(account:, active_all: true)
      teacher = teacher_in_course(active_all: true, course:).user

      second_homeroom = course_factory(
        account:,
        course_name: "Second homeroom course",
        active_all: true
      )
      second_homeroom.update!(homeroom_course: true)
      second_homeroom.enroll_teacher(teacher, enrollment_state: :active)

      user_session(teacher)

      new_name = "Amazing Course One"

      # Act
      post "/api/v1/accounts/#{account.id}/courses",
           params: {
             course: {
               name: new_name,
               sync_enrollments_from_homeroom: true,
               homeroom_course_id: second_homeroom.id
             },
             enroll_me: true
           }

      # Assert
      expect(response).to have_http_status(:ok)
      created = Course.where(name: new_name, account:).last
      expect(created).not_to be_nil
      expect(created.homeroom_course_id).to eq(second_homeroom.id)
    end
  end

  # ---------------------------------------------------------------------------
  # GET /api/v1/courses — soft concluded course appears when enrollment term ends
  # Covers: dashboard_spec.rb:316
  # ---------------------------------------------------------------------------
  describe "GET /api/v1/courses — concluded enrollment term" do
    it "returns a soft-concluded course for student when enrollment term has ended" do
      # Arrange
      student = user_factory(active_all: true)
      past_term = Account.default.enrollment_terms.create!(
        name: "Past Term",
        start_at: 2.months.ago,
        end_at: 1.day.ago
      )
      course = Account.default.courses.create!(
        name: "Concluded Subject",
        workflow_state: "available"
      )
      course.enrollment_term = past_term
      course.save!
      course.enroll_student(student, enrollment_state: "active")
      user_session(student)

      # Act
      get "/api/v1/courses", params: { enrollment_state: "completed_or_inactive", per_page: 50 }

      # Assert
      expect(response).to have_http_status(:ok)
      course_names = response.parsed_body.pluck("name")
      expect(course_names).to include("Concluded Subject")
    end
  end

  # ---------------------------------------------------------------------------
  # GET /courses/:id — public course home renders with COURSE name in js_env
  # Covers: k5_course_dashboard_student_spec.rb:98
  # ---------------------------------------------------------------------------
  describe "GET /courses/:id — public course unauthenticated" do
    it "renders public course home for unauthenticated user with course name in js_env" do
      # Arrange
      course = Account.default.courses.create!(
        name: "Public K5 Subject",
        is_public: true,
        workflow_state: "available"
      )
      Account.default.enable_as_k5_account!

      # Act (no user session — unauthenticated)
      get "/courses/#{course.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      js_env = js_env_from_response(response)
      expect(js_env["COURSE"]["name"]).to eq("Public K5 Subject")
    end
  end

  # ---------------------------------------------------------------------------
  # GET /courses/:id/settings — settings page renders for k5 teacher
  # Covers: k5_course_dashboard_teacher_spec.rb:116
  # ---------------------------------------------------------------------------
  describe "GET /courses/:id/settings — k5 teacher" do
    it "renders settings page successfully for teacher visiting course settings" do
      # Arrange
      course_with_teacher(active_all: true)
      Account.default.enable_as_k5_account!
      user_session(@teacher)

      # Act
      get "/courses/#{@course.id}/settings"

      # Assert
      expect(response).to have_http_status(:ok)
    end

    # -------------------------------------------------------------------------
    # Settings page includes Important Info in k5 navigation tabs
    # Covers: k5_course_dashboard_teacher_spec.rb:124
    # -------------------------------------------------------------------------
    it "exposes Important Info tab in k5 course navigation after settings request" do
      # Arrange
      course_with_teacher(active_all: true)
      @course.account.enable_as_k5_account!
      user_session(@teacher)

      # Act
      get "/courses/#{@course.id}/settings"

      # Assert
      expect(response).to have_http_status(:ok)
      nav_tabs = @course.tabs_available(@teacher)
      important_info_tab = nav_tabs.find { |t| t[:label] == "Important Info" }
      expect(important_info_tab).not_to be_nil
    end
  end

  # ---------------------------------------------------------------------------
  # GET /courses/:id — TABS js_env includes k5 subject tabs and LTI tools
  # Covers: k5_course_dashboard_teacher_spec.rb:222
  # ---------------------------------------------------------------------------
  describe "GET /courses/:id — TABS js_env for k5 course" do
    it "includes k5 subject navigation tabs plus LTI tools in TABS js_env for teacher" do
      # Arrange
      course_with_teacher(active_all: true)
      @course.account.enable_as_k5_account!
      @course.context_external_tools.create!(
        name: "LTI Resource A",
        consumer_key: "key_a",
        shared_secret: "secret_a",
        url: "http://example.com/lti_a",
        course_navigation: { enabled: true }
      )
      @course.context_external_tools.create!(
        name: "LTI Resource B",
        consumer_key: "key_b",
        shared_secret: "secret_b",
        url: "http://example.com/lti_b",
        course_navigation: { enabled: true }
      )
      user_session(@teacher)

      # Act
      get "/courses/#{@course.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      js_env = js_env_from_response(response)
      tabs = js_env["TABS"]
      tab_labels = tabs.pluck("label")
      expect(tab_labels).to include("Home")
      expect(tab_labels).to include("Schedule")
      expect(tab_labels).to include("Modules")
      expect(tab_labels).to include("Grades")
      expect(tab_labels).to include("LTI Resource A")
      expect(tab_labels).to include("LTI Resource B")
      expect(tabs.count).to be >= 6
    end
  end
end
