# frozen_string_literal: true

#
# Copyright (C) 2016 - present Instructure, Inc.
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
require_relative "../helpers/groups_common"

describe "quizzes log auditing" do
  include_context "in-process server selenium tests"
  include QuizzesCommon
  include GroupsCommon

  context "as a teacher" do
    before :once do
      course_with_teacher(active_user: true, active_enrollment: true, active_course: true)
      Account.default.enable_feature!(:quiz_log_auditing)
    end

    before do
      user_session(@teacher)
    end

    context "should list the attempt count for multiple attempts" do
      before do
        @quiz = @course.quizzes.create!(title: "new quiz")
        @quiz.quiz_questions.create!(
          question_data: {
            name: "test 3",
            question_type: "multiple_choice_question",
            answers: {
              answer_0: { answer_text: "0" },
              answer_1: { answer_text: "1" }
            }
          }
        )
        @quiz.generate_quiz_data
        @quiz.workflow_state = "available"
        @quiz.allowed_attempts = 2
        @quiz.save

        @student = student_in_course(course: @course, name: "student", active_all: true).user
        user_session(@student)
        get "/courses/#{@course.id}/quizzes/#{@quiz.id}"

        f("#take_quiz_link").click
        wait_for_ajaximations
      end

      it "shows that a session had started and that it is has been read", priority: "2" do
        skip_if_safari(:alert)
        resize_screen_to_small
        scroll_page_to_bottom # the question viewed event is triggered by page scroll
        wait_for_ajax_requests
        submit_quiz

        sub = @quiz.quiz_submissions.where(user_id: @student).first
        user_session(@teacher)
        resize_screen_to_standard
        get "/courses/#{@course.id}/quizzes/#{@quiz.id}/submissions/#{sub.id}/log"
        expect(f("#ic-EventStream")).to include_text("Session started")
        expect(f("#ic-EventStream")).to include_text("Viewed (and possibly read)")
      end
    end
  end
end
