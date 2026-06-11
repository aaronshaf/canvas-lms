# frozen_string_literal: true

#
# Copyright (C) 2025 - present Instructure, Inc.
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

describe Loaders::PeerReviewStatusLoader do
  before(:once) do
    course_with_teacher(active_all: true)
    @assignment = @course.assignments.create!(
      title: "Peer Review Assignment",
      points_possible: 10,
      peer_reviews: true,
      peer_review_count: 2
    )
    @student1 = user_factory(name: "Student One")
    @student2 = user_factory(name: "Student Two")
    @student3 = user_factory(name: "Student Three")

    @course.enroll_student(@student1, enrollment_state: "active")
    @course.enroll_student(@student2, enrollment_state: "active")
    @course.enroll_student(@student3, enrollment_state: "active")
  end

  let(:loader) { described_class.new(@assignment.id, current_principal: @teacher.principal) }

  before do
    @submission1 = @assignment.submit_homework(@student1, {
                                                 submission_type: "online_text_entry",
                                                 body: "Student 1 submission"
                                               })
    @submission2 = @assignment.submit_homework(@student2, {
                                                 submission_type: "online_text_entry",
                                                 body: "Student 2 submission"
                                               })
    @submission3 = @assignment.submit_homework(@student3, {
                                                 submission_type: "online_text_entry",
                                                 body: "Student 3 submission"
                                               })
  end

  describe "#perform" do
    context "with allocation rules and assessment requests" do
      before do
        AllocationRule.create!(
          assignment: @assignment,
          course: @course,
          assessor: @student1,
          assessee: @student2,
          must_review: true
        )
        AllocationRule.create!(
          assignment: @assignment,
          course: @course,
          assessor: @student1,
          assessee: @student3,
          must_review: true
        )
        AllocationRule.create!(
          assignment: @assignment,
          course: @course,
          assessor: @student2,
          assessee: @student1,
          must_review: true
        )

        # Create completed assessment requests
        AssessmentRequest.create!(
          asset: @submission2,
          assessor_asset: @submission1,
          user: @student2,
          assessor: @student1,
          workflow_state: "completed"
        )
        AssessmentRequest.create!(
          asset: @submission1,
          assessor_asset: @submission2,
          user: @student1,
          assessor: @student2,
          workflow_state: "completed"
        )
      end

      it "returns correct counts for users with allocation rules and completed reviews" do
        GraphQL::Batch.batch do
          result1 = loader.load(@student1.id)
          result2 = loader.load(@student2.id)
          result3 = loader.load(@student3.id)

          expect(result1.sync).to eq({
                                       must_review_count: 2,
                                       completed_reviews_count: 1
                                     })

          expect(result2.sync).to eq({
                                       must_review_count: 1,
                                       completed_reviews_count: 1
                                     })

          expect(result3.sync).to eq({
                                       must_review_count: 0,
                                       completed_reviews_count: 0
                                     })
        end
      end
    end

    context "with no allocation rules or assessment requests" do
      it "returns zero counts for all users" do
        GraphQL::Batch.batch do
          result1 = loader.load(@student1.id)
          result2 = loader.load(@student2.id)

          expect(result1.sync).to eq({
                                       must_review_count: 0,
                                       completed_reviews_count: 0
                                     })

          expect(result2.sync).to eq({
                                       must_review_count: 0,
                                       completed_reviews_count: 0
                                     })
        end
      end
    end

    context "with inactive allocation rules" do
      before do
        AllocationRule.create!(
          assignment: @assignment,
          course: @course,
          assessor: @student1,
          assessee: @student2,
          must_review: true,
          workflow_state: "deleted"
        )
      end

      it "ignores inactive allocation rules" do
        GraphQL::Batch.batch do
          result = loader.load(@student1.id)
          expect(result.sync[:must_review_count]).to eq(0)
        end
      end
    end

    context "with incomplete assessment requests" do
      before do
        # Create incomplete assessment request
        AssessmentRequest.create!(
          asset: @submission2,
          assessor_asset: @submission1,
          user: @student2,
          assessor: @student1,
          workflow_state: "assigned"
        )
      end

      it "ignores incomplete assessment requests" do
        GraphQL::Batch.batch do
          result = loader.load(@student1.id)
          expect(result.sync[:completed_reviews_count]).to eq(0)
        end
      end
    end

    context "when teacher has section-limited visibility" do
      let(:section1) { @course.course_sections.create!(name: "Section 1") }
      let(:section2) { @course.course_sections.create!(name: "Section 2") }
      let(:section_limited_teacher) do
        user_factory(name: "Section Limited Teacher").tap do |u|
          @course.enroll_teacher(u, section: section1, limit_privileges_to_course_section: true, enrollment_state: "active")
        end
      end

      before do
        @course.enroll_student(@student1, section: section1, allow_multiple_enrollments: true, enrollment_state: "active")
        @course.enroll_student(@student2, section: section2, allow_multiple_enrollments: true, enrollment_state: "active")

        AllocationRule.create!(
          assignment: @assignment,
          course: @course,
          assessor: @student2,
          assessee: @student1,
          must_review: true
        )
      end

      it "returns zero counts for students outside the teacher's section" do
        scoped_loader = described_class.new(@assignment.id, current_principal: section_limited_teacher.principal)
        GraphQL::Batch.batch do
          result = scoped_loader.load(@student2.id)
          expect(result.sync).to eq({ must_review_count: 0, completed_reviews_count: 0 })
        end
      end

      it "returns correct counts for students in the teacher's section" do
        AllocationRule.create!(
          assignment: @assignment,
          course: @course,
          assessor: @student1,
          assessee: @student2,
          must_review: true
        )
        scoped_loader = described_class.new(@assignment.id, current_principal: section_limited_teacher.principal)
        GraphQL::Batch.batch do
          result = scoped_loader.load(@student1.id)
          expect(result.sync).to eq({ must_review_count: 1, completed_reviews_count: 0 })
        end
      end
    end

    context "when user is not assigned to the assignment" do
      let(:outside_student) { user_factory(name: "Outside Student") }

      before do
        @course.enroll_student(outside_student, enrollment_state: "active")

        @assignment.update!(only_visible_to_overrides: true)
        override = @assignment.assignment_overrides.create!(set_type: "ADHOC")
        [@student1, @student2, @student3].each { |s| override.assignment_override_students.create!(user: s) }
        @assignment.assign_peer_review(outside_student, @student1).update!(workflow_state: "completed")

        AllocationRule.new(
          assignment: @assignment,
          course: @course,
          assessor: outside_student,
          assessee: @student1,
          must_review: true
        ).save(validate: false)
      end

      it "returns zero counts for users not assigned to the assignment" do
        GraphQL::Batch.batch do
          result = loader.load(outside_student.id)
          expect(result.sync).to eq({ must_review_count: 0, completed_reviews_count: 0 })
        end
      end
    end
  end
end
