# frozen_string_literal: true

#
# Copyright (C) 2012 - present Instructure, Inc.
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

describe "quizzes" do
  include_context "in-process server selenium tests"
  include QuizzesCommon

  before(:once) do
    course_with_student(active_all: true)
  end

  before do
    user_session(@student)
  end

  context "with a student" do
    context "with a quiz started" do
      before(:once) do
        @qsub = quiz_with_submission(complete_quiz: false)
      end

      context "when attempting to resume a quiz" do
        def update_quiz_lock(lock_at, unlock_at)
          @quiz.update(lock_at:, unlock_at:)
        end

        describe "on individual quiz page" do
          def validate_resume_button_text(text)
            expect(f("#not_right_side .take_quiz_button").text).to eq text
          end

          before do
            @resume_text = "Resume Quiz"
          end

          it "can see the resume quiz button if the quiz unlock_at date is < now", priority: "1" do
            update_quiz_lock(nil, 10.minutes.ago)
            get "/courses/#{@course.id}/quizzes/#{@quiz.id}"
            validate_resume_button_text(@resume_text)
          end

          it "can't see the resume quiz button if quiz is locked", priority: "1" do
            update_quiz_lock(5.minutes.ago, nil)
            get "/courses/#{@course.id}/quizzes/#{@quiz.id}"
            expect(f("#not_right_side")).not_to contain_css(".take_quiz_button")
          end
        end
      end

      context "when logged out while taking a quiz" do
        it "is notified and able to relogin", priority: "1" do
          # setup a quiz and start taking it
          quiz_with_new_questions(goto_edit: false)
          get "/courses/#{@course.id}/quizzes/#{@quiz.id}"
          expect_new_page_load { f("#take_quiz_link").click }
          sleep 1 # sleep because display is updated on timer, not ajax callback

          # answer a question, and check that it is saved
          ff(".answers .answer_input input")[0].click
          wait_for_ajaximations
          expect(f("#last_saved_indicator").text).to match(/^Quiz saved at \d+:\d+(pm|am)$/)
          # now kill our session (like logging out)
          destroy_session
          sleep 1 # updateSubmission throttles itself at 1 sec (quite
          # unintelligently, cuz it ignores calls in that second,
          # so you'd have to wait 15-30 sec for the periodic
          # update to hit)

          # and try answering another question
          ff(".answers .answer_input input")[1].click

          # we should get notified that we are logged out
          expect(fj("#deauthorized_dialog:visible")).to be_present

          expect_new_page_load { submit_dialog("#deauthorized_dialog") }
        end
      end
    end
  end
end
