# frozen_string_literal: true

#
# Copyright (C) 2025 - present Instructure, Inc.
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
require_relative "pages/admin_dashboard_page"
require_relative "pages/accessibility_checker_page"
require_relative "support/dashboard_data_factory"

describe "Accessibility Checker - Admin Dashboard", :ignore_js_errors do
  include_context "in-process server selenium tests"
  include AdminDashboardPage
  include AccessibilityCheckerPage
  include AccessibilityChecker::DashboardDataFactory

  def visit_admin_dashboard
    get "/accounts/#{@account.id}/accessibility"
    wait_for_ajaximations
  end

  before(:once) do
    @account = Account.default
    Account.site_admin.enable_feature!(:a11y_checker_account_statistics)
    @account.enable_feature!(:a11y_checker)
    @account.enable_feature!(:a11y_checker_ga1)
    @admin = account_admin_user(account: @account)
  end

  before do
    user_session(@admin)
    visit_admin_dashboard
    wait_for_dashboard_to_load
  end

  context "Sorting" do
    let(:first_course_identifier) { dashboard_course_name_for(:fall_course) }
    let(:last_course_identifier) { dashboard_course_name_for(:spring_course) }

    before(:once) do
      spring_term = create_enrollment_term(@account, :spring_term)
      fall_term = create_enrollment_term(@account, :fall_term)
      create_course_with_statistic(@account, :fall_course, term_id: fall_term.id)
      create_course_with_statistic(@account, :spring_course, term_id: spring_term.id)
    end

    it "sorts courses by issue count descending" do
      sort_descending(column_label(:issues))
      names = course_names_in_order
      expect(course_index(names, last_course_identifier)).to be < course_index(names, first_course_identifier)
    end

    it "sorts courses by resolved issue count ascending" do
      sort_ascending(column_label(:resolved))
      names = course_names_in_order
      expect(course_index(names, last_course_identifier)).to be < course_index(names, first_course_identifier)
    end

    it "sorts courses by term descending" do
      sort_descending(column_label(:term))
      names = course_names_in_order
      expect(course_index(names, last_course_identifier)).to be < course_index(names, first_course_identifier)
    end

    it "sorts courses by status descending" do
      sort_descending(column_label(:status))
      names = course_names_in_order
      expect(course_index(names, last_course_identifier)).to be < course_index(names, first_course_identifier)
    end
  end

  context "Course navigation" do
    let(:course_name) { dashboard_course_name_for(:fall_course) }

    before(:once) do
      create_dashboard_course(@account, :fall_course)
      enable_accessibility_checker(@course)
    end

    it "clicking a course name navigates to the course accessibility checker" do
      click_course_name(course_name)
      wait_for_accessibility_checker_to_load

      expect(scan_course_button.displayed?).to be true
    end
  end
end
