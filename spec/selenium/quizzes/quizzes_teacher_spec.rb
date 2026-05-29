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
require_relative "../helpers/quizzes_common"
require_relative "../helpers/assignment_overrides"
require_relative "../helpers/files_common"

describe "quizzes" do
  include_context "in-process server selenium tests"
  include QuizzesCommon
  include AssignmentOverridesSeleniumHelper
  include FilesCommon

  def add_question_to_group
    f(".add_question_link").click
    wait_for_ajaximations
    question_form = f(".question_form")
    submit_form(question_form)
    wait_for_ajaximations
  end

  context "as a teacher" do
    before(:once) do
      course_with_teacher(active_all: true)
      course_with_student(course: @course, active_enrollment: true)
      @course.update(name: "teacher course")
      @course.save!
      @course.reload
    end

    before do
      user_session(@teacher)
    end

    it "asynchronously loads student quiz results", priority: "2" do
      @context = @course
      q = quiz_model
      q.generate_quiz_data
      q.save!

      get "/courses/#{@course.id}/quizzes/#{q.id}"
      f(".al-trigger").click
      f(".quiz_details_link").click
      wait_for_ajaximations
      expect(f("#quiz_details")).to be_displayed
    end

    it "opens and close the send to dialog" do
      @context = @course
      quiz_model
      get "/courses/#{@course.id}/quizzes/#{@quiz.id}"
      f(".al-trigger").click
      f(".direct-share-send-to-menu-item").click
      expect(fj("h2:contains(Send To...)")).to be_displayed
      fj("button:contains(Cancel)").click
      expect(f("body")).not_to contain_jqcss("h2:contains(Send To...)")
      check_element_has_focus(f(".al-trigger"))
    end

    it "opens and close the copy to tray" do
      @context = @course
      quiz_model
      get "/courses/#{@course.id}/quizzes/#{@quiz.id}"
      f(".al-trigger").click
      f(".direct-share-copy-to-menu-item").click
      expect(fj("h2:contains(Copy To...)")).to be_displayed
      fj("button:contains(Cancel)").click
      expect(f("body")).not_to contain_jqcss("h2:contains(Copy To...)")
      check_element_has_focus(f(".al-trigger"))
    end

    it "does not let you exceed the question limit", priority: "2" do
      get "/courses/#{@course.id}/quizzes"
      click_new_quiz_button

      click_questions_tab
      f(".add_question_group_link").click
      group_form = f("#questions .quiz_group_form")
      pick_count_field = group_form.find_element(:name, "quiz_group[pick_count]")
      pick_count = lambda do |count|
        driver.execute_script <<~JS # rubocop:disable Specs/NoExecuteScript
          var $pickCount = $('#questions .group_top input[name="quiz_group[pick_count]"]');
          $pickCount.focus();
          $pickCount[0].value = #{count.to_s.inspect};
          $pickCount.change();
        JS
      end

      pick_count.call("1001")
      dismiss_alert
      expect(pick_count_field).to have_attribute(:value, "1")

      click_new_question_button # 1 total, ok
      wait_for_ajaximations
      group_form.find_element(:css, ".edit_group_link").click
      pick_count.call("999") # 1000 total, ok

      click_new_question_button # 1001 total, bad
      dismiss_alert

      pick_count.call("1000") # 1001 total, bad
      dismiss_alert
      expect(pick_count_field).to have_attribute(:value, "999")
    end

    describe "insufficient count warnings" do
      it "shows a warning for groups picking too many questions", priority: "2" do
        get "/courses/#{@course.id}/quizzes"
        click_new_quiz_button
        click_questions_tab
        f(".add_question_group_link").click
        submit_form(".quiz_group_form")
        wait_for_ajaximations

        expect(f(".insufficient_count_warning")).to be_displayed

        add_question_to_group
        wait_for_ajaximations

        expect(f(".insufficient_count_warning")).not_to be_displayed

        f("#questions .edit_group_link").click
        replace_content(f('#questions .group_top input[name="quiz_group[pick_count]"]'), "2")
        submit_form(".quiz_group_form")
        wait_for_ajaximations
        expect(f(".insufficient_count_warning")).to be_displayed

        # save and reload
        expect_new_page_load { f(".save_quiz_button").click }
        quiz = @course.quizzes.last
        get "/courses/#{@course.id}/quizzes/#{quiz.id}/edit"

        click_questions_tab
        wait_for_ajaximations

        expect(f(".insufficient_count_warning")).to be_displayed

        add_question_to_group
        wait_for_ajaximations

        expect(f(".insufficient_count_warning")).not_to be_displayed
      end

      it "shows a warning for groups picking too many questions from a bank", priority: "2" do
        bank = @course.assessment_question_banks.create!
        assessment_question_model(bank:)

        get "/courses/#{@course.id}/quizzes"
        click_new_quiz_button
        click_questions_tab
        f(".add_question_group_link").click

        f(".find_bank_link").click
        fj("#find_bank_dialog .bank:visible").click
        submit_dialog("#find_bank_dialog", ".submit_button")
        submit_form(".quiz_group_form")
        wait_for_ajaximations

        expect(f(".insufficient_count_warning")).not_to be_displayed

        f("#questions .edit_group_link").click
        replace_content(f('#questions .group_top input[name="quiz_group[pick_count]"]'), "2")
        submit_form(".quiz_group_form")
        wait_for_ajaximations
        expect(f(".insufficient_count_warning")).to be_displayed

        # save and reload
        expect_new_page_load { f(".save_quiz_button").click }
        quiz = @course.quizzes.last
        get "/courses/#{@course.id}/quizzes/#{quiz.id}/edit"

        click_questions_tab
        wait_for_ajaximations

        expect(f(".insufficient_count_warning")).to be_displayed

        f("#questions .edit_group_link").click
        replace_content(f('#questions .group_top input[name="quiz_group[pick_count]"]'), "1")
        submit_form(".quiz_group_form")
        wait_for_ajaximations
        expect(f(".insufficient_count_warning")).not_to be_displayed
      end
    end

    it "validates numerical input data", priority: "1" do
      skip_if_safari(:alert)
      @quiz = quiz_with_new_questions do |bank, quiz|
        aq = bank.assessment_questions.create!
        quiz.quiz_questions.create!(question_data: { :name => "numerical", "question_type" => "numerical_question", "answers" => [], :points_possible => 1 }, assessment_question: aq)
      end
      user_session(@student)
      take_quiz do
        input = f(".numerical_question_input")

        input.click
        input.send_keys("asdf")
        wait_for_ajaximations
        expect(error_displayed?).to be_truthy
        driver.execute_script('$(".numerical_question_input").change()') # rubocop:disable Specs/NoExecuteScript
        wait_for_ajaximations
        expect(input[:value]).to be_blank

        input.click
        input.send_keys("1")
        wait_for_ajaximations
        expect(error_displayed?).to be_falsey
        driver.execute_script('$(".numerical_question_input").change()') # rubocop:disable Specs/NoExecuteScript
        wait_for_ajaximations
        expect(input).to have_attribute(:value, "1")
      end
      user_session(@user)
    end

    def upload_attachment_answer
      f("input[type=file]").send_keys @fullpath
      wait_for_ajaximations
      expect(f(".file-uploaded").text).not_to be_nil
      expect(f(".list_question, .answered").text).not_to be_nil
      f(".upload-label").click
      wait_for_ajaximations
    end

    def file_upload_submission_data
      @quiz.reload.quiz_submissions.first
           .submission_data[:"question_#{@question.id}"]
    end

    it "displays a link to quiz statistics for a MOOC", priority: "2" do
      quiz_with_submission
      @course.large_roster = true
      @course.save!
      get "/courses/#{@course.id}/quizzes/#{@quiz.id}"

      expect(f("#right-side")).to include_text("Quiz Statistics")
    end
  end
end
