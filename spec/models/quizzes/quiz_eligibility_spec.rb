# frozen_string_literal: true

#
# Copyright (C) 2015 - present Instructure, Inc.
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

describe Quizzes::QuizEligibility do
  before do
    course_with_student(active_all: true)
    @quiz = course_quiz(active: true)
    @eligibility = Quizzes::QuizEligibility.new(course: @course, user: @student, quiz: @quiz)
  end

  describe "#eligible?" do
    it "always returns true if the user is a teacher" do
      allow(@quiz).to receive(:grants_right?).and_return(false)
      allow(@quiz).to receive(:grants_right?)
        .with(anything, anything, :manage).and_return(true)

      expect(@eligibility).to be_eligible
      expect(@eligibility).to be_potentially_eligible
    end

    it "always returns true if the user can submit" do
      allow(@quiz).to receive(:grants_right?).and_return(false)
      allow(@quiz).to receive(:grants_right?)
        .with(anything, anything, :submit).and_return(true)

      expect(@eligibility).to be_eligible
      expect(@eligibility).to be_potentially_eligible
    end

    it "returns false if no course is provided" do
      allow(@eligibility).to receive(:course).and_return(nil)

      expect(@eligibility).not_to be_eligible
      expect(@eligibility).not_to be_potentially_eligible
    end

    it "returns false if the student is inactive" do
      allow(@user).to receive(:workflow_state).and_return("deleted")

      expect(@eligibility).not_to be_eligible
      expect(@eligibility).not_to be_potentially_eligible
    end

    it "returns false if a user cannot submit or read as an admin" do
      allow(@quiz).to receive(:grants_right?).and_return(false)
      allow(@course).to receive(:grants_right?).and_return(false)

      expect(@eligibility).not_to be_eligible
      expect(@eligibility).not_to be_potentially_eligible
    end

    it "returns true if a user can read as an admin" do
      allow(@quiz).to receive(:grants_right?).and_return(true)
      allow(@quiz).to receive(:grants_right?)
        .with(anything, anything, :manage).and_return(false)
      allow(@course).to receive(:grants_right?).and_return(false)
      allow(@course).to receive(:grants_right?)
        .with(anything, anything, :read_as_admin).and_return(true)

      expect(@eligibility).to be_eligible
      expect(@eligibility).to be_potentially_eligible
    end

    it "returns false if a quiz is access code restricted (but is still potentially_eligible)" do
      @quiz.access_code = "x"

      expect(@eligibility).not_to be_eligible
      expect(@eligibility).to be_potentially_eligible
    end

    it "returns false if a quiz is ip restricted (but is still potentially_eligible)" do
      @quiz.ip_filter = "1.1.1.1"

      expect(@eligibility).not_to be_eligible
      expect(@eligibility).to be_potentially_eligible
    end

    it "returns false if course is completed" do
      other_user = user_factory
      @course.enroll_student(other_user, enrollment_state: "complete")
      allow(@eligibility).to receive(:user).and_return(other_user)

      expect(@eligibility).not_to be_eligible
      expect(@eligibility).not_to be_potentially_eligible
    end

    it "otherwise returns true" do
      expect(@eligibility).to be_eligible
      expect(@eligibility).to be_potentially_eligible
    end

    it "returns false for a student in the main section when the course has concluded via restrict_enrollments_to_course_dates" do
      # Arrange
      course_with_teacher(active_all: true)
      @course.start_at = 30.days.ago
      @course.conclude_at = 10.days.ago
      @course.restrict_enrollments_to_course_dates = true
      @course.save!
      new_section = @course.course_sections.create!(name: "New Section")
      new_section.start_at = 30.days.ago
      new_section.end_at = 10.days.from_now
      new_section.restrict_enrollments_to_section_dates = true
      new_section.save!
      main_section_student = user_with_pseudonym(active_all: true)
      @course.enroll_student(main_section_student, enrollment_state: "active")
      quiz = @course.quizzes.create!(title: "Hierarchy Quiz")
      quiz.publish!
      eligibility = Quizzes::QuizEligibility.new(course: @course, user: main_section_student, quiz:)

      # Act / Assert
      expect(eligibility).not_to be_eligible
      expect(eligibility).not_to be_potentially_eligible
    end

    it "returns false for a section student when the section does not restrict to its own dates and the course has concluded" do
      # Arrange
      course_with_teacher(active_all: true)
      @course.start_at = 30.days.ago
      @course.conclude_at = 10.days.ago
      @course.restrict_enrollments_to_course_dates = true
      @course.save!
      new_section = @course.course_sections.create!(name: "New Section")
      new_section.start_at = 30.days.ago
      new_section.end_at = 10.days.from_now
      new_section.restrict_enrollments_to_section_dates = false
      new_section.save!
      section_student = user_with_pseudonym(active_all: true)
      @course.enroll_student(section_student, enrollment_state: "active", section: new_section)
      quiz = @course.quizzes.create!(title: "Hierarchy Quiz")
      quiz.publish!
      override = quiz.assignment_overrides.build
      override.set = new_section
      override.due_at = 3.days.from_now
      override.due_at_overridden = true
      override.save!
      eligibility = Quizzes::QuizEligibility.new(course: @course, user: section_student, quiz:)

      # Act / Assert
      expect(eligibility).not_to be_eligible
      expect(eligibility).not_to be_potentially_eligible
    end
  end

  describe "#declined_reason_renders" do
    it "returns nil when no additional information should be rendered" do
      expect(@eligibility.declined_reason_renders).to be_nil
    end

    it "returns :access_code when an access code is needed" do
      @quiz.access_code = "x"
      expect(@eligibility.declined_reason_renders).to eq(:access_code)
    end

    it "returns :invalid_ip an invalid IP is used to attempt to take a quiz" do
      @quiz.ip_filter = "1.1.1.1"
      expect(@eligibility.declined_reason_renders).to eq(:invalid_ip)
    end
  end

  describe "#locked?" do
    it "returns false the quiz is not locked" do
      expect(@eligibility).not_to be_locked
    end

    it "returns false if quiz explicitly grant access to the user" do
      allow(@quiz).to receive_messages(locked_for?: true, grants_right?: true)
      expect(@eligibility).not_to be_locked
    end

    it "returns true if the quiz is locked and access is not granted" do
      allow(@quiz).to receive_messages(locked_for?: true, grants_right?: false)
      expect(@eligibility).to be_locked
    end
  end
end
