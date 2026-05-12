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

describe LiveAssessments::ResultsController do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:teacher) { course.teachers.first }
  let_once(:student) { course_with_student(course:).user }
  let_once(:assessment) do
    LiveAssessments::Assessment.create!(
      context: course,
      key: "test-key",
      title: "Test Assessment"
    )
  end

  let(:assessed_at) { 1.day.ago.iso8601 }

  let(:valid_result_params) do
    [{ passed: true, assessed_at:, links: { user: student.id } }]
  end

  def post_create(results: valid_result_params, **extra_params)
    post :create,
         params: {
           course_id: course.id,
           assessment_id: assessment.id,
           results:,
           **extra_params
         },
         format: :json
  end

  describe "POST #create" do
    context "as a teacher" do
      before { user_session(teacher) }

      it "creates results and returns them" do
        post_create
        expect(response).to be_successful
        json = response.parsed_body
        expect(json["results"].count).to be 1
        result = LiveAssessments::Result.find(json["results"].first["id"])
        expect(result.user).to eql student
        expect(result.assessor).to eql teacher
        expect(result.assessment).to eql assessment
        expect(result.passed).to be true
      end

      it "creates results for multiple students in one request" do
        another_student = course_with_student(course:).user
        params = [
          { passed: true, assessed_at:, links: { user: student.id } },
          { passed: false, assessed_at:, links: { user: another_student.id } }
        ]
        post_create(results: params)
        expect(response).to be_successful
        expect(response.parsed_body["results"].count).to be 2
      end

      it "triggers submission generation for assessed users" do
        expect_any_instance_of(LiveAssessments::Assessment)
          .to receive(:generate_submissions_for).with([student])
        post_create
      end

      it "returns 400 when a result hash is missing :assessed_at" do
        params = [{ passed: true, links: { user: student.id } }]
        post_create(results: params)
        expect(response).to have_http_status(:bad_request)
      end

      it "returns 400 when a result hash is missing :passed" do
        params = [{ assessed_at:, links: { user: student.id } }]
        post_create(results: params)
        expect(response).to have_http_status(:bad_request)
      end

      it "creates results with a future assessed_at and reports a Sentry warning" do
        future_time = 1.day.from_now.iso8601
        params = [{ passed: true, assessed_at: future_time, links: { user: student.id } }]
        expect(Canvas::Errors).to receive(:capture).with(
          "Live assessment result with future assessed_at time",
          hash_including(extra: hash_including(
            context_id: course.id,
            assessment_id: assessment.id,
            assessed_user_id: student.id
          )),
          :warn
        )
        post_create(results: params)
        expect(response).to be_successful
        expect(response.parsed_body["results"].count).to be 1
      end

      it "returns 500 when the number of results exceeds MAX_RESULTS_PER_REQUEST" do
        too_many = Array.new(LiveAssessments::ResultsController::MAX_RESULTS_PER_REQUEST + 1) do
          { passed: true, assessed_at:, links: { user: student.id } }
        end
        post :create,
             params: { course_id: course.id, assessment_id: assessment.id, results: too_many },
             as: :json
        expect(response).to have_http_status(:internal_server_error)
      end

      it "returns 400 when :results param is missing" do
        post :create,
             params: { course_id: course.id, assessment_id: assessment.id },
             format: :json
        expect(response).to have_http_status(:bad_request)
      end

      it "returns 400 when a result has no user link" do
        post_create(results: [{ passed: true, assessed_at: }])
        expect(response).to have_http_status(:bad_request)
      end

      it "returns 400 when the result user is not in the course" do
        outsider = user_model
        post_create(results: [{ passed: true, assessed_at:, links: { user: outsider.id } }])
        expect(response).to have_http_status(:bad_request)
      end

      it "returns 400 when the result user is inactive in the course" do
        student.enrollments.where(course:).first.deactivate
        post_create
        expect(response).to have_http_status(:bad_request)
      end
    end

    context "as a student" do
      before { user_session(student) }

      it "returns 403 forbidden" do
        post_create
        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when not logged in" do
      it "returns 401 unauthenticated" do
        post_create
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
