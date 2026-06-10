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

describe Types::StudyNoteType do
  before :once do
    course_with_student(active_all: true)
    @course.root_account.enable_feature!(:notebook)
    @wiki_page = @course.wiki.wiki_pages.create!(title: "Test Page", context: @course)
    @note = StudyNote.create!(
      user: @student,
      course: @course,
      root_account: @course.root_account,
      wiki_page: @wiki_page,
      user_text: "my note",
      reaction: ["Important"],
      redwood_uuid: SecureRandom.uuid
    )
  end

  let(:type) do
    GraphQLTypeTester.new(@note,
                          current_user: @student,
                          current_principal: @student.principal,
                          request: ActionDispatch::TestRequest.create)
  end

  it "resolves id fields" do
    expect(type.resolve("_id")).to eq @note.id.to_s
    expect(type.resolve("userId")).to eq @student.id.to_s
    expect(type.resolve("courseId")).to eq @course.id.to_s
  end

  it "resolves learning object fields" do
    expect(type.resolve("learningObjectType")).to eq "WikiPage"
    expect(type.resolve("learningObjectId")).to eq @wiki_page.id.to_s
  end

  it "resolves note content fields" do
    expect(type.resolve("userText")).to eq "my note"
    expect(type.resolve("reactions")).to eq ["Important"]
  end

  it "resolves redwood_uuid" do
    expect(type.resolve("redwoodUuid")).to eq @note.redwood_uuid
  end

  it "resolves timestamp fields" do
    expect(type.resolve("createdAt")).to be_present
    expect(type.resolve("updatedAt")).to be_present
  end

  describe "studyNotesConnection query" do
    def execute_query(course_id:, filter_str: "", user_executing: @student)
      filter_arg = filter_str.empty? ? "" : ", filter: { #{filter_str} }"
      run_mutation(<<~GQL, current_user: user_executing)
        {
          studyNotesConnection(courseId: "#{course_id}"#{filter_arg}) {
            nodes {
              _id
              userText
              reactions
              learningObjectType
              learningObjectId
            }
          }
        }
      GQL
    end

    before :once do
      course_with_student(active_all: true)
      @course.root_account.enable_feature!(:notebook)
      @wiki_page = @course.wiki.wiki_pages.create!(title: "Page One", context: @course)
      @assignment = @course.assignments.create!(title: "Assignment One")
      @note1 = StudyNote.create!(
        user: @student,
        course: @course,
        root_account: @course.root_account,
        wiki_page: @wiki_page,
        user_text: "note one",
        reaction: ["Important"],
        redwood_uuid: SecureRandom.uuid
      )
      @note2 = StudyNote.create!(
        user: @student,
        course: @course,
        root_account: @course.root_account,
        assignment: @assignment,
        user_text: "note two",
        reaction: ["Question"],
        redwood_uuid: SecureRandom.uuid
      )
    end

    it "returns all study notes for the student" do
      result = execute_query(course_id: @course.id)
      expect(result["errors"]).to be_nil
      ids = result.dig("data", "studyNotesConnection", "nodes").pluck("_id")
      expect(ids).to match_array([@note1.id.to_s, @note2.id.to_s])
    end

    it "filters by learning object" do
      result = execute_query(
        course_id: @course.id,
        filter_str: "learningObject: { learningObjectType: WikiPage, learningObjectId: \"#{@wiki_page.id}\" }"
      )
      expect(result["errors"]).to be_nil
      nodes = result.dig("data", "studyNotesConnection", "nodes")
      expect(nodes.length).to eq 1
      expect(nodes[0]["_id"]).to eq @note1.id.to_s
    end

    it "filters by reactions" do
      result = execute_query(
        course_id: @course.id,
        filter_str: 'reactions: ["Question"]'
      )
      expect(result["errors"]).to be_nil
      nodes = result.dig("data", "studyNotesConnection", "nodes")
      expect(nodes.length).to eq 1
      expect(nodes[0]["_id"]).to eq @note2.id.to_s
    end

    it "returns totalCount in pageInfo" do
      result = run_mutation(<<~GQL, current_user: @student)
        {
          studyNotesConnection(courseId: "#{@course.id}", first: 1) {
            nodes { _id }
            pageInfo { totalCount }
          }
        }
      GQL
      expect(result["errors"]).to be_nil
      expect(result.dig("data", "studyNotesConnection", "nodes").length).to eq 1
      expect(result.dig("data", "studyNotesConnection", "pageInfo", "totalCount")).to eq 2
    end

    it "orders notes by created_at ascending, then id" do
      result = execute_query(course_id: @course.id)
      expect(result["errors"]).to be_nil
      ids = result.dig("data", "studyNotesConnection", "nodes").pluck("_id")
      expect(ids).to eq([@note1.id.to_s, @note2.id.to_s])
    end

    it "supports cursor-based jump-to-page via `after`" do
      after_cursor = Base64.strict_encode64("1")
      result = run_mutation(<<~GQL, current_user: @student)
        {
          studyNotesConnection(courseId: "#{@course.id}", first: 5, after: "#{after_cursor}") {
            nodes { _id }
            pageInfo { totalCount }
          }
        }
      GQL
      expect(result["errors"]).to be_nil
      ids = result.dig("data", "studyNotesConnection", "nodes").pluck("_id")
      expect(ids).to eq([@note2.id.to_s])
      expect(result.dig("data", "studyNotesConnection", "pageInfo", "totalCount")).to eq 2
    end

    it "does not return another student's notes" do
      original_student = @student
      other_student = student_in_course(course: @course, active_all: true).user
      StudyNote.create!(
        user: other_student,
        course: @course,
        root_account: @course.root_account,
        wiki_page: @wiki_page,
        user_text: "other student note",
        reaction: [],
        redwood_uuid: SecureRandom.uuid
      )
      result = execute_query(course_id: @course.id, user_executing: original_student)
      expect(result["errors"]).to be_nil
      ids = result.dig("data", "studyNotesConnection", "nodes").pluck("_id")
      expect(ids).to match_array([@note1.id.to_s, @note2.id.to_s])
    end

    it "works for horizon courses without the notebook flag" do
      @course.root_account.disable_feature!(:notebook)
      @course.account.enable_feature!(:horizon_course_setting)
      @course.update!(horizon_course: true)
      result = execute_query(course_id: @course.id)
      expect(result["errors"]).to be_nil
      expect(result.dig("data", "studyNotesConnection", "nodes")).to be_present
    end

    context "errors" do
      def expect_error(result, message)
        errors = result["errors"]
        expect(errors).not_to be_nil
        expect(errors[0]["message"]).to match(/#{message}/)
      end

      it "returns error when notebook feature flag is disabled" do
        @course.root_account.disable_feature!(:notebook)
        result = execute_query(course_id: @course.id)
        expect_error(result, "notebook feature flag is not enabled")
      end

      it "returns error when user is not a student" do
        teacher = teacher_in_course(course: @course, active_all: true).user
        result = execute_query(course_id: @course.id, user_executing: teacher)
        expect_error(result, "User is not a student of this course")
      end

      it "returns error for a TA" do
        ta = ta_in_course(course: @course, active_all: true).user
        result = execute_query(course_id: @course.id, user_executing: ta)
        expect_error(result, "User is not a student of this course")
      end

      it "returns error for an observer" do
        observer = observer_in_course(course: @course, active_all: true).user
        result = execute_query(course_id: @course.id, user_executing: observer)
        expect_error(result, "User is not a student of this course")
      end

      it "returns nil for a nonexistent course" do
        result = execute_query(course_id: 0)
        expect(result["errors"]).to be_nil
        expect(result.dig("data", "studyNotesConnection")).to be_nil
      end
    end
  end
end
