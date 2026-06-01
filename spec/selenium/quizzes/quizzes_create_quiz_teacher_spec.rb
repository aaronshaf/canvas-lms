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
require_relative "../helpers/quizzes_common"
require_relative "../helpers/assignment_overrides"
require_relative "../helpers/files_common"
require_relative "../helpers/admin_settings_common"
require_relative "../rcs/pages/rce_next_page"
require_relative "../helpers/wiki_and_tiny_common"
require_relative "../helpers/items_assign_to_tray"
require_relative "page_objects/quizzes_edit_page"

describe "creating a quiz" do
  include_context "in-process server selenium tests"
  include QuizzesCommon
  include AssignmentOverridesSeleniumHelper
  include FilesCommon
  include AdminSettingsCommon
  include RCENextPage
  include WikiAndTinyCommon
  include ItemsAssignToTray
  include QuizzesEditPage

  context "as a teacher" do
    before do
      stub_rcs_config
      course_with_teacher_logged_in(course_name: "Test Course", active_all: true)
    end

    it "inserts files using the rich content editor", priority: "1" do
      filename = "b_file.txt"
      txt_files = ["some test file", filename]
      txt_files.map do |text_file|
        file = @course.attachments.create!(display_name: text_file, uploaded_data: default_uploaded_data)
        file.context = @course
        file.save!
      end
      @quiz = course_quiz
      get "/courses/#{@course.id}/quizzes/#{@quiz.id}/edit"
      add_file_to_rce_next
      submit_form(".form-actions")
      wait_for_ajax_requests
      expect(fln("text_file.txt")).to be_displayed
    end
  end

  context "post to sis default setting" do
    before do
      account_model
      @account.set_feature_flag! "post_grades", "on"
      course_with_teacher_logged_in(active_all: true, account: @account)
    end

    describe "upon save" do
      let(:sync_sis_button) { f("#quiz_post_to_sis") }

      def new_quiz
        @quiz = course_quiz
        @quiz.post_to_sis = "1"
        Timecop.freeze(7.days.ago) do
          @quiz.due_at = Time.zone.now
        end
        @quiz.save!
        get "/courses/#{@course.id}/quizzes/#{@quiz.id}/edit"
      end

      before do
        turn_on_sis_settings(@account)
        @account.settings[:sis_require_assignment_due_date] = { value: true }
        @account.save!
      end

      context "with due dates" do
        describe "with assign to cards embedded in page" do
          it "does not block when disabled" do
            new_quiz
            set_value(sync_sis_button, false)

            submit_page
          end
        end
      end
    end
  end
end
