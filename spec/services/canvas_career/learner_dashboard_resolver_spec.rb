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

module CanvasCareer
  describe LearnerDashboardResolver do
    before :once do
      @root_account = Account.default
      @root_account.enable_feature!(:horizon_course_setting)
      @root_account.enable_feature!(:horizon_configurable_learner_dashboard)

      @sub_account_a = @root_account.sub_accounts.create!(name: "Sub A")
      @sub_account_a.horizon_account = true
      @sub_account_a.save!

      @sub_account_a1 = @sub_account_a.sub_accounts.create!(name: "Sub A1", root_account: @root_account)

      @sub_account_b = @root_account.sub_accounts.create!(name: "Sub B")
      @sub_account_b.horizon_account = true
      @sub_account_b.save!

      @root_account.reload

      @course_a = course_model(account: @sub_account_a, workflow_state: "available")
      @course_a1 = course_model(account: @sub_account_a1, workflow_state: "available")
      @course_b = course_model(account: @sub_account_b, workflow_state: "available")

      @user = user_factory(active_all: true)
    end

    def resolve
      LearnerDashboardResolver.new(@user, @root_account).resolve
    end

    describe "#resolve" do
      context "single enrollment with activation" do
        before :once do
          @course_a.enroll_student(@user, enrollment_state: "active")
          @layout = ::LearnerDashboardLayout.create!(account: @sub_account_a, name: "Layout A")
          ::LearnerDashboardActivation.create!(account: @sub_account_a, learner_dashboard_layout: @layout)
        end

        it "returns the activated layout" do
          expect(resolve).to eql(@layout)
        end
      end

      context "nearest activation wins" do
        before :once do
          @course_a1.enroll_student(@user, enrollment_state: "active")
          @layout_a1 = ::LearnerDashboardLayout.create!(account: @sub_account_a1, name: "Layout A1")
          @layout_a = ::LearnerDashboardLayout.create!(account: @sub_account_a, name: "Layout A")
          ::LearnerDashboardActivation.create!(account: @sub_account_a1, learner_dashboard_layout: @layout_a1)
          ::LearnerDashboardActivation.create!(account: @sub_account_a, learner_dashboard_layout: @layout_a)
        end

        it "returns the layout from the nearest account" do
          expect(resolve).to eql(@layout_a1)
        end
      end

      context "parent walk to root" do
        before :once do
          @course_a.enroll_student(@user, enrollment_state: "active")
          @layout_root = ::LearnerDashboardLayout.create!(account: @root_account, name: "Root Layout")
          ::LearnerDashboardActivation.create!(account: @root_account, learner_dashboard_layout: @layout_root)
        end

        it "finds root activation when sub-account has none" do
          expect(resolve).to eql(@layout_root)
        end
      end

      context "parent-account adoption of descendant layout" do
        before :once do
          @course_a.enroll_student(@user, enrollment_state: "active")
          @layout = ::LearnerDashboardLayout.create!(account: @sub_account_a1, name: "Descendant Layout")
          ::LearnerDashboardActivation.create!(account: @sub_account_a, learner_dashboard_layout: @layout)
        end

        it "returns the layout even though it was authored elsewhere" do
          expect(resolve).to eql(@layout)
        end
      end

      context "disjoint sibling trees" do
        before :once do
          @course_a.enroll_student(@user, enrollment_state: "active")
          @course_b.enroll_student(@user, enrollment_state: "active")
          @layout_root = ::LearnerDashboardLayout.create!(account: @root_account, name: "Root Layout")
          ::LearnerDashboardActivation.create!(account: @root_account, learner_dashboard_layout: @layout_root)
          @layout_a = ::LearnerDashboardLayout.create!(account: @sub_account_a, name: "Layout A")
          ::LearnerDashboardActivation.create!(account: @sub_account_a, learner_dashboard_layout: @layout_a)
        end

        it "falls back to root account activation" do
          expect(resolve).to eql(@layout_root)
        end
      end

      context "disjoint sibling trees with no root activation" do
        before :once do
          @course_a.enroll_student(@user, enrollment_state: "active")
          @course_b.enroll_student(@user, enrollment_state: "active")
        end

        it "returns nil" do
          expect(resolve).to be_nil
        end
      end

      context "activation pointing at soft-deleted layout" do
        before :once do
          @course_a.enroll_student(@user, enrollment_state: "active")
          @layout = ::LearnerDashboardLayout.create!(account: @sub_account_a, name: "Deleted Layout")
          ::LearnerDashboardActivation.create!(account: @sub_account_a, learner_dashboard_layout: @layout)
          @layout.destroy
        end

        it "returns nil" do
          expect(resolve).to be_nil
        end
      end

      context "feature flag off" do
        before :once do
          @course_a.enroll_student(@user, enrollment_state: "active")
          @layout = ::LearnerDashboardLayout.create!(account: @sub_account_a, name: "Layout")
          ::LearnerDashboardActivation.create!(account: @sub_account_a, learner_dashboard_layout: @layout)
        end

        it "returns nil" do
          @root_account.disable_feature!(:horizon_configurable_learner_dashboard)
          result = resolve
          @root_account.enable_feature!(:horizon_configurable_learner_dashboard)
          expect(result).to be_nil
        end
      end

      context "non-Horizon enrollments" do
        before :once do
          academic_account = @root_account.sub_accounts.create!(name: "Academic")
          academic_course = course_model(account: academic_account, workflow_state: "available")
          academic_course.enroll_student(@user, enrollment_state: "active")
          @layout = ::LearnerDashboardLayout.create!(account: academic_account, name: "Layout")
          ::LearnerDashboardActivation.create!(account: academic_account, learner_dashboard_layout: @layout)
        end

        it "ignores non-Horizon enrollments" do
          expect(resolve).to be_nil
        end
      end

      context "no enrollments" do
        it "returns nil" do
          expect(resolve).to be_nil
        end
      end

      context "no activations" do
        before :once do
          @course_a.enroll_student(@user, enrollment_state: "active")
        end

        it "returns nil" do
          expect(resolve).to be_nil
        end
      end
    end
  end
end
