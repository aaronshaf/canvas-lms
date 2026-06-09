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

require_relative "../graphql_spec_helper"

describe Mutations::CreateStudyNote do
  before :once do
    course_with_student(active_all: true)
    @course.root_account.enable_feature!(:notebook)
    @wiki_page = @course.wiki.wiki_pages.create!(title: "Test Page", context: @course)
    @assignment = @course.assignments.create!(title: "Test Assignment")
    @quiz = @course.quizzes.create!(title: "Test Quiz")
    @quiz.publish!
  end

  def execute_with_input(input_str, user_executing: @student)
    mutation_command = <<~GQL
      mutation {
        createStudyNote(input: {
          #{input_str}
        }) {
          studyNote {
            _id
            courseId
            userId
            learningObjectType
            learningObjectId
            userText
            reactions
            highlightData
            redwoodUuid
          }
          errors {
            attribute
            message
          }
        }
      }
    GQL
    run_mutation(mutation_command, current_user: user_executing)
  end

  let(:valid_input) do
    <<~GQL
      courseId: #{@course.id}
      learningObjectType: WikiPage
      learningObjectId: "#{@wiki_page.id}"
      userText: "my note"
    GQL
  end

  it "creates a study note for the current user" do
    result = execute_with_input(valid_input)
    expect(result["errors"]).to be_nil
    expect(result.dig("data", "createStudyNote", "errors")).to be_nil
    note = result.dig("data", "createStudyNote", "studyNote")
    expect(note["courseId"]).to eq @course.id.to_s
    expect(note["userId"]).to eq @student.id.to_s
    expect(note["learningObjectType"]).to eq "WikiPage"
    expect(note["learningObjectId"]).to eq @wiki_page.id.to_s
    expect(note["userText"]).to eq "my note"
  end

  it "creates a note against an Assignment" do
    input = <<~GQL
      courseId: #{@course.id}
      learningObjectType: Assignment
      learningObjectId: "#{@assignment.id}"
      userText: "assignment note"
    GQL
    result = execute_with_input(input)
    expect(result["errors"]).to be_nil
    note = result.dig("data", "createStudyNote", "studyNote")
    expect(note["learningObjectType"]).to eq "Assignment"
    expect(note["learningObjectId"]).to eq @assignment.id.to_s
  end

  it "creates a note against a Quizzes::Quiz" do
    input = <<~GQL
      courseId: #{@course.id}
      learningObjectType: Quiz
      learningObjectId: "#{@quiz.id}"
      userText: "quiz note"
    GQL
    result = execute_with_input(input)
    expect(result["errors"]).to be_nil
    note = result.dig("data", "createStudyNote", "studyNote")
    expect(note["learningObjectType"]).to eq "Quiz"
    expect(note["learningObjectId"]).to eq @quiz.id.to_s
  end

  it "creates a note with reactions and highlight_data" do
    input = <<~GQL
      courseId: #{@course.id}
      learningObjectType: WikiPage
      learningObjectId: "#{@wiki_page.id}"
      reactions: ["Important"]
      highlightData: "{}"
    GQL
    result = execute_with_input(input)
    expect(result["errors"]).to be_nil
    note = result.dig("data", "createStudyNote", "studyNote")
    expect(note["reactions"]).to eq ["Important"]
  end

  it "creates a note with a redwood_uuid" do
    uuid = SecureRandom.uuid
    input = <<~GQL
      courseId: #{@course.id}
      learningObjectType: WikiPage
      learningObjectId: "#{@wiki_page.id}"
      redwoodUuid: "#{uuid}"
    GQL
    result = execute_with_input(input)
    expect(result["errors"]).to be_nil
    note = result.dig("data", "createStudyNote", "studyNote")
    expect(note["redwoodUuid"]).to eq uuid
  end

  it "works for horizon courses without the notebook flag" do
    @course.root_account.disable_feature!(:notebook)
    @course.account.enable_feature!(:horizon_course_setting)
    @course.update!(horizon_course: true)
    result = execute_with_input(valid_input)
    expect(result["errors"]).to be_nil
    expect(result.dig("data", "createStudyNote", "studyNote")).to be_present
  end

  context "errors" do
    def expect_error(result, message)
      errors = result["errors"] || result.dig("data", "createStudyNote", "errors")
      expect(errors).not_to be_nil
      expect(errors[0]["message"]).to match(/#{message}/)
    end

    it "returns error when course not found" do
      result = execute_with_input("courseId: 0 learningObjectType: WikiPage learningObjectId: \"1\"")
      expect_error(result, "Course not found")
    end

    it "returns error when notebook feature flag is disabled" do
      @course.root_account.disable_feature!(:notebook)
      result = execute_with_input(valid_input)
      expect_error(result, "notebook feature flag is not enabled")
    end

    it "returns error when user is not a student" do
      teacher = teacher_in_course(course: @course, active_all: true).user
      result = execute_with_input(valid_input, user_executing: teacher)
      expect_error(result, "User is not a student of this course")
    end

    it "returns error when learning object does not belong to the course" do
      student_course_id = @course.id
      other_course = course_factory(active_all: true)
      other_page = other_course.wiki.wiki_pages.create!(title: "Other Page", context: other_course)
      input = <<~GQL
        courseId: #{student_course_id}
        learningObjectType: WikiPage
        learningObjectId: "#{other_page.id}"
      GQL
      result = execute_with_input(input)
      expect_error(result, "Learning object not found")
    end

    it "returns error when the per-object note limit is reached" do
      stub_const("StudyNote::NOTES_PER_OBJECT_LIMIT", 1)
      execute_with_input(valid_input)
      result = execute_with_input(valid_input)
      expect_error(result, "Note limit of 1 per page reached")
    end
  end
end
