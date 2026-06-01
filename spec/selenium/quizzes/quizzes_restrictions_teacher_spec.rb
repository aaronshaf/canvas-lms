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

describe "quiz restrictions as a teacher" do
  include_context "in-process server selenium tests"
  include QuizzesCommon

  before do
    course_with_teacher_logged_in
  end

  context "restrict access code" do
    let(:access_code) { "1234" }
    let(:quiz_with_access_code) do
      @context = @course
      quiz = quiz_model
      quiz.quiz_questions.create! question_data: true_false_question_data
      quiz.access_code = access_code
      quiz.generate_quiz_data
      quiz.save!
      quiz.reload
    end

    it "does not allow a blank restrict access code password", priority: "1" do
      get "/courses/#{@course.id}/quizzes"
      click_new_quiz_button
      f("#enable_quiz_access_code").click
      wait_for_ajaximations

      # now try and save it and validate the validation text
      wait_for_new_page_load { f("button.save_quiz_button.btn.btn-primary").click }
      expect(ff(".error_text")[0]).to include_text("You must enter an access code")
    end

    it "accepts a valid password when creating a quiz", priority: "1" do
      get "/courses/#{@course.id}/quizzes"
      click_new_quiz_button
      f("#enable_quiz_access_code").click
      wait_for_ajaximations
      f("#quiz_access_code").send_keys("guybrush")

      # save and verify that the show page comes up
      wait_for_new_page_load { f("button.save_quiz_button.btn.btn-primary").click }
      expect(f(".unpublished_quiz_warning")).to include_text("This quiz is unpublished")
    end

    it "allows previewing the quiz", priority: "1" do
      @quiz = quiz_with_access_code
      preview_quiz
    end
  end

  context "filter ip addresses" do
    it "does not allow a blank ip address", priority: "1" do
      get "/courses/#{@course.id}/quizzes"
      click_new_quiz_button
      f("#enable_quiz_ip_filter").click
      wait_for_ajaximations

      # now try and save it and validate the validation text
      wait_for_new_page_load { f("button.save_quiz_button.btn.btn-primary").click }
      expect(ff(".error_text")[0]).to include_text("You must enter a valid IP Address")
    end

    it "has a working link to help with ip address filtering", priority: "1" do
      get "/courses/#{@course.id}/quizzes"
      click_new_quiz_button
      f("#enable_quiz_ip_filter").click
      wait_for_ajaximations

      expect(f("#ip_filters_dialog")).not_to be_displayed
      f("a.ip_filtering_link > img").click
      wait_for_ajaximations
      expect(f("#ip_filters_dialog")).to be_displayed
    end
  end
end
