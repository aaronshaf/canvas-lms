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

describe "cross-listing" do
  include_context "in-process server selenium tests"

  before do
    course_with_teacher_logged_in
    @course1       = @course
    @course2       = course_with_teacher(
      active_course: true,
      user: @user,
      active_enrollment: true
    ).course

    @course2.update_attribute(:name, "Course 2")
    @section = @course1.course_sections.first
    get "/courses/#{@course1.id}/sections/#{@section.id}"
  end

  it "allows cross-listing a section redux" do
    # so, we have two courses with the teacher enrolled in both.
    course_with_teacher_logged_in
    course = @course
    other_course = course_with_teacher(active_course: true,
                                       user: @user,
                                       active_enrollment: true).course
    other_course.update_attribute(:name, "cool course")
    section = course.course_sections.first

    # we visit the first course's section. the teacher is enrolled in this
    # section. we're going to crosslist it.
    get "/courses/#{course.id}/sections/#{section.id}"
    f("[data-testid='crosslist-trigger-button']").click
    wait_for_ajaximations

    # Crosslist to the other course
    course_id_input = f("[data-testid='course-id-input']")
    replace_content(course_id_input, other_course.id.to_s)
    course_id_input.send_keys(:tab)
    wait_for_ajaximations

    expect(f("[data-testid='selected-course-name']")).to include_text other_course.name
    expect(f("[data-testid='confirmed-course-id']")).to have_attribute(:value, other_course.id.to_s)

    f("[data-testid='crosslist-submit-button']").click
    wait_for_ajaximations
    keep_trying_until { driver.current_url.match(%r{courses/#{other_course.id}}) }

    # yay, so, now the teacher is not enrolled in the first course (the section
    # they were enrolled in got moved). they don't have the rights to
    # uncrosslist.
    get "/courses/#{other_course.id}/sections/#{section.id}"
    expect(f("#content")).not_to contain_css('[data-testid="uncrosslist-trigger-button"]')

    # enroll, and make sure the teacher can uncrosslist.
    course.enroll_teacher(@user).accept
    get "/courses/#{other_course.id}/sections/#{section.id}"
    f('[data-testid="uncrosslist-trigger-button"]').click
    expect(f('[data-testid="uncrosslist-submit-button"]')).to be_displayed
    # Actually going through the uncrosslist process makes this test take too long and
    # it times out. We've already tested decrosslisting, so just checking that the
    # button appears is sufficient.
    # f('[data-testid="uncrosslist-submit-button"]').click
    # keep_trying_until { driver.current_url.match(%r{courses/#{course.id}}) }
  end
end
