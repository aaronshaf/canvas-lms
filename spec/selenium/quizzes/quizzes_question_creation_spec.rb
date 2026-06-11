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

describe "quizzes question creation" do
  include_context "in-process server selenium tests"
  include QuizzesCommon

  before do
    stub_rcs_config
  end

  context "when creating a new question" do
    before do
      course_with_teacher_logged_in
      @last_quiz = start_quiz_question
    end

    context "when the '+ New Question' button is clicked" do
      it "opens a new question form", priority: "1" do
        # setup is accomplished in before(:each)
        expect(fj(".question_form:visible")).to be_displayed
      end
    end

    # Multiple Choice Question
    it "creates a multiple choice question", priority: "1" do
      quiz = @last_quiz
      create_multiple_choice_question
      quiz.reload
      question_data = quiz.quiz_questions[0].question_data
      expect(f("#question_#{quiz.quiz_questions[0].id}")).to be_displayed

      expect(question_data[:answers].length).to eq 4
      expect(question_data[:answers][0][:text]).to eq "Correct Answer"
      expect(question_data[:answers][0][:weight]).to eq 100
      expect(question_data[:answers][0][:comments_html]).to eq "<p>Good job!</p>"
      expect(question_data[:answers][1][:text]).to eq "Wrong Answer #1"
      expect(question_data[:answers][1][:weight]).to eq 0
      expect(question_data[:answers][1][:comments_html]).to eq "<p>Bad job :(</p>"
      expect(question_data[:answers][2][:text]).to eq "Second Wrong Answer"
      expect(question_data[:answers][2][:weight]).to eq 0
      expect(question_data[:answers][3][:text]).to eq "Wrongest Answer"
      expect(question_data[:answers][3][:weight]).to eq 0
      expect(question_data[:points_possible]).to eq 1
      expect(question_data[:question_type]).to eq "multiple_choice_question"
      expect(question_data[:correct_comments_html]).to eq "<p>Good job on the question!</p>"
      expect(question_data[:incorrect_comments_html]).to eq "<p>You know what they say - study long study wrong.</p>"
      expect(question_data[:neutral_comments_html]).to eq "<p>Pass or fail you are a winner!</p>"
    end

    it "does not open two text editors when you edit a multiple choice answer twice" do
      question = fj(".question_form:visible")
      click_option(".question_form:visible .question_type", "Multiple Choice")
      answers = question.find_elements(:css, ".form_answers > .answer")
      first_answer = answers[0]
      hover(first_answer)
      # Open the HTML editor, click Done, then open it again.
      first_answer.find_element(:css, ".edit_html").click
      first_answer.find_element(:css, ".edit_html_done").click
      first_answer.find_element(:css, ".edit_html").click
      # There should only be one text editor showing.
      text_area = first_answer.find_elements(:css, "textarea")
      expect(text_area.length).to eq(1)
    end

    # True/False Question
    it "creates a true false question", priority: "1" do
      quiz = @last_quiz
      create_true_false_question
      quiz.reload
      expect(f("#question_#{quiz.quiz_questions[0].id}")).to be_displayed

      quiz.reload
      question_data = quiz.quiz_questions[0].question_data
      expect(question_data[:answers][1][:comments_html]).to eq "<p>Good job!</p>"
    end

    # Fill-in-the-blank Question
    it "creates a fill in the blank question", priority: "1" do
      quiz = @last_quiz
      create_fill_in_the_blank_question
      quiz.reload
      expect(f("#question_#{quiz.quiz_questions[0].id}")).to be_displayed
    end

    # Multiple Blanks Question
    # Multiple Answers Question
    it "creates a multiple answers question", priority: "1" do
      quiz = @last_quiz

      question = fj(".question_form:visible")
      click_option(".question_form:visible .question_type", "Multiple Answers")

      type_in_tiny ".question:visible textarea.question_content", "This is a multiple answer question."

      answers = question.find_elements(:css, ".form_answers > .answer")

      replace_content(answers[0].find_element(:css, ".select_answer input"), "first answer")
      replace_content(answers[2].find_element(:css, ".select_answer input"), "second answer")
      answers[2].find_element(:css, ".select_answer_link").click

      submit_form(question)
      wait_for_ajax_requests

      move_to_click("label[for=show_question_details]")
      finished_question = f("#question_#{quiz.quiz_questions[0].id}")
      expect(finished_question).to be_displayed
      expect(finished_question.find_elements(:css, ".answer.correct_answer").length).to eq 2
    end

    # Multiple Dropdown Question
    # Matching Question
    context "when creating a matching question" do
      it "creates a basic matching question", priority: "1" do
        quiz = @last_quiz

        question = fj(".question_form:visible")
        click_option(".question_form:visible .question_type", "Matching")

        type_in_tiny ".question:visible textarea.question_content", "This is a matching question."

        answers = question.find_elements(:css, ".form_answers > .answer")

        answers.each_with_index do |answer, i|
          answer.find_element(:name, "answer_match_left").send_keys("#{i} left side")
          answer.find_element(:name, "answer_match_right").send_keys("#{i} right side")
        end

        submit_form(question)
        wait_for_ajax_requests

        f("#show_question_details").click
        finished_question = f("#question_#{quiz.quiz_questions[0].id}")

        finished_question.find_elements(:css, ".answer_match").each_with_index do |filled_answer, i|
          expect(filled_answer.find_element(:css, ".answer_match_left")).to include_text("#{i} left side")
          expect(filled_answer.find_element(:css, ".answer_match_right")).to include_text("#{i} right side")
        end
      end

      it "creates a matching question with distractors", priority: "1" do
        quiz = @last_quiz

        question = fj(".question_form:visible")
        click_option(".question_form:visible .question_type", "Matching")

        type_in_tiny ".question:visible textarea.question_content", "This is a matching question."

        answers = question.find_elements(:css, ".form_answers > .answer")

        answers.each_with_index do |answer, i|
          answer.find_element(:name, "answer_match_left").send_keys("#{i} left side")
          answer.find_element(:name, "answer_match_right").send_keys("#{i} right side")
        end

        # add a distractor
        distractor_content = "first_distractor"
        question.find_element(:name, "matching_answer_incorrect_matches").send_keys(distractor_content)

        submit_form(question)
        wait_for_ajax_requests

        f("#show_question_details").click
        finished_question = f("#question_#{quiz.quiz_questions[0].id}")

        expect(finished_question).to include_text(distractor_content)
      end
    end

    # Numerical Answer
    # Essay Question
    it "creates a basic essay question", priority: "1" do
      quiz = @last_quiz

      question = fj(".question_form:visible")
      click_option(".question_form:visible .question_type", "Essay Question")

      type_in_tiny ".question:visible textarea.question_content", "This is an essay question."
      submit_form(question)
      wait_for_ajax_requests

      quiz.reload
      finished_question = f("#question_#{quiz.quiz_questions[0].id}")
      expect(finished_question).not_to be_nil
      expect(finished_question.find_element(:css, ".text")).to include_text("This is an essay question.")
    end

    # File Upload Question
    it "creates a basic file upload question", priority: "1" do
      quiz = @last_quiz

      create_file_upload_question

      quiz.reload
      finished_question = f("#question_#{quiz.quiz_questions[0].id}")
      expect(finished_question).not_to be_nil
      expect(finished_question.find_element(:css, ".text")).to include_text("This is a file upload question.")
    end

    # Text Answer Question
    it "creates a basic text answer question", priority: "1" do
      quiz = @last_quiz

      question = fj(".question_form:visible")
      click_option(".question_form:visible .question_type", "Text (no question)")

      type_in_tiny ".question_form:visible textarea.question_content", "This is a text question."
      submit_form(question)
      wait_for_ajax_requests

      quiz.reload
      finished_question = f("#question_#{quiz.quiz_questions[0].id}")
      expect(finished_question).not_to be_nil
      expect(finished_question.find_element(:css, ".text")).to include_text("This is a text question.")
    end

    # Negative Question Points
    it "doesn't allow negative question points", priority: "2" do
      question = fj(".question_form:visible")
      click_option(".question_form:visible .question_type", "essay_question", :value)

      replace_content(question.find_element(:css, "input[name='question_points']"), "-4")
      submit_form(question)

      wait_for_ajaximations
      expect(question).to be_displayed
      expect(ff(".error_text")[0]).to include_text("Must be zero or greater")
    end
  end

  context "when creating a new quiz question group" do
    before do
      course_with_teacher_logged_in
    end

    it "creates a basic quiz question group", priority: "1" do
      quiz_with_new_questions
      create_question_group

      expect(f(".quiz_group_form")).to be_displayed
    end
  end
end
