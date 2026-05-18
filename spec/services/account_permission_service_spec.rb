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

RSpec.describe AccountPermissionService do
  describe ".preload_account_users_and_roles" do
    let_once(:user) { user_factory(active_all: true) }
    let_once(:root_account) { Account.create!(name: "Root") }
    let_once(:sub_account1) { Account.create!(name: "Sub 1", parent_account: root_account, root_account:) }
    let_once(:sub_account2) { Account.create!(name: "Sub 2", parent_account: root_account, root_account:) }

    # let_once memoizes the Account instance across examples, so the
    # @account_users_cache ivar would leak between specs and let tests pass
    # even if the service did nothing.
    before do
      [root_account, sub_account1, sub_account2].each do |a|
        a.remove_instance_variable(:@account_users_cache) if a.instance_variable_defined?(:@account_users_cache)
      end
    end

    context "with no AccountUsers for the user" do
      it "lets cached_account_users_for return an empty array without hitting the DB" do
        described_class.preload_account_users_and_roles([sub_account1, sub_account2], user)

        expect { sub_account1.cached_account_users_for(user) }.not_to make_database_queries
        expect { sub_account2.cached_account_users_for(user) }.not_to make_database_queries
        expect(sub_account1.cached_account_users_for(user)).to eql([])
        expect(sub_account2.cached_account_users_for(user)).to eql([])
      end
    end

    context "when the user is an admin somewhere in the chain" do
      before(:once) do
        account_admin_user(user:, account: root_account)
      end

      it "exposes the user's AccountUsers via cached_account_users_for on sub-accounts" do
        described_class.preload_account_users_and_roles([sub_account1, sub_account2], user)

        [sub_account1, sub_account2].each do |account|
          cached = account.cached_account_users_for(user)
          expect(cached.map(&:account_id)).to contain_exactly(root_account.id)
        end
      end

      it "preloads associated roles so accessing au.role does not query" do
        described_class.preload_account_users_and_roles([sub_account1], user)
        au = sub_account1.cached_account_users_for(user).first

        expect { au.role }.not_to make_database_queries
      end

      it "lets cached_account_users_for reuse the preloaded entries" do
        described_class.preload_account_users_and_roles([sub_account1], user)

        expect { sub_account1.cached_account_users_for(user) }.not_to make_database_queries
      end
    end

    context "with edge cases" do
      it "is a no-op for an empty accounts array" do
        expect { described_class.preload_account_users_and_roles([], user) }.not_to make_database_queries
      end

      it "is a no-op for a nil user" do
        expect { described_class.preload_account_users_and_roles([sub_account1], nil) }.not_to make_database_queries
      end

      it "dedupes by id and lets preloaded copies win over stale cache entries" do
        account_admin_user(user:, account: sub_account1)
        persisted_au = sub_account1.account_users.where(user_id: user).first
        stale_au = AccountUser.find(persisted_au.id)
        sub_account1.instance_variable_set(:@account_users_cache, { user.global_id => [stale_au] })

        described_class.preload_account_users_and_roles([sub_account1], user)

        cached = sub_account1.cached_account_users_for(user)
        expect(cached.map(&:id)).to eq([persisted_au.id])
        expect { cached.first.role }.not_to make_database_queries
      end
    end

    context "query batching" do
      before(:once) do
        5.times do |i|
          a = Account.create!(name: "A#{i}", parent_account: root_account, root_account:)
          account_admin_user(user:, account: a)
          # capture so accounts persist via let
        end
      end

      let(:accounts) { root_account.sub_accounts.to_a }

      it "fires exactly 2 AccountUser queries regardless of account count (one bulk + one for site_admin)" do
        account_user_queries = 0
        subscriber = ActiveSupport::Notifications.subscribe("sql.active_record") do |_, _, _, _, payload|
          account_user_queries += 1 if /FROM\s+(?:"\w+"\.)?"?account_users"?\b/i.match?(payload[:sql])
        end

        described_class.preload_account_users_and_roles(accounts, user)

        expect(account_user_queries).to eq(2)
      ensure
        ActiveSupport::Notifications.unsubscribe(subscriber) if subscriber
      end

      it "fires the same 2 AccountUser queries when the user has no AUs on any account (full iteration, no short-circuit)" do
        non_admin = user_factory(active_all: true)
        account_user_queries = 0
        subscriber = ActiveSupport::Notifications.subscribe("sql.active_record") do |_, _, _, _, payload|
          account_user_queries += 1 if /FROM\s+(?:"\w+"\.)?"?account_users"?\b/i.match?(payload[:sql])
        end

        described_class.preload_account_users_and_roles(accounts, non_admin)

        expect(account_user_queries).to eq(2)
      ensure
        ActiveSupport::Notifications.unsubscribe(subscriber) if subscriber
      end

      it "fires a single recursive-CTE chain query regardless of account count" do
        cte_queries = 0
        subscriber = ActiveSupport::Notifications.subscribe("sql.active_record") do |_, _, _, _, payload|
          cte_queries += 1 if payload[:sql].match?(/with\s+recursive/i)
        end

        described_class.preload_account_users_and_roles(accounts, user)

        expect(cte_queries).to be(1)
      ensure
        ActiveSupport::Notifications.unsubscribe(subscriber) if subscriber
      end
    end

    context "cross-shard" do
      specs_require_sharding

      it "partitions AccountUser lookup per shard and merges results across shards" do
        target_user = user_factory(active_all: true)
        default_account = Account.create!(name: "On default")
        account_admin_user(user: target_user, account: default_account)

        shard1_account = @shard1.activate { Account.create!(name: "On shard1") }
        @shard1.activate { account_admin_user(user: target_user, account: shard1_account) }

        described_class.preload_account_users_and_roles([default_account, shard1_account], target_user)

        default_cached = default_account.cached_account_users_for(target_user)
        shard1_cached = shard1_account.cached_account_users_for(target_user)

        expect(default_cached.map { |au| Shard.global_id_for(au.account_id, Shard.current) })
          .to include(default_account.global_id)
        expect(shard1_cached.map { |au| Shard.global_id_for(au.account_id, @shard1) })
          .to include(shard1_account.global_id)
      end

      it "preloads :role on AccountUsers loaded from another shard" do
        target_user = user_factory(active_all: true)
        shard1_account = @shard1.activate { Account.create!(name: "On shard1") }
        @shard1.activate { account_admin_user(user: target_user, account: shard1_account) }

        described_class.preload_account_users_and_roles([shard1_account], target_user)
        au = shard1_account.cached_account_users_for(target_user).first

        expect { au.role }.not_to make_database_queries
      end
    end
  end
end
