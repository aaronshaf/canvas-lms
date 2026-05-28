# frozen_string_literal: true

#
# Copyright (C) 2011 - present Instructure, Inc.
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

require_relative "../common"
require_relative "../../helpers/k5_common"

describe "courses" do
  include_context "in-process server selenium tests"
  include K5Common

  context "as a teacher" do
    before do
      account = Account.default
      account.settings = { open_registration: true, no_enrollments_can_create_courses: true, teachers_can_create_courses: true }
      account.save!
      account.disable_feature!(:new_user_tutorial)
    end

    context "draft state" do
      before do
        course_with_teacher_logged_in
        @course.default_view = "feed"
        @course.save
      end

      def validate_action_button(validation_text)
        f("#course_publish_button button").click
        action_button = f("div[role='menu'][aria-label='course_publish_menu'] button:not([aria-disabled])")
        expect(action_button.text).to eq validation_text
        # Close menu
        f("#course_publish_button button").click
      end

      it "displays a creative commons license when set", priority: "1" do
        @course.license = "cc_by_sa"
        @course.save!
        get "/courses/#{@course.id}"
        wait_for_ajaximations
        expect(f(".public-license-text").text).to include("This course content is offered under a")
      end

      it "does not show course status if published and graded submissions exist" do
        course_with_student_submissions({ submission_points: true })
        @course.default_view = "feed"
        @course.save
        get "/courses/#{@course.id}"
        expect(f("#content")).not_to contain_css("#course_publish_button")
      end
    end

    it "redirects to the gradebook when switching courses when viewing a students grades" do
      teacher = user_with_pseudonym(username: "teacher@example.com", active_all: 1)
      student = user_with_pseudonym(username: "student@example.com", active_all: 1)

      course1 = course_with_teacher_logged_in(user: teacher, active_all: 1, course_name: "course1").course
      student_in_course(user: student, active_all: 1)

      course2 = course_with_teacher(user: teacher, active_all: 1, course_name: "course2").course
      student_in_course(user: student, active_all: 1)

      create_session(student.pseudonyms.first)

      get "/courses/#{course1.id}/grades/#{student.id}"

      select = f("#course_select_menu")
      options = INSTUI_Select_options(select)
      expect(options.length).to eq 2

      click_option("#course_select_menu", course2.name)
      expect_new_page_load { f("#apply_select_menus").click }
      expect(f("#breadcrumbs .home + li a")).to include_text(course2.name)
    end

    it "only shows users that a user has permissions to view" do
      # Set up the test
      course_factory(active_course: true)
      %w[One Two].each do |name|
        section = @course.course_sections.create!(name:)
        @course.enroll_student(user_factory, section:).accept!
      end
      user_logged_in
      enrollment = @course.enroll_ta(@user)
      enrollment.accept!
      enrollment.update(limit_privileges_to_course_section: true,
                        course_section: CourseSection.where(name: "Two").first)

      # Test that only users in the approved section are displayed.
      get "/courses/#{@course.id}/users"
      wait_for_ajaximations
      wait_for(method: nil, timeout: 5) do
        expect(ff(".roster .rosterUser").length).to eq 2
      end
    end

    it "displays users section name" do
      course_with_teacher_logged_in(active_all: true)
      user1, user2 = [user_factory, user_factory]
      section1 = @course.course_sections.create!(name: "One")
      section2 = @course.course_sections.create!(name: "Two")
      @course.enroll_student(user1, section: section1).accept!
      [section1, section2].each do |section|
        e = user2.student_enrollments.build
        e.workflow_state = "active"
        e.course = @course
        e.course_section = section
        e.save!
      end

      get "/courses/#{@course.id}/users"
      wait_for_ajaximations
      sections = ff(".roster .section")
      expect(sections.map(&:text).sort).to eq ["One", "One", "Two", "Unnamed Course", "Unnamed Course"]
    end
  end

  context "course as a student" do
    def enroll_student(student, accept_invitation)
      if accept_invitation
        @course.enroll_student(student).accept
      else
        @course.enroll_student(student)
      end
    end

    before do
      course_with_teacher(active_all: true, name: "discussion course")
      @student = user_with_pseudonym(active_user: true, username: "student@example.com", name: "student@example.com", password: "asdfasdf")
      Account.default.settings[:allow_invitation_previews] = true
      Account.default.save!
    end

    it "displays user groups on courses page" do
      group = Group.create!(name: "group1", context: @course)
      group.add_user(@student)
      enroll_student(@student, true)

      create_session(@student.pseudonym)
      get "/courses"

      content = f("#content")
      expect(content).to include_text("My Groups")
      expect(content).to include_text("group1")
    end

    it "does not display global nav on k5 subject with embed mode enabled" do
      toggle_k5_setting(@course.account)
      enroll_student(@student, true)
      user_session(@student)
      get "/courses/#{@course.id}?embed=true"

      expect(element_exists?("header")).to be_falsey
    end
  end

  context "announcements on course home" do
    before :once do
      course_with_teacher active_all: true

      @text = "here's some html or whatever"
      @html = "<p>#{@text}</p>"
      @course.announcements.create!(title: "something", message: @html)

      @course.wiki_pages.create!(title: "blah").set_as_front_page!

      @course.reload
      @course.default_view = "wiki"
      @course.show_announcements_on_home_page = true
      @course.home_page_announcement_limit = 5
      @course.save!
    end

    before do
      user_session @teacher
    end

    it "is displayed if enabled and is wiki" do
      get "/courses/#{@course.id}"

      expect(f("#announcements_on_home_page")).to be_displayed
      expect(f("#announcements_on_home_page")).to include_text(@text)
      expect(f("#announcements_on_home_page")).not_to include_text(@html)
    end

    %w[wiki syllabus feed assignments modules].each do |view|
      it "displays with an h2 header when course home is #{view}" do
        @course.update_column(:default_view, view)
        get "/courses/#{@course.id}"
        expect(f("#announcements_on_home_page h2")).to include_text("Recent Announcements")
      end
    end

    it "does not show on k5 subject even with setting on" do
      toggle_k5_setting(@course.account)
      get "/courses/#{@course.id}"

      expect(f("#content")).not_to contain_css("#announcements_on_home_page")
    end
  end
end
