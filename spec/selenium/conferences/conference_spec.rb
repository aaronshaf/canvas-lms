# frozen_string_literal: true

#
# Copyright (C) 2015 - present Instructure, Inc.
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
require_relative "../helpers/conferences_common"
require_relative "../helpers/public_courses_context"

describe "Web conferences" do
  include_context "in-process server selenium tests"
  include ConferencesCommon
  include WebMock::API

  before(:once) do
    initialize_wimba_conference_plugin
    course_with_teacher(name: "Teacher Bob", active_all: true)
    course_with_ta(name: "TA Alice", course: @course, active_all: true)
    4.times do |i|
      course_with_student(name: "Student_#{i + 1}", course: @course, active_all: true)
    end
  end

  before do
    user_session(@teacher)
  end

  after do
    accept_alert if alert_present?
    close_extra_windows
  end

  it "disables unchangeable properties when conference has begun" do
    conf = create_wimba_conference
    conf.started_at = 1.hour.ago
    conf.end_at = 1.day.from_now
    conf.save!

    get conferences_index_page
    fj("li.conference a:contains('Settings')").click
    fj("a:contains('Edit')").click
    expect(f("span[data-testid='duration-input'] input")).to be_disabled
    expect(f("input[value='no_time_limit']")).to be_disabled
  end
end
