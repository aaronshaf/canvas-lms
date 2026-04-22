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

describe Mutations::UpdateStudyNote do
  before :once do
    course_with_student(active_all: true)
    @course.root_account.enable_feature!(:notebook)
    @wiki_page = @course.wiki.wiki_pages.create!(title: "Test Page", context: @course)
    @note = StudyNote.create!(
      user: @student,
      course: @course,
      root_account: @course.root_account,
      wiki_page: @wiki_page,
      user_text: "original text",
      redwood_uuid: SecureRandom.uuid
    )
  end

  def execute_with_input(input_str, user_executing: @student)
    mutation_command = <<~GQL
      mutation {
        updateStudyNote(input: {
          #{input_str}
        }) {
          studyNote {
            _id
            userText
            reactions
            highlightData
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

  it "updates a study note by id" do
    result = execute_with_input("id: #{@note.id} userText: \"updated text\"")
    expect(result["errors"]).to be_nil
    note = result.dig("data", "updateStudyNote", "studyNote")
    expect(note["userText"]).to eq "updated text"
    expect(@note.reload.user_text).to eq "updated text"
  end

  it "updates a study note by redwood_uuid" do
    result = execute_with_input("redwoodUuid: \"#{@note.redwood_uuid}\" userText: \"via uuid\"")
    expect(result["errors"]).to be_nil
    note = result.dig("data", "updateStudyNote", "studyNote")
    expect(note["userText"]).to eq "via uuid"
  end

  it "updates reactions without changing userText" do
    result = execute_with_input("id: #{@note.id} reactions: [\"Question\"]")
    expect(result["errors"]).to be_nil
    expect(@note.reload.reaction).to eq ["Question"]
    expect(@note.reload.user_text).to eq "original text"
    expect(@note.reload.highlight_data).to eq({})
  end

  it "works for horizon courses without the notebook flag" do
    @course.root_account.disable_feature!(:notebook)
    @course.account.enable_feature!(:horizon_course_setting)
    @course.update!(horizon_course: true)
    result = execute_with_input("id: #{@note.id} userText: \"horizon update\"")
    expect(result["errors"]).to be_nil
    expect(result.dig("data", "updateStudyNote", "studyNote")).to be_present
  end

  context "errors" do
    def expect_error(result, message)
      errors = result["errors"] || result.dig("data", "updateStudyNote", "errors")
      expect(errors).not_to be_nil
      expect(errors[0]["message"]).to match(/#{message}/)
    end

    it "returns error when neither id nor redwoodUuid is provided" do
      result = execute_with_input("userText: \"text\"")
      expect_error(result, "Must provide id or redwoodUuid")
    end

    it "returns error when note not found" do
      result = execute_with_input("id: 0 userText: \"text\"")
      expect_error(result, "Study note not found")
    end

    it "returns error when notebook feature flag is disabled" do
      @course.root_account.disable_feature!(:notebook)
      result = execute_with_input("id: #{@note.id} userText: \"text\"")
      expect_error(result, "notebook feature flag is not enabled")
    end

    it "returns error when user does not own the note" do
      other_student = student_in_course(course: @course, active_all: true).user
      result = execute_with_input("id: #{@note.id} userText: \"text\"", user_executing: other_student)
      expect_error(result, "not found")
    end

    it "returns error when current_user is nil" do
      result = execute_with_input("id: #{@note.id} userText: \"text\"", user_executing: nil)
      expect_error(result, "not found")
    end

    it "returns error when note is already deleted" do
      @note.destroy
      result = execute_with_input("id: #{@note.id} userText: \"text\"")
      expect_error(result, "Study note not found")
    end
  end
end
