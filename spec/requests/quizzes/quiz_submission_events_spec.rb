# frozen_string_literal: true

#
# Copyright (C) 2014 - present Instructure, Inc.
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

describe Quizzes::QuizSubmissionEventsController do
  let(:teacher_enrollment) { course_with_teacher(active_all: true) }
  let(:course) { teacher_enrollment.course }
  let(:teacher) { teacher_enrollment.user }
  let(:student_enrollment) { student_in_course(course:, active_all: true) }
  let(:student) { student_enrollment.user }
  let(:quiz) { quiz_model(course:) }
  let(:quiz_submission) { quiz.generate_submission(student) }

  before do
    Account.default.enable_feature!(:quiz_log_auditing)
  end

  describe "GET /log (#index)" do
    def subject
      get "/courses/#{course.id}/quizzes/#{quiz.id}/submissions/#{quiz_submission.id}/log"
    end

    it "requires authorization" do
      subject

      expect(response).to have_http_status(:found)
      expect(response).to redirect_to("/login")
    end

    it "lets the teacher in" do
      user_session(teacher)

      subject

      expect(response).to have_http_status(:ok)
    end

    it "does not let the student in" do
      user_session(student)

      subject

      expect(response).to have_http_status(:unauthorized)
    end

    context "when quiz_log_auditing feature flag is off" do
      before do
        Account.default.disable_feature!(:quiz_log_auditing)
      end

      after do
        Account.default.enable_feature!(:quiz_log_auditing)
      end

      it "redirects away" do
        user_session(teacher)

        subject

        expect(response).to have_http_status(:found)
        expect(response).to redirect_to("/courses/#{course.id}/quizzes/#{quiz.id}/history?user_id=#{student.id}")
      end
    end
  end
end
