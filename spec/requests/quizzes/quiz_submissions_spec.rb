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
#

describe Quizzes::QuizSubmissionsController do
  let(:teacher_enrollment) { course_with_teacher(active_all: true) }
  let(:course) { teacher_enrollment.course }
  let(:student_enrollment) { student_in_course(course:, active_all: true) }

  let(:teacher) { teacher_enrollment.user }
  let(:student) { student_enrollment.user }

  before { student }

  describe "POST 'create'" do
    let(:quiz) do
      q = course.quizzes.create!
      q.workflow_state = "available"
      q.quiz_data = [{ correct_comments: "", assessment_question_id: nil, incorrect_comments: "", question_name: "Question 1", points_possible: 1, question_text: "Which book(s) are required for this course?", name: "Question 1", id: 128, answers: [{ weight: 0, text: "A", comments: "", id: 1490 }, { weight: 0, text: "B", comments: "", id: 1020 }, { weight: 0, text: "C", comments: "", id: 7051 }], question_type: "multiple_choice_question" }]
      q.save!
      q
    end

    it "allows previewing" do
      user_session(teacher)
      post "/courses/#{quiz.context_id}/quizzes/#{quiz.id}/submissions", params: { preview: 1 }
      expect(response).to have_http_status(:found)
    end

    it "allows previewing a quiz with an access code" do
      user_session(teacher)
      quiz.access_code = "12345"
      quiz.save!
      post "/courses/#{quiz.context_id}/quizzes/#{quiz.id}/submissions", params: { preview: 1 }
      expect(response).to have_http_status(:found)
    end

    it "does not break trying to sanitize parameters of an already submitted quiz" do
      user_session(student)
      quiz.one_question_at_a_time = true
      quiz.cant_go_back = true
      quiz.save!
      @submission = Quizzes::SubmissionManager.new(quiz).find_or_create_submission(student)
      Quizzes::SubmissionGrader.new(@submission).grade_submission
      post "/courses/#{quiz.context_id}/quizzes/#{quiz.id}/submissions",
           params: { question_123: "hi", validation_token: @submission.validation_token }
      expect(response).to have_http_status(:found)
    end

    it "processes a submission when the quiz has an access code" do
      user_session(student)
      quiz.access_code = "Testing Testing 123"
      quiz.save!
      @submission = Quizzes::SubmissionManager.new(quiz).find_or_create_submission(student)
      post "/courses/#{quiz.context_id}/quizzes/#{quiz.id}/submissions",
           params: { question_123: "hi", validation_token: @submission.validation_token }
      expect(response).to have_http_status(:found)
    end

    it "rejects a submission when the validation token does not match" do
      user_session(student)
      @submission = Quizzes::SubmissionManager.new(quiz).find_or_create_submission(student)
      post "/courses/#{quiz.context_id}/quizzes/#{quiz.id}/submissions",
           params: { question_123: "hi", validation_token: "xxx" }
      expect(response).to have_http_status(:found)
      expect(flash[:error]).to include("could not be verified as belonging to you")
    end

    it "builds a new QuizSubmissionEvent" do
      user_session(student)
      @submission = Quizzes::SubmissionManager.new(quiz).find_or_create_submission(student)
      @submission.submission_data = {}
      @submission.quiz_data = [{ :correct_comments => "", :assessment_question_id => nil, :incorrect_comments => "", :question_name => "Question 1", :points_possible => 1, :question_text => "Which book(s) are required for this course?", :name => "Question 1", "id" => 128, :answers => [{ weight: 0, text: "A", comments: "", id: 1490 }, { weight: 0, text: "B", comments: "", id: 1020 }, { weight: 0, text: "C", comments: "", id: 7051 }], :question_type => "multiple_choice_question" }]
      @submission.attempt = 1
      @submission.save!

      post "/courses/#{quiz.context_id}/quizzes/#{quiz.id}/submissions",
           params: { question_128: "bye", validation_token: @submission.validation_token, attempt: 1 }
      events = Quizzes::QuizSubmissionEvent.where(quiz_submission_id: @submission.id)
      expect(events.size).to eq(1)
    end

    it "shows message of success" do
      user_session(student)
      @submission = Quizzes::SubmissionManager.new(quiz).find_or_create_submission(student)
      Quizzes::SubmissionGrader.new(@submission).grade_submission
      post "/courses/#{quiz.context_id}/quizzes/#{quiz.id}/submissions",
           params: { question_123: "hi", validation_token: @submission.validation_token }
      expect(flash[:notice]).to include("Quiz submitted")
    end
  end

  describe "PUT 'update'" do
    context "quiz with submission" do
      before { quiz_with_submission }

      it "requires authentication" do
        put "/courses/#{@quiz.context_id}/quizzes/#{@quiz.id}/submissions/#{@qsub.id}"
        expect(response).to redirect_to("/login")
      end

      it "allows updating scores if the teacher is logged in" do
        user_session(teacher)
        put "/courses/#{@quiz.context_id}/quizzes/#{@quiz.id}/submissions/#{@qsub.id}",
            params: { "question_score_128" => "2" }
        expect(response).to have_http_status(:found)
        expect(@qsub.reload.submission_data[0][:points]).to eq(2)
      end

      it "does not allow updating if the course is concluded" do
        teacher_enrollment.conclude
        user_session(teacher)
        put "/courses/#{@quiz.context_id}/quizzes/#{@quiz.id}/submissions/#{@qsub.id}"
        expect(response).to have_http_status(:unauthorized)
      end

      it "does not allow updating if the student is not assigned the quiz" do
        user_session(teacher)
        allow_any_instance_of(Quizzes::Quiz).to receive(:visible_to_user?).and_return(false)
        put "/courses/#{@quiz.context_id}/quizzes/#{@quiz.id}/submissions/#{@qsub.id}"
        expect(response).to have_http_status(:forbidden)
      end
    end

    context "practice quiz with submission" do
      before { practice_quiz_with_submission }

      it "allows updating scores for a practice quiz" do
        user_session(teacher)
        put "/courses/#{@quiz.context_id}/quizzes/#{@quiz.id}/submissions/#{@qsub.id}",
            params: { "question_score_128" => "2" }
        expect(response).to have_http_status(:found)
        expect(@qsub.reload.submission_data[0][:points]).to eq(2)
      end
    end
  end

  describe "PUT 'backup'" do
    before do
      quiz_model(course:)
      @qs = @quiz.generate_submission(student)
    end

    it "requires authentication" do
      Quizzes::QuizSubmission.where(id: @qs).update_all(updated_at: 1.hour.ago)

      put "/courses/#{course.id}/quizzes/#{@quiz.id}/submissions/backup",
          params: { a: "test", validation_token: @qs.validation_token }
      expect(response).to redirect_to("/login")

      expect(@qs.reload.submission_data[:a]).to be_nil
    end

    it "backups to the user's quiz submission" do
      user_session(student)
      Quizzes::QuizSubmission.where(id: @qs).update_all(updated_at: 1.hour.ago)

      put "/courses/#{course.id}/quizzes/#{@quiz.id}/submissions/backup",
          params: { a: "test", validation_token: @qs.validation_token }
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["backup"]).to be true

      expect(@qs.reload.submission_data[:a]).to eq "test"
    end

    it "returns the time left to finish a quiz" do
      user_session(student)
      submission = @qs
      submission.update_attribute(:end_at, 1.hour.from_now)
      Quizzes::QuizSubmission.where(id: submission).update_all(updated_at: 1.hour.ago)

      put "/courses/#{course.id}/quizzes/#{@quiz.id}/submissions/backup",
          params: { a: "test", validation_token: submission.validation_token }
      json = response.parsed_body

      expect(json["time_left"]).to be_within(5.0).of(60 * 60)
      expect(Time.zone.parse(json["end_at"])).to be_within(5.seconds).of(submission.end_at)
      expect(json["hard_end_at"]).to be_nil # no time-limit extension configured
      # hard_time_left falls back to end_at-based value when no time-limit extension
      expect(json["hard_time_left"]).to be_within(5.0).of(60 * 60)
    end

    it "does not backup if no submission can be found" do
      user_session(teacher)
      put "/courses/#{course.id}/quizzes/#{@quiz.id}/submissions/backup",
          params: { a: "test", preview: 1 }
      json = response.parsed_body
      expect(json["backup"]).to be false
    end

    it "allows anonymous backup for ungraded quizzes in public courses" do
      course.update!(is_public: true)
      @quiz.update!(quiz_type: "practice_quiz")
      temp_code = "tmp_#{SecureRandom.hex}"
      qs = @quiz.generate_submission(temp_code)
      Quizzes::QuizSubmission.where(id: qs).update_all(updated_at: 1.hour.ago)

      # session[:temporary_user_code] cannot be injected cross-request in request
      # specs; stub the controller's session reader directly instead.
      allow_any_instance_of(ApplicationController).to receive(:temporary_user_code)
        .with(generate: false)
        .and_return(temp_code)

      put "/courses/#{course.id}/quizzes/#{@quiz.id}/submissions/backup",
          params: { a: "test" }
      expect(response).to have_http_status(:ok)
      expect(qs.reload.submission_data[:a]).to eq "test"
    end
  end

  describe "POST 'record_answer'" do
    before do
      @course = nil
      @student = nil
      quiz_with_submission(complete_quiz: false)
      @quiz.update_attribute(:one_question_at_a_time, true)
    end

    it "requires authentication" do
      post "/courses/#{@course.id}/quizzes/#{@quiz.id}/submissions/#{@qsub.id}/record_answer",
           params: { a: "test" }
      expect(response).to redirect_to("/login")

      expect(@qsub.reload.submission_data[:a]).to be_nil
    end

    it "records the user's submission" do
      # TODO: FIXME, this test doesn't appear to match its description
      user_session(@student)

      post "/courses/#{@course.id}/quizzes/#{@quiz.id}/submissions/#{@qsub.id}/record_answer",
           params: { a: "test" }
      expect(response).to have_http_status(:unauthorized)

      expect(@qsub.reload.submission_data[:a]).to be_nil
    end

    it "redirects back to quiz after login if unauthorized" do
      post "/courses/#{@course.id}/quizzes/#{@quiz.id}/submissions/#{@qsub.id}/record_answer",
           params: { a: "test" },
           headers: { "HTTP_REFERER" => "http://test.host/" }
      expect(response).to redirect_to("/login")
      expect(session[:return_to]).not_to be_nil
    end
  end

  context "unauthenticated user in public course with practice quiz" do
    before do
      course.update!(is_public: true)
      @quiz = course.quizzes.create!
      @quiz.update!(workflow_state: "available",
                    quiz_type: "practice_quiz",
                    quiz_data: [{ correct_comments: "",
                                  assessment_question_id: nil,
                                  incorrect_comments: "",
                                  question_name: "Question 1",
                                  points_possible: 1,
                                  question_text: "Pick one",
                                  name: "Question 1",
                                  id: 128,
                                  answers: [{ weight: 0, text: "A", comments: "", id: 1490 }],
                                  question_type: "multiple_choice_question" }])
    end

    it "allows anonymous quiz submission via create" do
      temp_code = "tmp_#{SecureRandom.hex}"
      get "/courses/#{course.id}"
      session[:temporary_user_code] = temp_code
      @quiz.generate_submission(temp_code)

      post "/courses/#{course.id}/quizzes/#{@quiz.id}/submissions"
      expect(response).to have_http_status(:found)
    end

    it "allows anonymous record_answer" do
      temp_code = "tmp_#{SecureRandom.hex}"
      qs = @quiz.generate_submission(temp_code)

      # session[:temporary_user_code] cannot be injected cross-request in request
      # specs; stub the controller's session reader directly instead.
      allow_any_instance_of(ApplicationController).to receive(:temporary_user_code)
        .with(generate: false)
        .and_return(temp_code)

      post "/courses/#{course.id}/quizzes/#{@quiz.id}/submissions/#{qs.id}/record_answer",
           params: { a: "test" }
      expect(response).to have_http_status(:found)
    end
  end

  describe "GET / (#index)" do
    context "with a zip parameter present" do
      it "queues a job to get all attachments for all submissions of a quiz" do
        user_session(teacher)
        quiz = course_quiz(active: true)
        expect do
          get "/courses/#{course.id}/quizzes/#{quiz.id}/submissions", params: { zip: "1" }
        end.to change(Delayed::Job, :count).by(1)
      end

      it "still works even after the teacher can't actively grade anymore" do
        term = course.enrollment_term
        term.enrollment_dates_overrides.create!(
          enrollment_type: "TeacherEnrollment", start_at: 2.days.ago, end_at: 1.day.ago, context: term.root_account
        )
        user_session(teacher)
        quiz = course_quiz(active: true)
        expect(quiz.grants_right?(teacher, :grade)).to be false
        expect(quiz.grants_right?(teacher, :review_grades)).to be true
        expect do
          get "/courses/#{course.id}/quizzes/#{quiz.id}/submissions", params: { zip: "1" }
        end.to change(Delayed::Job, :count).by(1)
      end
    end
  end

  describe "POST / (#extension)" do
    context "as a teacher in course" do
      let(:quiz) { course_quiz(active: true) }

      it "is able to extend own extra attempts" do
        user_session(teacher)
        post "/courses/#{course.id}/quizzes/#{quiz.id}/extensions/#{teacher.id}",
             params: { extra_attempts: 1 },
             headers: { "Accept" => "application/json" }
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json["extra_attempts"]).to be(1)
      end

      it "is able to reset the result lockdown flag" do
        user_session(teacher)
        post "/courses/#{course.id}/quizzes/#{quiz.id}/extensions/#{teacher.id}",
             params: { reset_has_seen_results: 1 },
             headers: { "Accept" => "application/json" }
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json["has_seen_results"]).to be false
      end

      it "requires a valid user id" do
        user_session(teacher)
        post "/courses/#{course.id}/quizzes/#{quiz.id}/extensions/foo",
             params: { extra_attempts: 12 },
             headers: { "Accept" => "application/json" }
        expect(response).to have_http_status(:not_found)
      end

      it "allows updating inactive students" do
        user_session(teacher)
        student.enrollments.last.deactivate
        post "/courses/#{course.id}/quizzes/#{quiz.id}/extensions/#{student.id}",
             params: { extra_attempts: 12 },
             headers: { "Accept" => "application/json" }
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json["extra_attempts"]).to be(12)
      end
    end
  end
end
