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

describe DataFixup::ExpireNonAdminTokensSingleShard do
  include_context "data fixup auditing"

  let(:target) { DataFixup::NonAdminTokenExpiration::TARGET_EXPIRATION }

  def create_token(user, expires_at:, developer_key: DeveloperKey.default)
    user.access_tokens.create!(purpose: "test", permanent_expires_at: expires_at, developer_key:)
  end

  before do
    allow_any_instance_of(described_class).to receive(:wait_between_jobs)
    allow_any_instance_of(described_class).to receive(:wait_between_processing)
  end

  def run_fixup
    described_class.new.run
    run_jobs
  end

  describe "#run" do
    it "clamps a non-admin user's token that expires after the target" do
      user = user_with_pseudonym(active_all: true)
      course_with_teacher(active_all: true, user:)
      token = create_token(user, expires_at: target + 1.year)

      expect { run_fixup }.to change { token.reload.permanent_expires_at }.from(target + 1.year).to(target)
    end

    it "sets an expiration on a non-admin user's never-expiring token" do
      user = user_with_pseudonym(active_all: true)
      token = create_token(user, expires_at: nil)

      expect { run_fixup }.to change { token.reload.permanent_expires_at }.from(nil).to(target)
    end

    it "leaves tokens that already expire on or before the target" do
      user = user_with_pseudonym(active_all: true)
      token = create_token(user, expires_at: target - 5.days)

      expect { run_fixup }.not_to change { token.reload.permanent_expires_at }
    end

    it "does not touch account admins' tokens" do
      admin = account_admin_user
      token = create_token(admin, expires_at: nil)

      expect { run_fixup }.not_to change { token.reload.permanent_expires_at }
    end

    it "does not touch users with a custom account role" do
      user = user_with_pseudonym(active_all: true)
      role = custom_account_role("CustomRole", account: Account.default)
      tie_user_to_account(user, role:)
      token = create_token(user, expires_at: nil)

      expect { run_fixup }.not_to change { token.reload.permanent_expires_at }
    end

    it "ignores tokens that are not user-generated" do
      user = user_with_pseudonym(active_all: true)
      dev_key = DeveloperKey.create!(account: Account.default)
      token = create_token(user, expires_at: nil, developer_key: dev_key)

      expect { run_fixup }.not_to change { token.reload.permanent_expires_at }
    end

    it "ignores deleted tokens" do
      user = user_with_pseudonym(active_all: true)
      token = create_token(user, expires_at: nil)
      token.destroy

      expect { run_fixup }.not_to change { token.reload.permanent_expires_at }
    end

    it "is idempotent" do
      user = user_with_pseudonym(active_all: true)
      token = create_token(user, expires_at: target + 1.year)

      run_fixup

      expect { run_fixup }.not_to change { token.reload.updated_at }
    end

    it "records the users whose tokens were expired" do
      user = user_with_pseudonym(active_all: true)
      token = create_token(user, expires_at: nil)

      run_fixup

      audit = data_fixup_audit_logs(Shard.current.id)
      expect(audit).to include(%("affected_user_ids":[#{user.id}]))
      expect(audit).to include(%("tokens_expired":[#{token.id}]))
    end
  end

  describe "scope" do
    specs_require_sharding

    it "includes a single-shard user that only has a home-shard association row" do
      user = user_with_pseudonym(active_all: true)

      scope_ids = described_class.new.send(:scope).pluck(:id)

      expect(scope_ids).to include(user.id)
    end

    it "excludes users with a strong association to another shard" do
      user = user_with_pseudonym(active_all: true)
      user.associate_with_shard(@shard2)

      scope_ids = described_class.new.send(:scope).pluck(:id)

      expect(scope_ids).not_to include(user.id)
    end
  end
end
