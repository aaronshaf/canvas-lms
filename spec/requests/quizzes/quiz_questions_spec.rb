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

describe Quizzes::QuizQuestionsController do
  let(:teacher) do
    course_with_teacher(active_all: true)
    @teacher
  end
  let(:course) do
    teacher
    @course
  end
  let(:quiz) { course.quizzes.create! }
  let(:question) do
    q = quiz.quiz_questions.build
    q["question_data"] = { answers: [
      { id: 123_456, answer_text: "asdf", weight: 100 },
      { id: 654_321, answer_text: "jkl;", weight: 0 }
    ] }
    q.save!
    q
  end

  describe "GET 'index'" do
    it "requires authorization" do
      get "/api/v1/courses/#{course.id}/quizzes/#{quiz.id}/questions"
      assert_unauthorized
    end

    it "returns quiz questions" do
      question # create before request
      user_session(teacher)
      get "/api/v1/courses/#{course.id}/quizzes/#{quiz.id}/questions"
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json.length).to eq(1)
      expect(json.first["id"]).to eql(question.id)
    end
  end

  describe "POST 'create'" do
    it "requires authorization" do
      post "/courses/#{course.id}/quizzes/#{quiz.id}/questions", params: { question: {} }
      assert_unauthorized
    end

    it "creates a quiz question" do
      user_session(teacher)
      post "/courses/#{course.id}/quizzes/#{quiz.id}/questions",
           params: { question: {
             question_type: "multiple_choice_question",
             answers: {
               "0" => { answer_text: "asdf", weight: 100 },
               "1" => { answer_text: "jkl;", weight: 0 }
             }
           } }
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json["id"]).to eq(Quizzes::QuizQuestion.last.id)
      expect(json["answers"].pluck("text")).to contain_exactly("asdf", "jkl;")
    end

    it "preserves ids, if provided, on create" do
      user_session(teacher)
      post "/courses/#{course.id}/quizzes/#{quiz.id}/questions",
           params: { question: {
             question_type: "multiple_choice_question",
             answers: [
               { id: 123_456, answer_text: "asdf", weight: 100 },
               { id: 654_321, answer_text: "jkl;", weight: 0 },
               { id: 654_321, answer_text: "qwer", weight: 0 }
             ]
           } }
      expect(response).to have_http_status(:ok)
      answers = response.parsed_body["answers"]
      expect(answers.length).to eq(3)
      expect(answers[0]["id"]).to eq(123_456)
      expect(answers[1]["id"]).to eq(654_321)
      expect(answers[2]["id"]).not_to eql(654_321)
    end

    it "bounces data thats too long" do
      long_data = "abcdefghijklmnopqrstuvwxyz"
      16.times do
        long_data = "#{long_data}abcdefghijklmnopqrstuvwxyz#{long_data}"
      end
      user_session(teacher)
      post "/courses/#{course.id}/quizzes/#{quiz.id}/questions",
           params: { question: { question_text: long_data } },
           headers: { "X-Requested-With" => "XMLHttpRequest" }
      max_len = 16_384
      expect(response.parsed_body.dig("errors", "base")).to match(/max length is #{max_len}/)
    end

    it "strips the origin from local URLs in answers" do
      user_session(teacher)
      post "/courses/#{course.id}/quizzes/#{quiz.id}/questions",
           params: { question: {
             question_type: "multiple_choice_question",
             answers: {
               "0" => {
                 answer_html: "<a href='http://www.example.com/courses/#{course.id}/files/27'>home</a>",
                 comment_html: "<a href='http://www.example.com/courses/#{course.id}/assignments'>home</a>",
               }
             }
           } }
      expect(response).to have_http_status(:ok)
      q = Quizzes::QuizQuestion.find(response.parsed_body["id"])
      expect(q.question_data["answers"][0]["html"]).not_to match(%r{http://www.example.com})
      expect(q.question_data["answers"][0]["html"]).to match(%r{href=['"]/courses/#{course.id}/files/27})
    end

    it "strips the origin from local URLs in answers when they are provided as an array" do
      user_session(teacher)
      post "/courses/#{course.id}/quizzes/#{quiz.id}/questions",
           params: { question: {
             question_type: "multiple_choice_question",
             answers: [{
               answer_html: "<a href='http://www.example.com/courses/#{course.id}/files/27'>home</a>",
               comment_html: "<a href='http://www.example.com/courses/#{course.id}/assignments'>home</a>",
             }]
           } }
      expect(response).to have_http_status(:ok)
      q = Quizzes::QuizQuestion.find(response.parsed_body["id"])
      expect(q.question_data["answers"][0]["html"]).not_to match(%r{http://www.example.com})
      expect(q.question_data["answers"][0]["html"]).to match(%r{href=['"]/courses/#{course.id}/files/27})
    end

    it "creates a quiz question with a linked assessment question" do
      user_session(teacher)
      post "/courses/#{course.id}/quizzes/#{quiz.id}/questions",
           params: { question: {
             question_type: "multiple_choice_question",
             answers: {
               "0" => { answer_text: "answer1", weight: 100 }
             }
           } }
      expect(response).to have_http_status(:ok)
      q = Quizzes::QuizQuestion.find(response.parsed_body["id"])
      expect(q.assessment_question).not_to be_nil
      expect(q.assessment_question.question_data["question_type"]).to eq("multiple_choice_question")
    end

    it "creates a numerical_question with an exact answer and a range answer" do
      # Arrange
      user_session(teacher)

      # Act
      post "/courses/#{course.id}/quizzes/#{quiz.id}/questions",
           params: { question: {
             question_type: "numerical_question",
             question_text: "What is 2 + 3?",
             answers: {
               "0" => {
                 numerical_answer_type: "exact_answer",
                 answer_exact: 5,
                 answer_error_margin: 2
               },
               "1" => {
                 numerical_answer_type: "range_answer",
                 answer_range_start: 5,
                 answer_range_end: 10
               }
             }
           } }

      # Assert
      expect(response).to have_http_status(:ok)
      q = Quizzes::QuizQuestion.find(response.parsed_body["id"])
      expect(q.question_data["question_type"]).to eq("numerical_question")
      answers = q.question_data["answers"]
      expect(answers.length).to eq(2)
      expect(answers[0]["numerical_answer_type"]).to eq("exact_answer")
      expect(answers[0]["exact"]).to eq(5.0)
      expect(answers[0]["margin"]).to eq(2.0)
      expect(answers[1]["numerical_answer_type"]).to eq("range_answer")
      expect(answers[1]["start"]).to eq(5.0)
      expect(answers[1]["end"]).to eq(10.0)
    end

    it "round-trips HTML answer markup on create for a multiple_choice_question" do
      # Arrange
      user_session(teacher)

      # Act
      post "/courses/#{course.id}/quizzes/#{quiz.id}/questions",
           params: { question: {
             question_type: "multiple_choice_question",
             answers: {
               "0" => { answer_text: "first", weight: 100 },
               "1" => { answer_text: "second", weight: 0 },
               "2" => { answer_text: "third", weight: 0 },
               "3" => { answer_html: "<p>HTML</p>", weight: 0 }
             }
           } }

      # Assert
      expect(response).to have_http_status(:ok)
      q = Quizzes::QuizQuestion.find(response.parsed_body["id"])
      answers = q.question_data["answers"]
      expect(answers.length).to eq(4)
      expect(answers[3]["html"]).to eq("<p>HTML</p>")
    end

    it "round-trips HTML answer markup on create for a multiple_answers_question" do
      # Arrange
      user_session(teacher)

      # Act
      post "/courses/#{course.id}/quizzes/#{quiz.id}/questions",
           params: { question: {
             question_type: "multiple_answers_question",
             answers: {
               "0" => { answer_text: "first", weight: 100 },
               "1" => { answer_text: "second", weight: 0 },
               "2" => { answer_text: "third", weight: 0 },
               "3" => { answer_html: "<p>HTML</p>", weight: 100 }
             }
           } }

      # Assert
      expect(response).to have_http_status(:ok)
      q = Quizzes::QuizQuestion.find(response.parsed_body["id"])
      expect(q.question_data["question_type"]).to eq("multiple_answers_question")
      answers = q.question_data["answers"]
      expect(answers.length).to eq(4)
      expect(answers[3]["html"]).to eq("<p>HTML</p>")
    end

    context "when adding questions from a bank" do
      it "add_assessment_questions would create assessment with a cloned attachment" do
        bank = course.assessment_question_banks.create!(title: "Test Bank")
        attachment = attachment_with_context(course)
        assessment_question = bank.assessment_questions.create!(
          question_data: {
            question_type: "multiple_choice_question",
            question_name: "Test Question",
            question_text: "<p>File ref:<img src='/courses/#{course.id}/files/#{attachment.id}'></p>",
            points_possible: 1
          }
        )
        user_session(teacher)
        post "/courses/#{course.id}/quizzes/#{quiz.id}/questions",
             params: {
               assessment_question_bank_id: bank.id,
               assessment_questions_ids: assessment_question.id.to_s,
               existing_questions: "1"
             }

        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        quiz_q = Quizzes::QuizQuestion.find(json.first["id"])
        expect(quiz_q.assessment_question.id).to eq(assessment_question.id)
      end

      it "adds bank questions into the supplied quiz_group" do
        # Arrange
        bank = course.assessment_question_banks.create!(title: "Group Bank")
        aq1 = bank.assessment_questions.create!(
          question_data: {
            question_type: "multiple_choice_question",
            question_name: "BQ1",
            question_text: "<p>q1</p>",
            points_possible: 2
          }
        )
        aq2 = bank.assessment_questions.create!(
          question_data: {
            question_type: "multiple_choice_question",
            question_name: "BQ2",
            question_text: "<p>q2</p>",
            points_possible: 2
          }
        )
        group = quiz.quiz_groups.create!(name: "group1", pick_count: 2, question_points: 2)
        user_session(teacher)

        # Act
        post "/courses/#{course.id}/quizzes/#{quiz.id}/questions",
             params: {
               assessment_question_bank_id: bank.id,
               assessment_questions_ids: "#{aq1.id},#{aq2.id}",
               quiz_group_id: group.id,
               existing_questions: "1"
             }

        # Assert
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json.length).to eq(2)
        expected_ids = Quizzes::QuizQuestion.where(assessment_question_id: [aq1.id, aq2.id]).pluck(:id).sort
        expect(json.pluck("id").sort).to eq(expected_ids)
        added = Quizzes::QuizQuestion.where(id: json.pluck("id"))
        expect(added.map(&:quiz_group_id).uniq).to eq([group.id])
        group.reload
        expect(group.name).to eq("group1")
        expect(group.pick_count).to eq(2)
        expect(group.question_points).to eq(2.0)
      end
    end
  end

  describe "PUT 'update'" do
    before { question }

    it "requires authorization" do
      put "/courses/#{course.id}/quizzes/#{quiz.id}/questions/#{question.id}", params: { question: {} }
      assert_unauthorized
    end

    it "updates a quiz question" do
      user_session(teacher)
      put "/courses/#{course.id}/quizzes/#{quiz.id}/questions/#{question.id}",
          params: { question: {
            question_type: "multiple_choice_question",
            answers: {
              "0" => { answer_text: "asdf", weight: 100 },
              "1" => { answer_text: "jkl;", weight: 0 },
              "2" => { answert_text: "qwer", weight: 0 }
            }
          } }
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["question_type"]).to eq("multiple_choice_question")
      expect(response.parsed_body["answers"].length).to eq(3)
      question.reload
      expect(question.question_data["answers"].length).to eq(3)
    end

    it "preserves ids, if provided, on update" do
      user_session(teacher)
      put "/courses/#{course.id}/quizzes/#{quiz.id}/questions/#{question.id}",
          params: { question: {
            question_type: "multiple_choice_question",
            answers: {
              "0" => { id: 123_456, answer_text: "asdf", weight: 100 },
              "1" => { id: 654_321, answer_text: "jkl;", weight: 0 },
              "2" => { id: 654_321, answer_text: "qwer", weight: 0 }
            }
          } }
      expect(response).to have_http_status(:ok)
      question.reload
      data = question.question_data["answers"]
      expect(data.length).to eq(3)
      expect(data[0]["id"]).to eq(123_456)
      expect(data[1]["id"]).to eq(654_321)
      expect(data[2]["id"]).not_to eql(654_321)
    end

    it "bounces data thats too long" do
      long_data = "abcdefghijklmnopqrstuvwxyz"
      16.times do
        long_data = "#{long_data}abcdefghijklmnopqrstuvwxyz#{long_data}"
      end
      user_session(teacher)
      put "/courses/#{course.id}/quizzes/#{quiz.id}/questions/#{question.id}",
          params: { question: { question_text: long_data } },
          headers: { "X-Requested-With" => "XMLHttpRequest" }
      max_len = 16_384
      expect(response.parsed_body.dig("errors", "base")).to match(/max length is #{max_len}/)
    end

    it "deletes non-html comments if needed" do
      bank = course.assessment_question_banks.create!(title: "Test Bank")
      aq = bank.assessment_questions.create!(question_data: {
                                               question_type: "essay_question", correct_comments: "stuff", correct_comments_html: "stuff"
                                             })

      # add the first question directly onto the quiz, so it shouldn't get "randomly" selected from the group
      linked_question = quiz.quiz_questions.build(question_data: aq.question_data)
      linked_question.assessment_question_id = aq.id
      linked_question.save!

      user_session(teacher)
      put "/courses/#{course.id}/quizzes/#{quiz.id}/questions/#{linked_question.id}",
          params: { question: { correct_comments_html: "" } }
      expect(response).to have_http_status(:ok)

      linked_question.reload
      expect(linked_question.question_data["correct_comments_html"]).to be_blank
      expect(linked_question.question_data["correct_comments"]).to be_blank
    end

    it "leaves assessment question verifiers" do
      attachment = attachment_with_context(course)
      bank = course.assessment_question_banks.create!(title: "Test Bank")
      aq = bank.assessment_questions.create!(question_data: {
                                               question_type: "essay_question",
                                               question_text: "File ref:<img src=\"/courses/#{course.id}/files/#{attachment.id}/download\">"
                                             },
                                             updating_user: teacher)

      translated_text = aq.reload.question_data["question_text"]
      expect(translated_text).to match %r{/assessment_questions/\d+/files/\d+}
      expect(translated_text).to match(/verifier=/)

      # add the first question directly onto the quiz, so it shouldn't get "randomly" selected from the group
      linked_question = quiz.quiz_questions.build(question_data: aq.question_data, updating_user: teacher)
      linked_question.assessment_question_id = aq.id
      linked_question.save!

      user_session(teacher)
      put "/courses/#{course.id}/quizzes/#{quiz.id}/questions/#{linked_question.id}",
          params: { question: { question_text: translated_text } }
      expect(response).to have_http_status(:ok)

      linked_question.reload
      expect(linked_question.question_data["question_text"]).to eq translated_text # leave alone
    end

    context "when the quiz_question doesn't have an assessment_question and its workflow_state is not 'generated'" do
      before do
        question.update!(question_data: { question_type: "multiple_choice_question" })
        question.update_column(:assessment_question_id, nil)
      end

      it "generates an assessment_question for the quiz_question" do
        user_session(teacher)
        expect do
          put "/courses/#{course.id}/quizzes/#{quiz.id}/questions/#{question.id}",
              params: { question: { neutral_comments_html: "" } }
          question.reload
        end.to change { question.assessment_question.present? }.from(false).to(true)
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body["id"]).to eq(question.id)
      end

      it "does not reset the question's data" do
        user_session(teacher)
        expect do
          put "/courses/#{course.id}/quizzes/#{quiz.id}/questions/#{question.id}",
              params: { question: { neutral_comments_html: "" } }
          question.reload
        end.not_to change { question.question_data["question_type"] }
      end
    end

    context "when the quiz_question doesn't have an assessment_question and its workflow_state is 'generated'" do
      before do
        question.update_column(:assessment_question_id, nil)
        question.update_column(:workflow_state, "generated")
      end

      it "does not generate an assessment_question for the quiz_question" do
        user_session(teacher)
        expect do
          put "/courses/#{course.id}/quizzes/#{quiz.id}/questions/#{question.id}",
              params: { question: { neutral_comments_html: "" } }
          question.reload
        end.not_to change { question.assessment_question_id }
      end
    end

    context "when the quiz_question has an assessment_question" do
      it "does not generates an assessment_question for the quiz_question" do
        user_session(teacher)
        expect do
          put "/courses/#{course.id}/quizzes/#{quiz.id}/questions/#{question.id}",
              params: { question: { neutral_comments_html: "" } }
          question.reload
        end.not_to change { question.assessment_question }
      end
    end

    it "persists updated essay question_text and exposes it via Quizzes::QuizQuestion lookup" do
      # Arrange
      essay_question = quiz.quiz_questions.create!(
        question_data: {
          question_type: "essay_question",
          question_name: "essay",
          question_text: "original text",
          points_possible: 1
        }
      )
      user_session(teacher)

      # Act
      put "/courses/#{course.id}/quizzes/#{quiz.id}/questions/#{essay_question.id}",
          params: { question: {
            question_type: "essay_question",
            question_text: "This is an essay question."
          } }

      # Assert
      expect(response).to have_http_status(:ok)
      essay_question.reload
      expect(essay_question.question_data["question_type"]).to eq("essay_question")
      expect(essay_question.question_data["question_text"]).to include("This is an essay question.")
      matches = Quizzes::QuizQuestion.where("question_data like ?", "%This is an essay question%")
      expect(matches).to include(essay_question)
    end
  end

  describe "DELETE 'destroy'" do
    before { question }

    it "sets updating_user when destroying a quiz question" do
      user_session(teacher)
      expect do
        delete "/courses/#{course.id}/quizzes/#{quiz.id}/questions/#{question.id}"
      end.to change { Quizzes::QuizQuestion.active.count }.by(-1)

      expect(response).to have_http_status(:no_content)
    end
  end
end
