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

describe Quizzes::QuizSubmissionEvent do
  describe "#empty?" do
    context Quizzes::QuizSubmissionEvent::EVT_QUESTION_ANSWERED do
      before do
        subject.event_type = Quizzes::QuizSubmissionEvent::EVT_QUESTION_ANSWERED
      end

      it "is true if it has no answer records" do
        expect(subject).to be_empty
      end

      it "is not true if it has any answer record" do
        subject.answers = [{}]
        expect(subject).not_to be_empty
      end
    end
  end

  context "root_account_id" do
    it "uses root_account value from quiz_subission" do
      course_factory
      quiz = @course.quizzes.create!
      qs = Quizzes::QuizSubmission.create!(quiz:, attempt: 1)
      qse = qs.record_creation_event
      expect(qse.root_account_id).to eq Account.default.id
    end
  end

  describe "#sanitize_essay_answers" do
    before(:once) do
      course_factory
      @quiz = @course.quizzes.create!
      @quiz_submission = Quizzes::QuizSubmission.create!(quiz: @quiz, attempt: 1)
    end

    def create_answered_event(event_data)
      Quizzes::QuizSubmissionEvent.create!(
        quiz_submission: @quiz_submission,
        event_type: Quizzes::QuizSubmissionEvent::EVT_QUESTION_ANSWERED,
        attempt: @quiz_submission.attempt,
        event_data:
      )
    end

    it "strips script tags from essay answers" do
      event = create_answered_event([{ "quiz_question_id" => "1", "answer" => "<script>alert('xss')</script>safe" }])
      expect(event.event_data.first["answer"]).not_to include("<script>")
      expect(event.event_data.first["answer"]).to include("safe")
    end

    it "strips onerror attributes from essay answers" do
      event = create_answered_event([{ "quiz_question_id" => "1", "answer" => '<img src="x" onerror="alert(1)">' }])
      expect(event.event_data.first["answer"]).not_to include("onerror")
    end

    it "strips javascript: hrefs from essay answers" do
      event = create_answered_event([{ "quiz_question_id" => "1", "answer" => '<a href="javascript:alert(1)">click</a>' }])
      expect(event.event_data.first["answer"]).not_to include("javascript:")
    end

    it "preserves safe HTML in essay answers" do
      event = create_answered_event([{ "quiz_question_id" => "1", "answer" => "<p>I think the answer is <strong>obvious</strong>.</p>" }])
      expect(event.event_data.first["answer"]).to include("<strong>obvious</strong>")
    end

    it "does not affect non-string answers" do
      event = create_answered_event([{ "quiz_question_id" => "1", "answer" => 42 }])
      expect(event.event_data.first["answer"]).to be(42)
    end

    it "sanitizes all answer objects in the array" do
      event = create_answered_event([
                                      { "quiz_question_id" => "1", "answer" => "<script>xss</script>text" },
                                      { "quiz_question_id" => "2", "answer" => '<img onerror="xss" src="x">text' }
                                    ])
      expect(event.event_data[0]["answer"]).not_to include("<script>")
      expect(event.event_data[1]["answer"]).not_to include("onerror")
    end

    it "does not modify event_data for non-question_answered events" do
      event = Quizzes::QuizSubmissionEvent.create!(
        quiz_submission: @quiz_submission,
        event_type: Quizzes::QuizSubmissionEvent::EVT_QUESTION_FLAGGED,
        attempt: @quiz_submission.attempt,
        event_data: [{ "quiz_question_id" => "1", "flagged" => true }]
      )
      expect(event.event_data.first["flagged"]).to be true
    end
  end
end
