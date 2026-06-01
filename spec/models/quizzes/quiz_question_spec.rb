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

describe Quizzes::QuizQuestion do
  it "deserializes its json data" do
    answers = [{ "id" => 1 }, { "id" => 2 }]
    qd = { "name" => "test question", "question_type" => "multiple_choice_question", "answers" => answers }
    course_factory
    bank = @course.assessment_question_banks.create!
    a = bank.assessment_questions.create!
    q = Quizzes::QuizQuestion.create(question_data: qd, assessment_question: a)
    expect(q.question_data).not_to be_nil
    expect(q.question_data.class).to eq Quizzes::QuizQuestion::QuestionData
    expect(q.assessment_question_id).to eql(a.id)
    q.question_data = qd

    data = q.data
    expect(data[:assessment_question_id]).to eql(a.id)
    expect(data[:answers]).not_to be_empty
    expect(data[:answers].length).to be(2)
    expect(data[:answers][0][:weight]).to eq 100
    expect(data[:answers][1][:weight]).to be(0.0)
  end

  context "blank answers for fill_in[_multiple]_blank[s] questions" do
    before :once do
      answers = [{ "answer_text" => "True", "id" => 1, }, { "id" => 2, "answer_text" => "" }]
      course_with_teacher

      @quiz = @course.quizzes.create
      @short_answer_data = { question_name: "test question",
                             points_possible: "1",
                             question_type: "short_answer_question",
                             answers: }
      @question = @quiz.quiz_questions.create(question_data: @short_answer_data)
    end

    it "clears blanks before saving" do
      expect(@question.question_data.answers.size).to eq 1
      expect(@question.question_data.answers.first["text"]).to eq @short_answer_data[:answers].first["answer_text"]
    end
  end

  describe "#question_data=" do
    before do
      course_with_teacher

      @quiz = @course.quizzes.create

      @data = { question_name: "test question",
                points_possible: "1",
                question_type: "multiple_choice_question",
                answers: [{ "answer_text" => "1", "id" => 1 },
                          { "answer_text" => "2", "id" => 2 },
                          { "answer_text" => "3", "id" => 3 },
                          { "answer_text" => "4", "id" => 4 }] }

      @question = @quiz.quiz_questions.create(question_data: @data)
    end

    describe "attachment handling" do
      before do
        @aa_test_data = AttachmentAssociationsSpecHelper.new(@course.account, @course)
        @data = { question_name: "test question",
                  points_possible: "1",
                  question_type: "multiple_choice_question",
                  question_text: @aa_test_data.base_html,
                  answers: [{ "answer_text" => "1", "id" => 1 },
                            { "answer_html" => @aa_test_data.replaced_html, "id" => 2 },
                            { "answer_text" => "3", "id" => 3 },
                            { "answer_text" => "4", "id" => 4 }] }

        @question = @quiz.quiz_questions.create(question_data: @data, saving_user: @teacher)
      end

      it "creates associations on quiz question creation" do
        expect(@question.attachment_associations.count).to eq(2)
        expect(@question.attachment_associations.pluck(:attachment_id)).to match_array [@aa_test_data.attachment1.id, @aa_test_data.attachment2.id]
      end

      it "updates associations on quiz update" do
        data = { question_name: "test question",
                 points_possible: "1",
                 question_type: "multiple_choice_question",
                 question_text: "no attachments here",
                 answers: [{ "answer_text" => "1", "id" => 1 },
                           { "answer_html" => @aa_test_data.removed_html, "id" => 2 },
                           { "answer_text" => "3", "id" => 3 },
                           { "answer_text" => "4", "id" => 4 }] }
        @question.update!(question_data: data, saving_user: @teacher)
        expect(@question.attachment_associations.count).to eq(0)
      end

      it "does not update associations when workflow_state is deleted" do
        data = { question_name: "test question",
                 points_possible: "1",
                 question_type: "multiple_choice_question",
                 question_text: "no attachments here",
                 answers: [{ "answer_text" => "1", "id" => 1 },
                           { "answer_html" => @aa_test_data.base_html, "id" => 2 },
                           { "answer_text" => "3", "id" => 3 },
                           { "answer_text" => "4", "id" => 4 }] }
        @question.attachment_associations.destroy_all
        @question.update!(question_data: data, workflow_state: "deleted")
        expect(@question.attachment_associations.count).to eq(0)
      end
    end

    it "saves regrade if passed in regrade option in data hash" do
      expect(Quizzes::QuizQuestionRegrade.first).to be_nil

      Quizzes::QuizRegrade.create(quiz_id: @quiz.id, user_id: @user.id, quiz_version: @quiz.version_number)
      @question.question_data = @data.merge(regrade_option: "full_credit",
                                            regrade_user: @user)
      @question.save

      question_regrade = Quizzes::QuizQuestionRegrade.first
      expect(question_regrade).not_to be_nil
      expect(question_regrade.regrade_option).to eq "full_credit"
    end

    it "sanitizes all the html" do
      question_data = {
        "id" => nil,
        "regrade_option" => "",
        "points_possible" => 1.0,
        "correct_comments_html" => "<img src=\"x\" onerror=\"alert(1)\">",
        "incorrect_comments_html" => "<img src=\"x\" onerror=\"alert(2)\">",
        "neutral_comments_html" => "<img src=\"x\" onerror=\"alert(3)\">",
        "question_type" => "multiple_choice_question",
        "question_name" => "Question",
        "name" => "Question",
        "question_text" => "<img src=\"x\" onerror=\"alert(4)\">",
        "answers" =>
        [
          {
            "id" => 8206,
            "html" => "<img src=\"x\" onerror=\"alert(5)\">",
            "comments_html" => "<img src=\"x\" onerror=\"alert(6)\">",
            "weight" => 100.0
          },
          {
            "id" => 6973,
            "html" => "<img src=\"x\" onerror=\"alert(7)\">",
            "comments_html" => "<img src=\"x\" onerror=\"alert(8)\">",
            "weight" => 0.0
          }
        ]
      }
      qq = @quiz.quiz_questions.create(question_data:)
      expect(qq.question_data["correct_comments_html"]).not_to include("onerror")
      expect(qq.question_data["incorrect_comments_html"]).not_to include("onerror")
      expect(qq.question_data["neutral_comments_html"]).not_to include("onerror")
      expect(qq.question_data["question_text"]).not_to include("onerror")
      expect(qq.question_data["answers"][0]["html"]).not_to include("onerror")
      expect(qq.question_data["answers"][0]["comments_html"]).not_to include("onerror")
      expect(qq.question_data["answers"][1]["html"]).not_to include("onerror")
      expect(qq.question_data["answers"][1]["comments_html"]).not_to include("onerror")
    end
  end

  describe "save-time html sanitization" do
    before do
      course_with_teacher
      @quiz = @course.quizzes.create
    end

    let(:xss_question_data) do
      {
        "question_type" => "multiple_choice_question",
        "question_name" => "Question",
        "name" => "Question",
        "question_text" => '<img src="x" onerror="alert(1)">safe text',
        "correct_comments_html" => '<img src="x" onerror="alert(2)">safe correct',
        "incorrect_comments_html" => '<img src="x" onerror="alert(3)">safe incorrect',
        "neutral_comments_html" => '<img src="x" onerror="alert(4)">safe neutral',
        "comments_html" => '<img src="x" onerror="alert(5)">safe comments',
        "text_after_answers" => '<img src="x" onerror="alert(6)">safe after',
        "more_comments_html" => '<img src="x" onerror="alert(9)">safe more comments',
        "answers" => [
          {
            "id" => 1,
            "html" => '<img src="x" onerror="alert(7)">safe a1 html',
            "comments_html" => '<img src="x" onerror="alert(8)">safe a1 comments',
            "left_html" => '<img src="x" onerror="alert(10)">safe a1 left',
            "weight" => 100.0
          }
        ]
      }
    end

    it "sanitizes html fields in question_data on save" do
      qq = @quiz.quiz_questions.new
      qq["question_data"] = xss_question_data
      qq.save!

      data = qq.reload.read_attribute(:question_data)
      expect(data["question_text"]).to eq('<img src="x">safe text')
      expect(data["correct_comments_html"]).to eq('<img src="x">safe correct')
      expect(data["incorrect_comments_html"]).to eq('<img src="x">safe incorrect')
      expect(data["neutral_comments_html"]).to eq('<img src="x">safe neutral')
      expect(data["comments_html"]).to eq('<img src="x">safe comments')
      expect(data["text_after_answers"]).to eq('<img src="x">safe after')
      expect(data["more_comments_html"]).to eq('<img src="x">safe more comments')
      expect(data["answers"][0]["html"]).to eq('<img src="x">safe a1 html')
      expect(data["answers"][0]["comments_html"]).to eq('<img src="x">safe a1 comments')
      expect(data["answers"][0]["left_html"]).to eq('<img src="x">safe a1 left')
    end

    # more_comments_html and left_html are not set via the question_data=
    # setter (QuestionData.generate drops them), but the importer writes
    # them directly to the attribute, so the before_save sanitization must
    # cover them.
    it "sanitizes more_comments_html written directly (importer path)" do
      qq = @quiz.quiz_questions.new
      qq["question_data"] = {
        "question_type" => "matching_question",
        "question_name" => "Q",
        "more_comments_html" => '<img src="x" onerror="alert(1)">safe',
        "answers" => []
      }
      qq.save!

      expect(qq.reload.read_attribute(:question_data)["more_comments_html"])
        .to eq('<img src="x">safe')
    end

    it "sanitizes answer left_html written directly (importer path)" do
      qq = @quiz.quiz_questions.new
      qq["question_data"] = {
        "question_type" => "matching_question",
        "question_name" => "Q",
        "answers" => [
          { "id" => 1, "left_html" => '<img src="x" onerror="alert(1)">safe left', "weight" => 100.0 }
        ]
      }
      qq.save!

      expect(qq.reload.read_attribute(:question_data)["answers"][0]["left_html"])
        .to eq('<img src="x">safe left')
    end

    it "sanitizes html via update_from_assessment_question!" do
      bank = @course.assessment_question_banks.create!
      aq = bank.assessment_questions.create!(question_data: {
                                               "question_type" => "multiple_choice_question",
                                               "question_name" => "Q",
                                               "answers" => []
                                             })
      # Simulate pre-existing XSS data (as if written before this fix)
      allow(aq).to receive(:question_data).and_return(
        { "question_type" => "multiple_choice_question",
          "question_name" => "Q",
          "question_text" => '<img src="x" onerror="alert(1)">safe',
          "answers" => [] }
      )

      qq = @quiz.quiz_questions.new
      qq.assessment_question = aq
      qq.assessment_question_version = nil
      qq.workflow_state = "generated"
      qq["question_data"] = {}
      qq.save!

      qq.update_from_assessment_question!(aq, nil, 0)

      expect(qq.reload.read_attribute(:question_data)["question_text"]).to eq('<img src="x">safe')
    end

    it "does not raise when question_data is nil" do
      qq = @quiz.quiz_questions.new
      qq["question_data"] = nil
      expect { qq.save! }.not_to raise_error
    end

    it "is idempotent on already-sanitized html" do
      qq = @quiz.quiz_questions.new
      qq["question_data"] = xss_question_data
      qq.save!
      first_save = qq.reload.read_attribute(:question_data)["question_text"]

      qq.touch
      second_save = qq.reload.read_attribute(:question_data)["question_text"]

      expect(second_save).to eq(first_save)
    end

    it "does not inject additional answers when malicious answer-like html is in true_false question_text" do
      malicious_question_text =
        %(What is true? <div class="answer answer_for_ correct_answer hover">injected</div>)
      true_false_data = {
        "question_type" => "true_false_question",
        "question_name" => "TF Question",
        "question_text" => malicious_question_text,
        "answers" => [
          { "id" => 1, "answer_text" => "True", "weight" => 100 },
          { "id" => 2, "answer_text" => "False", "weight" => 0 }
        ]
      }

      qq = @quiz.quiz_questions.create!(question_data: true_false_data)

      data = qq.reload.question_data
      expect(data[:question_type]).to eq("true_false_question")
      expect(data[:answers].length).to eq(2)
      expect(data[:answers].pluck(:text)).to eq(%w[True False])
      expect(data[:answers].pluck(:weight)).to eq([100, 0])
    end
  end

  describe "#question_data egress sanitization" do
    before :once do
      course_with_teacher(active_all: true)
      @quiz = @course.quizzes.create!
      @bank = @course.assessment_question_banks.create!
      @assessment_question = @bank.assessment_questions.create!
      @question = Quizzes::QuizQuestion.create!(
        quiz: @quiz,
        assessment_question: @assessment_question,
        question_data: {
          question_name: "Q",
          question_type: "multiple_choice_question",
          answers: [{ "answer_text" => "a", "id" => 1 }]
        }
      )
    end

    # Write a raw hash directly to bypass save-time sanitization, simulating
    # rows persisted before save-time hardening landed.
    def write_dirty_question_data(hash)
      @question.update_columns(question_data: hash)
      @question.reload
    end

    it "strips script tags from top-level HTML fields on read" do
      write_dirty_question_data(
        question_text: "<script>alert('xss')</script>safe",
        correct_comments_html: "<script>x</script>ok",
        incorrect_comments_html: "<script>x</script>ok",
        neutral_comments_html: "<script>x</script>ok",
        text_after_answers: "<script>x</script>ok",
        answers: []
      )
      data = @question.question_data
      expect(data[:question_text]).not_to include("<script>")
      expect(data[:question_text]).to include("safe")
      expect(data[:correct_comments_html]).not_to include("<script>")
      expect(data[:incorrect_comments_html]).not_to include("<script>")
      expect(data[:neutral_comments_html]).not_to include("<script>")
      expect(data[:text_after_answers]).not_to include("<script>")
    end

    it "strips event handler attributes from top-level fields on read" do
      write_dirty_question_data(
        question_text: %(<img src="x" onerror="alert(1)">),
        answers: []
      )
      expect(@question.question_data[:question_text]).not_to include("onerror")
    end

    it "strips javascript: protocol from top-level fields on read" do
      write_dirty_question_data(
        question_text: %(<a href="javascript:alert(1)">click</a>),
        answers: []
      )
      expect(@question.question_data[:question_text]).not_to include("javascript:")
    end

    it "strips script tags from per-answer HTML fields on read" do
      write_dirty_question_data(
        question_text: "ok",
        answers: [
          { "id" => 1, "html" => "<script>alert(1)</script>good", "comments_html" => "<script>alert(2)</script>good" },
          { "id" => 2, "html" => "<script>alert(3)</script>good", "comments_html" => "<script>alert(4)</script>good" }
        ]
      )
      answers = @question.question_data[:answers]
      expect(answers[0][:html]).not_to include("<script>")
      expect(answers[0][:html]).to include("good")
      expect(answers[0][:comments_html]).not_to include("<script>")
      expect(answers[1][:html]).not_to include("<script>")
      expect(answers[1][:comments_html]).not_to include("<script>")
    end

    it "strips event handler attributes from per-answer HTML fields on read" do
      write_dirty_question_data(
        question_text: "ok",
        answers: [{ "id" => 1, "html" => %(<img src="x" onerror="alert(1)">), "comments_html" => %(<img src="x" onerror="alert(2)">) }]
      )
      answers = @question.question_data[:answers]
      expect(answers[0][:html]).not_to include("onerror")
      expect(answers[0][:comments_html]).not_to include("onerror")
    end

    it "preserves safe HTML on read" do
      write_dirty_question_data(
        question_text: "<p>hello <strong>world</strong></p>",
        answers: [{ "id" => 1, "html" => "<em>safe</em>" }]
      )
      data = @question.question_data
      expect(data[:question_text]).to eq("<p>hello <strong>world</strong></p>")
      expect(data[:answers][0][:html]).to eq("<em>safe</em>")
    end

    it "is idempotent across multiple reads" do
      write_dirty_question_data(
        question_text: "<script>x</script><p>ok</p>",
        answers: [{ "id" => 1, "html" => "<script>y</script><p>also ok</p>" }]
      )
      first_text = @question.question_data[:question_text]
      first_answer = @question.question_data[:answers][0][:html]
      expect(@question.question_data[:question_text]).to eq(first_text)
      expect(@question.question_data[:answers][0][:html]).to eq(first_answer)
    end
  end

  describe ".update_all_positions" do
    def question_positions(object)
      object.quiz_questions.active.sort_by(&:position).map(&:id)
    end

    before :once do
      course_factory
      @quiz = @course.quizzes.create!(title: "some quiz")
      @question1 = @quiz.quiz_questions.create!(question_data: { "name" => "test question 1", "answers" => [{ "id" => 1 }, { "id" => 2 }] })
      @question2 = @quiz.quiz_questions.create!(question_data: { "name" => "test question 2", "answers" => [{ "id" => 3 }, { "id" => 4 }] })
      @question3 = @quiz.quiz_questions.create!(question_data: { "name" => "test question 3", "answers" => [{ "id" => 5 }, { "id" => 6 }] })
    end

    it "noops if list of items is empty" do
      group = @quiz.quiz_groups.create(name: "question group")
      group.quiz_questions = [@question1, @question2, @question3]
      before = question_positions(group)

      Quizzes::QuizQuestion.update_all_positions!([], group)
      expect(before).to eq question_positions(group)
    end

    it "updates positions for quiz questions within a group" do
      group = @quiz.quiz_groups.create(name: "question group")
      group.quiz_questions = [@question1, @question2, @question3]

      @question3.position = 1
      @question1.position = 2
      @question2.position = 3

      Quizzes::QuizQuestion.update_all_positions!([@question3, @question1, @question2], group)
      expect(question_positions(group)).to eq [@question3.id, @question1.id, @question2.id]
    end

    it "updates positions for quiz questions outside a group" do
      group = @quiz.quiz_groups.create(name: "question group")
      group.quiz_questions = [@question1, @question2]

      @question3.position = 1
      @question1.position = 2
      @question2.position = 3

      Quizzes::QuizQuestion.update_all_positions!([@question3, @question1, @question2], group)
      expect(question_positions(group)).to eq [@question3.id, @question1.id, @question2.id]
    end

    it "updates positions for quiz without a group" do
      @question3.position = 1
      @question1.position = 2
      @question2.position = 3

      Quizzes::QuizQuestion.update_all_positions!([@question3, @question1, @question2])
      expect(question_positions(@quiz)).to eq [@question3.id, @question1.id, @question2.id]
    end
  end

  describe "#destroy" do
    it "does not remove the record from the database, but changes workflow_state" do
      course_with_teacher
      course_quiz

      question = @quiz.quiz_questions.create!
      question.destroy
      question = Quizzes::QuizQuestion.find(question.id)

      expect(question).not_to be_nil
      expect(question).to be_deleted
    end
  end

  context "root_account_id" do
    before { quiz_with_graded_submission([]) }

    it "uses root_account value from account" do
      question = @quiz.quiz_questions.create!
      expect(question.root_account_id).to eq Account.default.id
    end
  end

  describe ".without_assessment_question_association" do
    before do
      course_with_teacher
      @quiz = @course.quizzes.create!
      @data = { question_name: "test question" }
    end

    it "returns questions without assessment_question_id" do
      standalone_question = @quiz.quiz_questions.create!(question_data: @data.merge(question_type: "text_only_question"))

      bank = @course.assessment_question_banks.create!
      assessment_question = bank.assessment_questions.create!
      linked_question = @quiz.quiz_questions.create!(question_data: @data.merge(question_type: "multiple_choice_question"), assessment_question:)

      results = Quizzes::QuizQuestion.without_assessment_question_association

      expect(results).to include(standalone_question)
      expect(results).not_to include(linked_question)
    end
  end

  describe "#create_assessment_question" do
    before do
      course_with_teacher
      @quiz = @course.quizzes.create!
    end

    it "passes updating_user to assessment_question when creating" do
      question_data = {
        question_name: "Test Question",
        question_type: "multiple_choice_question",
        points_possible: 1,
        answers: [
          { answer_text: "Answer 1", weight: 100 },
          { answer_text: "Answer 2", weight: 0 }
        ]
      }

      quiz_question = @quiz.quiz_questions.create!(
        question_data:,
        updating_user: @teacher
      )

      expect(quiz_question.assessment_question).not_to be_nil
      expect(quiz_question.assessment_question.updating_user).to eq(@teacher)
    end

    it "does not create assessment_question for text_only questions" do
      question_data = {
        question_name: "Text Only",
        question_type: "text_only_question"
      }

      quiz_question = @quiz.quiz_questions.create!(
        question_data:,
        updating_user: @teacher
      )

      expect(quiz_question.assessment_question).to be_nil
    end

    it "updates assessment_question with updating_user on save" do
      @attachment = attachment_with_context(@course)
      question_data = {
        question_name: "Test Question",
        question_type: "multiple_choice_question",
        points_possible: 1,
        question_text: "<p>File ref:<img src='/courses/#{@course.id}/files/#{@attachment.id}'></p>",
        answers: [
          { answer_text: "Answer 1", weight: 100 }
        ]
      }

      quiz_question = @quiz.quiz_questions.create!(question_data:, updating_user: @teacher)
      assessment_question = quiz_question.assessment_question

      quiz_question.updating_user = @teacher
      quiz_question.question_data = question_data.merge(question_name: "Updated Question")
      quiz_question.save!

      expect(quiz_question.assessment_question).to eq(assessment_question)
      expect(quiz_question.assessment_question.attachments).not_to be_empty
    end
  end
end
