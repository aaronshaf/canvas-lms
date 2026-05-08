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

describe LearnerDashboardActivation do
  let_once(:root_account) { Account.default }
  let_once(:account) { Account.create!(name: "Test", root_account:) }
  let_once(:layout) { LearnerDashboardLayout.create!(account:, name: "Layout") }

  describe "validations" do
    it "requires an account" do
      activation = LearnerDashboardActivation.new(learner_dashboard_layout: layout)
      expect(activation).not_to be_valid
      expect(activation.errors[:account]).to be_present
    end

    it "requires a learner_dashboard_layout" do
      activation = LearnerDashboardActivation.new(account:)
      expect(activation).not_to be_valid
      expect(activation.errors[:learner_dashboard_layout]).to be_present
    end

    it "enforces account uniqueness" do
      LearnerDashboardActivation.create!(account:, learner_dashboard_layout: layout, root_account:)
      duplicate = LearnerDashboardActivation.new(account:, learner_dashboard_layout: layout)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:account_id]).to be_present
    end

    it "is valid with required attributes" do
      activation = LearnerDashboardActivation.new(account:, learner_dashboard_layout: layout)
      expect(activation).to be_valid
    end
  end

  describe "#set_root_account_id" do
    it "auto-sets root_account_id from account" do
      activation = LearnerDashboardActivation.create!(account:, learner_dashboard_layout: layout)
      expect(activation.root_account_id).to eql(root_account.id)
    end
  end

  describe "belongs_to layout" do
    it "references the layout" do
      activation = LearnerDashboardActivation.create!(account:, learner_dashboard_layout: layout, root_account:)
      expect(activation.learner_dashboard_layout).to eql(layout)
    end
  end
end
