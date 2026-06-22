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

describe LearnerDashboardLayout do
  let_once(:root_account) { Account.default }
  let_once(:account) { Account.create!(name: "Test", root_account:) }

  describe "validations" do
    it "requires a name" do
      layout = LearnerDashboardLayout.new(account:)
      expect(layout).not_to be_valid
      expect(layout.errors[:name]).to be_present
    end

    it "enforces name max length" do
      layout = LearnerDashboardLayout.new(account:, name: "a" * 256)
      expect(layout).not_to be_valid
      expect(layout.errors[:name]).to be_present
    end

    it "requires an account" do
      layout = LearnerDashboardLayout.new(name: "Layout")
      expect(layout).not_to be_valid
      expect(layout.errors[:account]).to be_present
    end

    it "is valid with required attributes" do
      layout = LearnerDashboardLayout.new(account:, name: "My Layout")
      expect(layout).to be_valid
    end
  end

  describe "#set_root_account_id" do
    it "auto-sets root_account_id from account" do
      layout = LearnerDashboardLayout.create!(account:, name: "Layout")
      expect(layout.root_account_id).to eql(root_account.id)
    end

    it "uses account_id when account has no root_account_id" do
      layout = LearnerDashboardLayout.create!(account: root_account, name: "Layout")
      expect(layout.root_account_id).to eql(root_account.id)
    end
  end

  describe "soft delete" do
    it "sets workflow_state to deleted" do
      layout = LearnerDashboardLayout.create!(account:, name: "Layout")
      layout.destroy
      expect(layout.reload.workflow_state).to eql("deleted")
    end

    it "can be restored with undestroy" do
      layout = LearnerDashboardLayout.create!(account:, name: "Layout")
      layout.destroy
      layout.undestroy
      expect(layout.reload.workflow_state).to eql("active")
    end

    it "cascades to destroy activations" do
      layout = LearnerDashboardLayout.create!(account:, name: "Layout")
      LearnerDashboardActivation.create!(account:, learner_dashboard_layout: layout, root_account:)

      layout.destroy

      expect(LearnerDashboardActivation.where(learner_dashboard_layout_id: layout.id)).to be_empty
    end

    it "deletes the layout's uploaded files folder" do
      layout = LearnerDashboardLayout.create!(account:, name: "Layout")
      folder = Folder.assert_path("learner-dashboards/#{layout.id}", account)
      attachment = folder.file_attachments.create!(
        filename: "img.png", display_name: "img.png", content_type: "image/png", context: account
      )
      attachment.update_columns(file_state: "available")

      layout.destroy

      expect(folder.reload.workflow_state).to eq("deleted")
      expect(attachment.reload.file_state).to eq("deleted")
    end

    it "does not fail when the layout has no files folder" do
      layout = LearnerDashboardLayout.create!(account:, name: "Layout")
      expect { layout.destroy }.not_to raise_error
      expect(layout.reload).to be_deleted
    end
  end

  describe ".active" do
    it "excludes deleted records" do
      active_layout = LearnerDashboardLayout.create!(account:, name: "Active")
      deleted_layout = LearnerDashboardLayout.create!(account:, name: "Deleted")
      deleted_layout.destroy

      expect(LearnerDashboardLayout.active).to contain_exactly(active_layout)
    end
  end

  describe "external_content_reference association" do
    it "has one external_content_reference" do
      layout = LearnerDashboardLayout.create!(account:, name: "Layout")
      ecr = ExternalContentReference.create!(context: layout, content_id: "ext-123", root_account:)

      expect(layout.reload.external_content_reference).to eql(ecr)
    end

    it "destroys external_content_reference on destroy" do
      layout = LearnerDashboardLayout.create!(account:, name: "Layout")
      ExternalContentReference.create!(context: layout, content_id: "ext-123", root_account:)

      layout.destroy

      expect(ExternalContentReference.where(learner_dashboard_layout_id: layout.id)).to be_empty
    end
  end
end
