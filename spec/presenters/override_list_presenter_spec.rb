# frozen_string_literal: true

#
# Copyright (C) 2013 - present Instructure, Inc.
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

describe OverrideListPresenter do
  include TextHelper

  before do
    allow(AssignmentOverrideApplicator).to receive(:assignment_overridden_for)
      .with(assignment, user).and_return overridden_assignment
    allow(AssignmentOverrideApplicator).to receive(:assignment_overridden_for)
      .with(assignment, nil).and_return assignment
    allow(assignment).to receive(:has_active_overrides?).and_return true
  end

  around do |example|
    Timecop.freeze(Time.zone.local(2013, 3, 13, 0, 0), &example)
  end

  let(:course) { course_factory(active_all: true) }
  let(:assignment) { course.assignments.create!(title: "Testing") }
  let(:user) { student_in_course(course:, name: "Testing").user }
  let(:second_user) { student_in_course(course:, name: "Testing 2").user }
  let(:overridden_assignment) { assignment }
  let(:presenter) { OverrideListPresenter.new assignment, user }

  describe "#initialize" do
    it "keeps a reference to the user" do
      presenter = OverrideListPresenter.new nil, user
      expect(presenter.user).to eq user
    end

    context "assignment present? and user present?" do
      it "stores a reference to the overridden assignment for that user" do
        presenter = OverrideListPresenter.new assignment, user
        expect(presenter.assignment).to eq overridden_assignment
      end
    end

    context "assignment or user not present?" do
      it "stores the assignment as nil if assignment not present?" do
        presenter = OverrideListPresenter.new nil, user
        expect(presenter.assignment).to be_nil
        expect(presenter.user).to eq user
      end
    end
  end

  describe "#formatted_date_string" do
    context "due_at" do
      it "returns - if due_at isn't present" do
        due_date_hash = { due_at: nil }
        expect(presenter.formatted_date_string(:due_at, due_date_hash)).to eq "-"
        due_date_hash[:due_at] = ""
        expect(presenter.formatted_date_string(:due_at, due_date_hash)).to eq "-"
      end

      it "returns a shortened version with just the date if time is 11:59" do
        fancy_midnight = CanvasTime.fancy_midnight Time.zone.now
        due_date_hash = { due_at: fancy_midnight }
        expect(presenter.formatted_date_string(:due_at, due_date_hash)).to eq(
          date_string(fancy_midnight, :no_words)
        )
      end

      it "returns returns datetime_string if not all day but date present" do
        due_date_hash = { due_at: Time.zone.now }
        expect(presenter.formatted_date_string(:due_at, due_date_hash)).to eq(
          datetime_string(Time.zone.now)
        )
      end
    end

    context "lock_at and unlock_at" do
      it "returns returns datetime_string of not all day but date present" do
        due_date_hash = { lock_at: Time.zone.now, unlock_at: 1.day.ago }
        expect(presenter.formatted_date_string(:lock_at, due_date_hash)).to eq(
          datetime_string(Time.zone.now)
        )
        expect(presenter.formatted_date_string(:unlock_at, due_date_hash)).to eq(
          datetime_string(1.day.ago)
        )
      end

      it "returns - if due_at isn't present" do
        due_date_hash = { lock_at: nil }
        expect(presenter.formatted_date_string(:lock_at, due_date_hash)).to eq "-"
        due_date_hash[:lock_at] = ""
        expect(presenter.formatted_date_string(:lock_at, due_date_hash)).to eq "-"
        due_date_hash = { unlock_at: nil }
        expect(presenter.formatted_date_string(:unlock_at, due_date_hash)).to eq "-"
        due_date_hash[:unlock_at] = ""
        expect(presenter.formatted_date_string(:unlock_at, due_date_hash)).to eq "-"
      end

      it "never takes all_day into effect" do
        due_date_hash = { lock_at: Time.zone.now, all_day: true }
        expect(presenter.formatted_date_string(:lock_at, due_date_hash)).to eq(
          datetime_string(Time.zone.now)
        )
        due_date_hash = { unlock_at: Time.zone.now, all_day: true }
        expect(presenter.formatted_date_string(:unlock_at, due_date_hash)).to eq(
          datetime_string(Time.zone.now)
        )
      end
    end
  end

  describe "#multiple_due_dates?" do
    it "returns the result of assignment.multiple_due_dates_apply_to?(user)" do
      expect(assignment).to receive(:has_active_overrides?).and_return true
      expect(presenter.multiple_due_dates?).to be true
      expect(assignment).to receive(:has_active_overrides?).and_return false
      expect(presenter.multiple_due_dates?).to be false
    end

    it "returns false if its assignment is nil" do
      presenter = OverrideListPresenter.new nil, user
      expect(presenter.multiple_due_dates?).to be false
    end
  end

  describe "#due_for" do
    it "returns the due date's title if it is present?" do
      due_date = { title: "default" }
      expect(presenter.due_for(due_date)).to eq "default"
    end

    it "returns 'Everyone else' if multiple due dates for assignment" do
      expect(assignment).to receive(:has_active_overrides?).once.and_return true
      due_date = {}
      expect(presenter.due_for(due_date)).to eq(
        I18n.t("overrides.everyone_else", "Everyone else")
      )
    end

    it "returns 'Everyone' translated if not multiple due dates" do
      expect(assignment).to receive(:has_active_overrides?).once.and_return false
      due_date = {}
      expect(presenter.due_for(due_date)).to eq(
        I18n.t("overrides.everyone", "Everyone")
      )
    end

    context "for ADHOC overrides" do
      before do
        override = assignment.assignment_overrides.create!(due_at: 1.week.from_now)
        override.assignment_override_students.create!(user:, assignment:)
        override.assignment_override_students.create!(user: second_user, assignment:)
        override.save!

        @due_date = presenter.assignment.dates_hash_visible_to(user).first
      end

      it "returns a dynamically generated title based on the number of current and invited users" do
        expect(presenter.due_for(@due_date)).to eql("2 students")
      end

      it "does not count concluded students" do
        course.enrollments.find_by(user: second_user).conclude
        expect(presenter.due_for(@due_date)).to eql("1 student")
      end

      it "does not count inactive students" do
        course.enrollments.find_by(user: second_user).deactivate
        expect(presenter.due_for(@due_date)).to eql("1 student")
      end

      it "does not count deleted students" do
        course.enrollments.find_by(user: second_user).destroy
        expect(presenter.due_for(@due_date)).to eql("1 student")
      end

      it "does not double-count students that have multiple enrollments in the course" do
        section = course.course_sections.create!
        course.enroll_student(user, section:, enrollment_state: "active", allow_multiple_enrollments: true)
        expect(presenter.due_for(@due_date)).to eql("2 students")
      end
    end
  end

  describe "#visible_due_dates" do
    attr_reader :visible_due_dates

    def dates_visible_to_user
      [
        { due_at: "", lock_at: nil, unlock_at: nil, set_type: "CourseSection" },
        { due_at: 1.hour.from_now, lock_at: nil, unlock_at: nil, set_type: "CourseSection" },
        { due_at: 2.hours.from_now, lock_at: nil, unlock_at: nil, set_type: "CourseSection" },
        { due_at: 1.hour.ago, lock_at: nil, unlock_at: nil, base: true }
      ]
    end

    it "returns empty array if assignment is not present" do
      presenter = OverrideListPresenter.new nil, user
      expect(presenter.visible_due_dates).to eq []
    end

    context "with assignment present as a teacher" do
      before do
        @section1 = course.course_sections.create! name: "section 1"
        @section2 = course.course_sections.create! name: "section 2"
        @overridden_assignment = course.assignments.create!(title: "Overridden Assignment")
        @teacher = teacher_in_course(course:, name: "Testing").user
        allow(AssignmentOverrideApplicator).to receive(:assignment_overridden_for)
          .with(@overridden_assignment, @teacher).and_return @overridden_assignment
        @presenter = OverrideListPresenter.new @overridden_assignment, @teacher
      end

      context "when all sections have overrides" do
        before do
          @overridden_assignment.assignment_overrides.create!(set: @section1)
          @overridden_assignment.assignment_overrides.create!(set: @section2, due_at: 1.hour.from_now)
          @overridden_assignment.assignment_overrides.create!(set: course.default_section, due_at: 2.hours.from_now)
          @overridden_assignment.due_at = 1.hour.ago
          @overridden_assignment.save!

          @visible_due_dates = @presenter.visible_due_dates
        end

        it "doesn't include the default due date" do
          expect(visible_due_dates.length).to eq 3
          visible_due_dates.each do |override|
            expect(override[:base]).not_to be_truthy
          end
        end

        it "sorts due dates by due_at, placing not present?/nil after dates" do
          expect(visible_due_dates.first[:due_at]).to eq(
            presenter.formatted_date_string(:due_at, dates_visible_to_user.second)
          )
          expect(visible_due_dates.second[:due_at]).to eq(
            presenter.formatted_date_string(:due_at, dates_visible_to_user.third)
          )
          expect(visible_due_dates.third[:due_at]).to eq(
            presenter.formatted_date_string(:due_at, dates_visible_to_user.first)
          )
        end

        it "includes the actual Time for presentation transforms in templates" do
          expect(visible_due_dates.second[:raw][:due_at]).to be_a(Time)
        end
      end

      context "only some sections have overrides" do
        before do
          @overridden_assignment.assignment_overrides.create!(set: @section2, due_at: 1.day.from_now)
          @overridden_assignment.due_at = 2.days.ago
          @overridden_assignment.save!

          @visible_due_dates = @presenter.visible_due_dates
        end

        it "includes the default due date" do
          expect(visible_due_dates.detect { |due_date| due_date[:due_for] == "Everyone else" })
            .not_to be_nil
        end
      end

      context "with module overrides" do
        before do
          @module = course.context_modules.create!(name: "Module 1")
          @module.add_item(type: "assignment", id: @overridden_assignment.id)
          @module.assignment_overrides.create!(set: @section1)
          @overridden_assignment.due_at = 2.days.ago
          @overridden_assignment.save!

          @visible_due_dates = @presenter.visible_due_dates
        end

        it "does not include the default due date" do
          expect(visible_due_dates.detect { |due_date| due_date[:due_for] == "Everyone else" })
            .to be_nil
        end

        it "includes the module overrides" do
          expect(visible_due_dates.detect { |due_date| due_date[:due_for] == "section 1" })
            .not_to be_nil
        end

        it "does not duplicate overwritten module overrides" do
          @overridden_assignment.assignment_overrides.create!(set: @section1, due_at: 1.day.from_now)
          @overridden_assignment.due_at = 2.days.ago
          @overridden_assignment.save!
          @visible_due_dates = @presenter.visible_due_dates

          expect(visible_due_dates.length).to eq 1
          expect(visible_due_dates.first[:due_for]).to eq "section 1"
          expect(visible_due_dates.first[:due_at]).not_to be_nil
        end

        it "ignores unassigned module overrides" do
          @module.assignment_overrides.create!(set: @section2)
          @overridden_assignment.assignment_overrides.create!(set: @section2, unassign_item: true)

          @visible_due_dates = @presenter.visible_due_dates
          expect(visible_due_dates.length).to eq 1
          expect(visible_due_dates.first[:due_for]).to eq "section 1"
        end

        it "includes Course overrides" do
          @overridden_assignment.assignment_overrides.create!(set: course, due_at: 1.hour.from_now)
          @overridden_assignment.due_at = 2.days.ago
          @overridden_assignment.save!

          @visible_due_dates = @presenter.visible_due_dates
          expect(visible_due_dates.length).to eq 2
          expect(visible_due_dates.detect do |due_date|
            due_date[:due_for] == "Everyone else" &&
            due_date[:due_at] == presenter.formatted_date_string(:due_at, dates_visible_to_user.second)
          end)
            .not_to be_nil
        end
      end

      context "assignment-level overrides for quiz show overrides table" do
        let(:due_at) { Time.zone.parse("2024-04-15") }
        let(:unlock_at) { Time.zone.parse("2024-04-10") }
        let(:lock_at) { Time.zone.parse("2024-04-20") }
        let(:override_params) do
          {
            due_at_overridden: true,
            unlock_at:,
            unlock_at_overridden: true,
            lock_at:,
            lock_at_overridden: true,
          }
        end

        before do
          @section_alpha = course.course_sections.create!(name: "Section Alpha")
          @section_beta = course.course_sections.create!(name: "Section Beta")
          @category = course.group_categories.create!(name: "Course Group")
          @group_a = @category.groups.create!(name: "Course Group A", context: course)
          @group_b = @category.groups.create!(name: "Course Group B", context: course)
          @student1 = student_in_course(course:, name: "Student 1", active_all: true).user
          @student2 = student_in_course(course:, name: "Student 2", active_all: true).user
        end

        it "returns a single Everyone row with assignment dates when only_visible_to_overrides is false and no overrides exist" do
          @overridden_assignment.update!(due_at:, unlock_at:, lock_at:, only_visible_to_overrides: false)
          @visible_due_dates = @presenter.visible_due_dates

          expect(@visible_due_dates.length).to eq 1
          everyone_row = @visible_due_dates.first
          expect(everyone_row[:due_for]).to eq "Everyone"
          expect(everyone_row[:due_at]).to eq @presenter.formatted_date_string(:due_at, due_at: @overridden_assignment.due_at)
          expect(everyone_row[:unlock_at]).to eq @presenter.formatted_date_string(:unlock_at, unlock_at: @overridden_assignment.unlock_at)
          expect(everyone_row[:lock_at]).to eq @presenter.formatted_date_string(:lock_at, lock_at: @overridden_assignment.lock_at)
        end

        it "includes Everyone else row alongside assignment-level adhoc and section overrides with base dates" do
          @overridden_assignment.update!(due_at:, unlock_at:, lock_at:, only_visible_to_overrides: false, group_category: @category)

          adhoc = @overridden_assignment.assignment_overrides.create!(set_type: "ADHOC", title: "2 students", due_at: due_at + 1.day, **override_params)
          adhoc.assignment_override_students.create!(user: @student1)
          adhoc.assignment_override_students.create!(user: @student2)
          @overridden_assignment.assignment_overrides.create!(set: @section_alpha, due_at: due_at + 2.days, **override_params)
          @overridden_assignment.assignment_overrides.create!(set: @section_beta, due_at: due_at + 2.days, **override_params)
          @overridden_assignment.assignment_overrides.create!(set: @group_a, due_at: due_at + 3.days, **override_params)
          @overridden_assignment.assignment_overrides.create!(set: @group_b, due_at: due_at + 3.days, **override_params)

          @visible_due_dates = @presenter.visible_due_dates
          labels = @visible_due_dates.pluck(:due_for)

          expect(labels).to include("Everyone else")

          everyone_else = @visible_due_dates.detect { |d| d[:due_for] == "Everyone else" }
          expect(everyone_else[:due_at]).to eq @presenter.formatted_date_string(:due_at, due_at: @overridden_assignment.due_at)
        end

        it "returns an empty list when only_visible_to_overrides is true and no overrides exist" do
          @overridden_assignment.update!(due_at:, unlock_at:, lock_at:, only_visible_to_overrides: true)

          expect(@presenter.visible_due_dates).to eq []
        end

        it "omits Everyone and Everyone else when only_visible_to_overrides is true and per-target overrides exist" do
          @overridden_assignment.update!(due_at:, unlock_at:, lock_at:, only_visible_to_overrides: true, group_category: @category)

          adhoc = @overridden_assignment.assignment_overrides.create!(set_type: "ADHOC", title: "2 students", due_at:, **override_params)
          adhoc.assignment_override_students.create!(user: @student1)
          adhoc.assignment_override_students.create!(user: @student2)
          @overridden_assignment.assignment_overrides.create!(set: @section_alpha, due_at: due_at + 1.day, **override_params)
          @overridden_assignment.assignment_overrides.create!(set: @section_beta, due_at: due_at + 1.day, **override_params)
          @overridden_assignment.assignment_overrides.create!(set: @group_a, due_at: due_at + 2.days, **override_params)
          @overridden_assignment.assignment_overrides.create!(set: @group_b, due_at: due_at + 2.days, **override_params)

          @visible_due_dates = @presenter.visible_due_dates
          labels = @visible_due_dates.pluck(:due_for)

          expect(labels).not_to include("Everyone else", "Everyone")
        end

        it "returns a single Everyone row when only a Course-level override exists" do
          @overridden_assignment.update!(due_at: nil, unlock_at: nil, lock_at: nil, only_visible_to_overrides: false)
          course_override = @overridden_assignment.assignment_overrides.create!(set_type: "Course", set_id: course.id, due_at:, unlock_at:, lock_at:)

          @visible_due_dates = @presenter.visible_due_dates

          expect(@visible_due_dates.length).to eq 1
          row = @visible_due_dates.first
          expect(row[:due_for]).to eq "Everyone"
          expect(row[:due_at]).to eq @presenter.formatted_date_string(:due_at, due_at: course_override.reload.due_at)
          expect(row[:unlock_at]).to eq @presenter.formatted_date_string(:unlock_at, unlock_at: course_override.unlock_at)
          expect(row[:lock_at]).to eq @presenter.formatted_date_string(:lock_at, lock_at: course_override.lock_at)
        end

        it "filters assignment-level unassign_item overrides out of visible_due_dates" do
          @overridden_assignment.update!(due_at:, unlock_at:, lock_at:, only_visible_to_overrides: false, group_category: @category)

          adhoc = @overridden_assignment.assignment_overrides.create!(set_type: "ADHOC", title: "2 students", due_at:, unassign_item: true, **override_params)
          adhoc.assignment_override_students.create!(user: @student1)
          adhoc.assignment_override_students.create!(user: @student2)
          @overridden_assignment.assignment_overrides.create!(set: @section_alpha, due_at:, unassign_item: true, **override_params)
          @overridden_assignment.assignment_overrides.create!(set: @section_beta, due_at:, unassign_item: true, **override_params)
          @overridden_assignment.assignment_overrides.create!(set: @group_a, due_at:, unassign_item: true, **override_params)
          @overridden_assignment.assignment_overrides.create!(set: @group_b, due_at:, unassign_item: true, **override_params)

          @visible_due_dates = @presenter.visible_due_dates

          expect(@visible_due_dates.length).to eq 1
          expect(@visible_due_dates.first[:due_for]).to eq "Everyone"
          expect(@visible_due_dates.first[:due_at]).to eq @presenter.formatted_date_string(:due_at, due_at: @overridden_assignment.due_at)
        end

        context "with module overrides and assignment-level overrides" do
          before do
            @module = course.context_modules.create!(name: "Module 1")
            @module.add_item(type: "assignment", id: @overridden_assignment.id)
          end

          it "suppresses Everyone and Everyone else when module overrides duplicate the assignment override set" do
            @overridden_assignment.update!(due_at:, unlock_at:, lock_at:, only_visible_to_overrides: false, group_category: @category)

            module_adhoc = @module.assignment_overrides.create!(set_type: "ADHOC", title: "2 students")
            module_adhoc.assignment_override_students.create!(user: @student1)
            module_adhoc.assignment_override_students.create!(user: @student2)
            @module.assignment_overrides.create!(set: @section_alpha)
            @module.assignment_overrides.create!(set: @section_beta)
            @module.assignment_overrides.create!(set: @group_a)
            @module.assignment_overrides.create!(set: @group_b)

            adhoc = @overridden_assignment.assignment_overrides.create!(set_type: "ADHOC", title: "2 students", due_at:, **override_params)
            adhoc.assignment_override_students.create!(user: @student1)
            adhoc.assignment_override_students.create!(user: @student2)
            @overridden_assignment.assignment_overrides.create!(set: @section_alpha, due_at:, **override_params)
            @overridden_assignment.assignment_overrides.create!(set: @section_beta, due_at:, **override_params)
            @overridden_assignment.assignment_overrides.create!(set: @group_a, due_at:, **override_params)
            @overridden_assignment.assignment_overrides.create!(set: @group_b, due_at:, **override_params)

            @visible_due_dates = @presenter.visible_due_dates
            labels = @visible_due_dates.pluck(:due_for)

            expect(labels).not_to include("Everyone", "Everyone else")
          end

          it "returns inherited section rows without dates alongside assignment-overridden rows with dates" do
            @overridden_assignment.update!(due_at:, unlock_at:, lock_at:, only_visible_to_overrides: false, group_category: @category)

            module_adhoc = @module.assignment_overrides.create!(set_type: "ADHOC", title: "2 students")
            module_adhoc.assignment_override_students.create!(user: @student1)
            module_adhoc.assignment_override_students.create!(user: @student2)
            @module.assignment_overrides.create!(set: @section_alpha)
            @module.assignment_overrides.create!(set: @section_beta)

            adhoc = @overridden_assignment.assignment_overrides.create!(set_type: "ADHOC", title: "2 students", due_at:, **override_params)
            adhoc.assignment_override_students.create!(user: @student1)
            adhoc.assignment_override_students.create!(user: @student2)
            @overridden_assignment.assignment_overrides.create!(set: @group_a, due_at:, **override_params)
            @overridden_assignment.assignment_overrides.create!(set: @group_b, due_at:, **override_params)

            @visible_due_dates = @presenter.visible_due_dates
            labels = @visible_due_dates.pluck(:due_for)

            expect(labels).not_to include("Everyone", "Everyone else")

            inherited_alpha = @visible_due_dates.detect { |d| d[:due_for] == "Section Alpha" }
            inherited_beta = @visible_due_dates.detect { |d| d[:due_for] == "Section Beta" }
            if inherited_alpha
              expect(inherited_alpha[:due_at]).to eq "-"
              expect(inherited_alpha[:unlock_at]).to eq "-"
              expect(inherited_alpha[:lock_at]).to eq "-"
            end
            if inherited_beta
              expect(inherited_beta[:due_at]).to eq "-"
            end

            overridden_adhoc = @visible_due_dates.detect { |d| d[:due_for] == "2 students" }
            if overridden_adhoc
              expect(overridden_adhoc[:due_at]).to eq @presenter.formatted_date_string(:due_at, due_at:)
            end
          end
        end
      end
    end
  end

  context "non-collaborative groups" do
    let!(:collaborative_group_category) { course.group_categories.create!(name: "Collaborative Category") }
    let!(:non_collaborative_group_category) { course.group_categories.create!(name: "Non-Collaborative Category", non_collaborative: true) }
    let!(:collaborative_group) { collaborative_group_category.groups.create!(name: "Collaborative Group", context: course) }
    let!(:non_collaborative_group) { non_collaborative_group_category.groups.create!(name: "Non-Collaborative Group", context: course) }
    let!(:another_non_collaborative_group) { non_collaborative_group_category.groups.create!(name: "Another Non-Collaborative Group", context: course) }

    describe "#convert_non_collaborative_groups_to_tags" do
      it "returns empty array when given empty overrides" do
        result = presenter.convert_non_collaborative_groups_to_tags([])
        expect(result).to eq([])
      end

      it "leaves collaborative groups unchanged" do
        overrides = [
          {
            options: ["group-#{collaborative_group.id}", "section-123"],
            due_at: 1.day.from_now
          }
        ]

        result = presenter.convert_non_collaborative_groups_to_tags(overrides)

        expect(result).to eq([
                               {
                                 options: ["group-#{collaborative_group.id}", "section-123"],
                                 due_at: 1.day.from_now
                               }
                             ])
      end

      it "converts non-collaborative groups to tags" do
        overrides = [
          {
            options: ["group-#{non_collaborative_group.id}", "section-123"],
            due_at: 1.day.from_now
          }
        ]

        result = presenter.convert_non_collaborative_groups_to_tags(overrides)

        expect(result).to eq([
                               {
                                 options: ["tag-#{non_collaborative_group.id}", "section-123"],
                                 due_at: 1.day.from_now
                               }
                             ])
      end

      it "handles mixed collaborative and non-collaborative groups" do
        overrides = [
          {
            options: ["group-#{collaborative_group.id}", "group-#{non_collaborative_group.id}", "section-123"],
            due_at: 1.day.from_now
          }
        ]

        result = presenter.convert_non_collaborative_groups_to_tags(overrides)

        expect(result).to eq([
                               {
                                 options: ["group-#{collaborative_group.id}", "tag-#{non_collaborative_group.id}", "section-123"],
                                 due_at: 1.day.from_now
                               }
                             ])
      end

      it "handles multiple overrides with different group types" do
        overrides = [
          {
            options: ["group-#{collaborative_group.id}"],
            due_at: 1.day.from_now
          },
          {
            options: ["group-#{non_collaborative_group.id}", "group-#{another_non_collaborative_group.id}"],
            due_at: 2.days.from_now
          }
        ]

        result = presenter.convert_non_collaborative_groups_to_tags(overrides)

        expect(result).to eq([
                               {
                                 options: ["group-#{collaborative_group.id}"],
                                 due_at: 1.day.from_now
                               },
                               {
                                 options: ["tag-#{non_collaborative_group.id}", "tag-#{another_non_collaborative_group.id}"],
                                 due_at: 2.days.from_now
                               }
                             ])
      end

      it "ignores options that don't match group format" do
        overrides = [
          {
            options: %w[student-123 section-456 everyone invalid-format],
            due_at: 1.day.from_now
          }
        ]

        result = presenter.convert_non_collaborative_groups_to_tags(overrides)

        expect(result).to eq([
                               {
                                 options: %w[student-123 section-456 everyone invalid-format],
                                 due_at: 1.day.from_now
                               }
                             ])
      end

      it "handles non-existent group IDs gracefully" do
        non_existent_group_id = Group.maximum(:id).to_i + 1000
        overrides = [
          {
            options: ["group-#{non_existent_group_id}", "section-123"],
            due_at: 1.day.from_now
          }
        ]

        result = presenter.convert_non_collaborative_groups_to_tags(overrides)

        expect(result).to eq([
                               {
                                 options: ["group-#{non_existent_group_id}", "section-123"],
                                 due_at: 1.day.from_now
                               }
                             ])
      end

      it "optimizes database queries by batching group lookups" do
        overrides = [
          {
            options: ["group-#{non_collaborative_group.id}"],
            due_at: 1.day.from_now
          },
          {
            options: ["group-#{another_non_collaborative_group.id}"],
            due_at: 2.days.from_now
          }
        ]

        expect(Group).to receive(:non_collaborative).once.and_call_original

        presenter.convert_non_collaborative_groups_to_tags(overrides)
      end

      it "preserves all other override properties" do
        custom_property = "custom_value"
        overrides = [
          {
            options: ["group-#{non_collaborative_group.id}"],
            due_at: 1.day.from_now,
            lock_at: 2.days.from_now,
            unlock_at: 1.day.ago,
            custom_property:
          }
        ]

        result = presenter.convert_non_collaborative_groups_to_tags(overrides)

        expect(result.first[:custom_property]).to eq(custom_property)
        expect(result.first[:due_at]).to eq(overrides.first[:due_at])
        expect(result.first[:lock_at]).to eq(overrides.first[:lock_at])
        expect(result.first[:unlock_at]).to eq(overrides.first[:unlock_at])
      end
    end

    describe "#convert_non_collaborative_groups_to_tags_v2" do
      it "returns empty array when given empty overrides" do
        result = presenter.convert_non_collaborative_groups_to_tags_v2([])
        expect(result).to eq([])
      end

      it "converts non-collaborative groups to tags" do
        overrides = [
          {
            set_type: "Group",
            set_id: non_collaborative_group.id,
            due_at: 1.day.from_now
          }
        ]

        result = presenter.convert_non_collaborative_groups_to_tags_v2(overrides)

        expect(result.first[:set_type]).to eq("Tag")
        expect(result.first[:set_id]).to eq(non_collaborative_group.id)
      end

      it "leaves collaborative groups unchanged" do
        overrides = [
          {
            set_type: "Group",
            set_id: collaborative_group.id,
            due_at: 1.day.from_now
          }
        ]

        result = presenter.convert_non_collaborative_groups_to_tags_v2(overrides)

        expect(result.first[:set_type]).to eq("Group")
        expect(result.first[:set_id]).to eq(collaborative_group.id)
      end

      it "handles mixed override types correctly" do
        section = course.course_sections.create!(name: "Test Section")
        overrides = [
          {
            set_type: "Group",
            set_id: non_collaborative_group.id,
            due_at: 1.day.from_now
          },
          {
            set_type: "Group",
            set_id: collaborative_group.id,
            due_at: 2.days.from_now
          },
          {
            set_type: "CourseSection",
            set_id: section.id,
            due_at: 3.days.from_now
          }
        ]

        result = presenter.convert_non_collaborative_groups_to_tags_v2(overrides)

        expect(result[0][:set_type]).to eq("Tag") # non-collaborative group converted
        expect(result[1][:set_type]).to eq("Group") # collaborative group unchanged
        expect(result[2][:set_type]).to eq("CourseSection") # section unchanged
      end

      it "preserves all other override attributes" do
        due_date = 1.day.from_now
        overrides = [
          {
            set_type: "Group",
            set_id: non_collaborative_group.id,
            due_at: due_date,
            unlock_at: 1.hour.ago,
            lock_at: 2.days.from_now,
            title: "Test Override"
          }
        ]

        result = presenter.convert_non_collaborative_groups_to_tags_v2(overrides)

        expect(result.first[:set_type]).to eq("Tag")
        expect(result.first[:set_id]).to eq(non_collaborative_group.id)
        expect(result.first[:due_at]).to eq(due_date)
        expect(result.first[:unlock_at]).to eq(overrides.first[:unlock_at])
        expect(result.first[:lock_at]).to eq(overrides.first[:lock_at])
        expect(result.first[:title]).to eq("Test Override")
      end

      it "handles non-existent group IDs gracefully" do
        non_existent_id = Group.maximum(:id).to_i + 1
        overrides = [
          {
            set_type: "Group",
            set_id: non_existent_id,
            due_at: 1.day.from_now
          }
        ]

        result = presenter.convert_non_collaborative_groups_to_tags_v2(overrides)

        expect(result.first[:set_type]).to eq("Group") # unchanged since group doesn't exist
        expect(result.first[:set_id]).to eq(non_existent_id)
      end

      it "ignores non-Group override types" do
        section = course.course_sections.create!(name: "Test Section")
        overrides = [
          {
            set_type: "CourseSection",
            set_id: section.id,
            due_at: 1.day.from_now
          },
          {
            set_type: "Course",
            set_id: course.id,
            due_at: 2.days.from_now
          }
        ]

        result = presenter.convert_non_collaborative_groups_to_tags_v2(overrides)

        expect(result[0][:set_type]).to eq("CourseSection")
        expect(result[1][:set_type]).to eq("Course")
      end
    end
  end
end
