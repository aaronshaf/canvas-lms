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

describe "quizzes question banks" do
  include_context "in-process server selenium tests"
  include QuizzesCommon

  context "as a teacher" do
    before do
      course_with_teacher_logged_in
    end

    it "allows you to use inherited question banks", custom_timeout: 30, priority: "1" do
      @course.account = Account.default
      @course.save
      quiz = @course.quizzes.create!(title: "My Quiz")
      bank = AssessmentQuestionBank.create!(context: @course.account)
      assessment_question_model(bank:)

      get "/courses/#{@course.id}/quizzes/#{quiz.id}/edit"
      click_questions_tab

      f(".find_question_link").click
      wait_for_ajaximations
      expect(f("#find_question_dialog")).to be_displayed
      expect(f(".select_all_link")).to be_displayed
      f(".select_all_link").click
      wait_for_ajaximations
      submit_dialog("#find_question_dialog", ".submit_button")
      wait_for_ajaximations
      click_settings_tab
      expect(f("#quiz_display_points_possible .points_possible")).to include_text "1"

      click_questions_tab
      f(".add_question_group_link").click
      wait_for_ajaximations
      f(".find_bank_link").click
      fj("#find_bank_dialog .bank:visible").click
      submit_dialog("#find_bank_dialog", ".submit_button")
      submit_form(".quiz_group_form")
      wait_for_ajaximations
      click_settings_tab
      expect(f("#quiz_display_points_possible .points_possible")).to include_text "2"
    end

    it "allows you to use bookmarked question banks", custom_timeout: 30, priority: "1" do
      @course.account = Account.default
      @course.save
      quiz = @course.quizzes.create!(title: "My Quiz")
      bank = AssessmentQuestionBank.create!(context: Course.create!)
      assessment_question_model(bank:)
      @user.assessment_question_banks << bank

      get "/courses/#{@course.id}/quizzes/#{quiz.id}/edit"
      click_questions_tab

      f(".find_question_link").click
      wait_for_ajaximations
      expect(f("#find_question_dialog")).to be_displayed
      wait_for_ajaximations
      expect(f(".select_all_link")).to be_displayed
      f(".select_all_link").click
      wait_for_ajaximations
      submit_dialog("#find_question_dialog", ".submit_button")
      wait_for_ajaximations
      click_settings_tab
      expect(f("#quiz_display_points_possible .points_possible")).to include_text "1"

      click_questions_tab
      f(".add_question_group_link").click
      wait_for_ajaximations
      f(".find_bank_link").click
      wait_for_ajaximations
      fj("#find_bank_dialog .bank:visible").click
      submit_dialog("#find_bank_dialog", ".submit_button")
      submit_form(".quiz_group_form")
      wait_for_ajaximations
      click_settings_tab
      expect(f("#quiz_display_points_possible .points_possible")).to include_text "2"
    end

    it "creates a question group from a question bank from within the Find Quiz Question modal", custom_timeout: 30, priority: "1" do
      assessment_question_model(bank: AssessmentQuestionBank.create!(context: @course))

      get "/courses/#{@course.id}/quizzes"
      click_new_quiz_button
      click_questions_tab
      wait_for_ajaximations

      # open Find Question dialogue
      f(".find_question_link").click
      wait_for_ajaximations

      # select questions from question bank
      f(".select_all_link").click
      wait_for_ajaximations

      # create new quiz question group from selected questions
      question_group_name = "Quiz Question Group A"
      click_option(ff(".quiz_group_select"), "[ Create Group ]")
      f("#found_question_group_name").send_keys question_group_name
      f("#found_question_group_pick").send_keys "1"
      f("#found_question_group_points").send_keys "1"
      submit_dialog(f("#add_question_group_dialog"), ".submit_button")
      wait_for_ajaximations

      # submit Find Question dialogue
      submit_dialog(f("#find_question_dialog"), ".submit_button")
      wait_for_ajaximations

      expect(f(".quiz_group_form")).to include_text question_group_name
      expect(f("#question_new_question_text").text).to match "does [a] equal [b] ?"
    end

    it "deleting AJAX-loaded questions should work", priority: "2" do
      @bank = @course.assessment_question_banks.create!(title: "Test Bank")
      (1..60).each do |idx|
        @bank.assessment_questions.create!(
          question_data: {
            question_name: "test question #{idx}",
            question_text: "test question #{idx}",
            answers: [
              { id: 1 },
              { id: 2 }
            ]
          }
        )
      end
      get "/courses/#{@course.id}/question_banks/#{@bank.id}"
      f(".more_questions_link").click

      expect(ffj(".display_question:visible")).to have_size 60
      links = fj(".display_question:visible:last .links")
      hover links
      f(".delete_question_link", links).click
      accept_alert
      expect(ffj(".display_question:visible")).to have_size 59

      @bank.reload
      wait_for_ajaximations
      expect(@bank.assessment_questions.count { |aq| !aq.deleted? }).to eq 59
    end

    it "moves paginated questions in a question bank from one bank to another", custom_timeout: 40, priority: "2" do # flaky-fix: QE-142
      source_bank = @course.assessment_question_banks.create!(title: "Source Bank")
      target_bank = @course.assessment_question_banks.create!(title: "Target Bank")
      assessment_question = []
      51.times do |o|
        assessment_question[o] = source_bank.assessment_questions.create!
      end
      get "/courses/#{@course.id}/question_banks/#{source_bank.id}"
      f(".more_questions_link").click
      wait_for_ajaximations
      f("#question_teaser_#{assessment_question[50].id} .move_question_link").click
      f("#question_bank_#{target_bank.id}").click
      f("input[type=checkbox][name=copy]").click
      submit_dialog("#move_question_dialog", ".submit_button")
      wait_for_ajaximations
      refresh_page
      expect(f("#content")).not_to contain_css(".more_questions_link")
      expect(source_bank.assessment_question_count).to eq(50)
      expect(target_bank.assessment_question_count).to eq(1)
    end
  end
end
