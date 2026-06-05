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
#

require_relative "../../support/request_helper"

describe "Quiz History GET /courses/:course_id/quizzes/:quiz_id/history" do
  describe "observer viewing a non-final attempt when show_correct_answers_last_attempt is enabled" do
    it "does not authorize displaying correct answers for the observer on a non-final attempt" do
      # Arrange
      course_with_student(active_all: true)
      course_with_observer(active_all: true, course: @course)
        .update_attribute(:associated_user_id, @student.id)

      quiz_with_submission
      @quiz.update!(
        show_correct_answers: true,
        show_correct_answers_last_attempt: true,
        allowed_attempts: 2
      )
      @qsub.reload

      user_session(@observer)

      # The Quizzes#history view is gated on Quiz#show_correct_answers?(user, submission).
      # On a non-final attempt with show_correct_answers_last_attempt=true, this MUST
      # return false so the view does not render any .correct_answer markup. This is
      # the underlying contract that the selenium test was verifying via DOM lookup.
      expect(@quiz.show_correct_answers?(@observer, @qsub)).to be false

      # The observer's quiz submission still has attempts remaining (non-final).
      expect(@qsub.attempts_left).to be > 0
      expect(@qsub.completed?).to be true

      # Stub the brandable_css handlebars index so the view layout can render
      # without requiring a `yarn run build:css` artifact on disk.
      allow(BrandableCSS).to receive(:handlebars_index_json).and_return("{}".html_safe)

      # Act: observer requests the history page using user_id (observer view path).
      get "/courses/#{@course.id}/quizzes/#{@quiz.id}/history",
          params: { user_id: @student.id }

      # Assert: the observer-as-associated-user can reach the route successfully.
      expect(response).to have_http_status(:ok)

      # And the rendered body does not contain the .correct_answer CSS class
      # that would have indicated correct answers were exposed.
      expect(response.body).not_to match(/class=["'][^"']*\bcorrect_answer\b[^"']*["']/)
    end
  end
end
