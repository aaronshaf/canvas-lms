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

describe StudyNote do
  before :once do
    course_factory
    student_in_course
    @root_account = @course.root_account
    @wiki_page = @course.wiki_pages.create!(title: "Intro to Algebra")
    @note = StudyNote.create!(
      user: @student,
      course: @course,
      root_account: @root_account,
      wiki_page: @wiki_page
    )
  end

  describe "workflow_state" do
    it "defaults to active" do
      expect(@note.workflow_state).to eq "active"
    end

    it "soft-deletes via destroy" do
      @note.destroy
      expect(@note.workflow_state).to eq "deleted"
      expect(StudyNote.active).not_to include(@note)
    end

    it "restores via undestroy" do
      @note.destroy
      @note.undestroy
      expect(@note.workflow_state).to eq "active"
      expect(StudyNote.active).to include(@note)
    end
  end

  describe ".for_user" do
    it "returns notes for the given user" do
      expect(StudyNote.for_user(@student)).to include(@note)
    end

    it "excludes notes for other users" do
      other = student_in_course(course: @course).user
      expect(StudyNote.for_user(other)).not_to include(@note)
    end
  end

  describe ".for_course" do
    it "returns notes for the given course" do
      expect(StudyNote.for_course(@course)).to include(@note)
    end

    it "excludes notes from other courses" do
      other_course = course_factory
      expect(StudyNote.for_course(other_course)).not_to include(@note)
    end
  end

  describe ".for_object" do
    it "returns notes matching type and id" do
      expect(StudyNote.for_object("WikiPage", @wiki_page.id)).to include(@note)
    end

    it "excludes notes with a different id" do
      other_page = @course.wiki_pages.create!(title: "Other Page")
      expect(StudyNote.for_object("WikiPage", other_page.id)).not_to include(@note)
    end

    it "excludes notes with a different type" do
      assignment = @course.assignments.create!(title: "Test Assignment")
      expect(StudyNote.for_object("Assignment", assignment.id)).not_to include(@note)
    end

    it "finds notes for an assignment" do
      assignment = @course.assignments.create!(title: "Test Assignment")
      note = StudyNote.create!(user: @student, course: @course, root_account: @root_account, assignment:)
      expect(StudyNote.for_object("Assignment", assignment.id)).to include(note)
    end

    it "finds notes for a quiz" do
      quiz = @course.quizzes.create!(title: "Test Quiz")
      note = StudyNote.create!(user: @student, course: @course, root_account: @root_account, quiz:)
      expect(StudyNote.for_object("Quizzes::Quiz", quiz.id)).to include(note)
    end

    it "returns none for an unknown type" do
      expect(StudyNote.for_object(nil, @wiki_page.id)).to eq StudyNote.none
    end
  end

  describe "learning object presence validation" do
    it "is invalid without a learning object" do
      note = StudyNote.new(user: @student, course: @course, root_account: @root_account)
      expect(note).not_to be_valid
    end
  end

  describe ".with_reactions" do
    it "returns notes that have any of the given reactions" do
      @note.update!(reaction: ["Important", "Question"])
      expect(StudyNote.with_reactions(["Important"])).to include(@note)
    end

    it "excludes notes without the given reactions" do
      @note.update!(reaction: [])
      expect(StudyNote.with_reactions(["Important"])).not_to include(@note)
    end
  end

  describe "defaults" do
    it "defaults reaction to an empty array" do
      expect(@note.reaction).to eq []
    end

    it "defaults highlight_data to an empty hash" do
      expect(@note.highlight_data).to eq({})
    end
  end

  describe "user_text length validation" do
    it "accepts text within the limit" do
      @note.user_text = "a" * 100
      expect(@note).to be_valid
    end

    it "rejects text over the limit" do
      @note.user_text = "a" * (StudyNote.maximum_text_length + 1)
      expect(@note).not_to be_valid
      expect(@note.errors[:user_text].first).to match(/\ANote text is too long \([\d,]+ character maximum\)\z/)
    end
  end

  describe "reaction max size validation" do
    it "allows up to 20 reactions" do
      @note.reaction = Array.new(20, "Important")
      expect(@note).to be_valid
    end

    it "rejects more than 20 reactions" do
      @note.reaction = Array.new(21, "Important")
      expect(@note).not_to be_valid
      expect(@note.errors[:reaction]).to be_present
    end
  end

  describe "per-object note limit validation" do
    it "rejects a note that would exceed the per-object limit" do
      stub_const("StudyNote::NOTES_PER_OBJECT_LIMIT", 2)
      StudyNote.create!(user: @student, course: @course, root_account: @root_account, wiki_page: @wiki_page)
      over_limit = StudyNote.new(user: @student, course: @course, root_account: @root_account, wiki_page: @wiki_page)
      expect(over_limit).not_to be_valid
      expect(over_limit.errors[:base].join).to match(/Note limit of 2 per page reached/)
    end

    it "allows a note on a different object when another object is at the limit" do
      stub_const("StudyNote::NOTES_PER_OBJECT_LIMIT", 1)
      # @note already puts @wiki_page at the limit of 1
      other_page = @course.wiki_pages.create!(title: "Another Page")
      note = StudyNote.new(user: @student, course: @course, root_account: @root_account, wiki_page: other_page)
      expect(note).to be_valid
    end

    it "exempts notes migrated from Redwood" do
      stub_const("StudyNote::NOTES_PER_OBJECT_LIMIT", 1)
      # @note already puts @wiki_page at the limit of 1
      migrated = StudyNote.new(user: @student, course: @course, root_account: @root_account, wiki_page: @wiki_page, redwood_uuid: SecureRandom.uuid)
      expect(migrated).to be_valid
    end
  end
end
