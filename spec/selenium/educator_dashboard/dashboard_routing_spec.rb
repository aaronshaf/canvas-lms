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

require_relative "../common"
require_relative "../../helpers/k5_common"

describe "educator dashboard routing", :ignore_js_errors do
  include_context "in-process server selenium tests"
  include K5Common

  def educator_dashboard_selector
    '[data-testid="educator-widget-dashboard"]'
  end

  def educator_dashboard_displayed?
    element_exists?(educator_dashboard_selector)
  end

  before :once do
    Account.default.enable_feature!(:educator_dashboard)
    @course = course_factory(active_all: true)
    @teacher = user_factory(active_all: true)
    @course.enroll_teacher(@teacher, enrollment_state: :active)
  end

  describe "rendering" do
    context "does not show" do
      it "does not render for observer", custom_timeout: 25 do
        observer = user_factory(active_all: true)
        @course.enroll_user(observer, "ObserverEnrollment", enrollment_state: :active)
        user_session(observer)
        get "/"
        wait_for_ajaximations
        expect(educator_dashboard_displayed?).to be false
      end
    end

    context "shows" do
      it "renders for invited teacher", custom_timeout: 25 do
        teacher = user_factory(active_all: true)
        enrollment = @course.enroll_teacher(teacher, enrollment_state: :active)
        enrollment.update!(workflow_state: "invited")
        user_session(teacher)
        get "/"
        expect(educator_dashboard_displayed?).to be true
      end
    end
  end
end
