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

describe DataFixup::ExpireNonAdminTokensCrossShard do
  subject(:fixup) { operation_shard.activate { described_class.new } }

  include_context "data fixup auditing"
  specs_require_sharding

  let(:operation_shard) { @shard1 }
  let(:target) { DataFixup::NonAdminTokenExpiration::TARGET_EXPIRATION }

  let_once(:root_account) { operation_shard.activate { account_model } }

  around do |example|
    operation_shard.activate { example.run }
  end

  before do
    allow_any_instance_of(described_class).to receive(:wait_between_jobs)
    allow_any_instance_of(described_class).to receive(:wait_between_processing)
  end

  def create_token(user, expires_at: nil)
    user.access_tokens.create!(purpose: "test", permanent_expires_at: expires_at, developer_key: DeveloperKey.default)
  end

  # A user whose home shard is the operation shard but who is also associated
  # with @shard2, making them a multi-shard user. When admin_on_other_shard is
  # set, they hold an account admin role on @shard2.
  def cross_shard_user(admin_on_other_shard: false)
    user = user_with_pseudonym(active_all: true, account: root_account)
    @shard2.activate { AccountUser.create!(user:, account: account_model, role: admin_role) } if admin_on_other_shard
    user.associate_with_shard(@shard2)
    user
  end

  def run_fixup
    fixup.run
    run_jobs
  end

  describe "#run" do
    it "clamps tokens for a multi-shard user who is not an admin anywhere" do
      user = cross_shard_user
      token = create_token(user, expires_at: target + 1.year)

      expect { run_fixup }.to change { token.reload.permanent_expires_at }.from(target + 1.year).to(target)
    end

    it "sets an expiration on a never-expiring token for a non-admin multi-shard user" do
      user = cross_shard_user
      token = create_token(user, expires_at: nil)

      expect { run_fixup }.to change { token.reload.permanent_expires_at }.from(nil).to(target)
    end

    it "expires tokens for a user who is only an admin of a deleted account" do
      user = cross_shard_user
      token = create_token(user, expires_at: nil)
      @shard2.activate do
        account = account_model
        account.account_users.create!(user:, role: admin_role)
        account.destroy
      end

      expect { run_fixup }.to change { token.reload.permanent_expires_at }.to(target)
    end

    it "does not touch tokens for a user who is an admin on another shard" do
      user = cross_shard_user(admin_on_other_shard: true)
      token = create_token(user, expires_at: nil)

      expect { run_fixup }.not_to change { token.reload.permanent_expires_at }
    end

    it "records the users whose tokens were expired" do
      user = cross_shard_user
      token = create_token(user, expires_at: nil)

      run_fixup

      audit = data_fixup_audit_logs(operation_shard.id)
      expect(audit).to include(%("user_id":#{user.id}))
      expect(audit).to include(%("tokens_expired":[#{token.id}]))
    end
  end

  describe "scope" do
    it "only includes users with a strong association to another shard" do
      multi_shard = cross_shard_user
      single_shard = user_with_pseudonym(active_all: true, account: root_account)
      scope_ids = fixup.send(:scope).pluck(:id)

      expect(scope_ids).to include(multi_shard.id)
      expect(scope_ids).not_to include(single_shard.id)
    end
  end
end
