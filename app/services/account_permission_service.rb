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

class AccountPermissionService
  # Mutates each account's #account_users_cache so subsequent calls to
  # Account#cached_account_users_for short-circuit on the per-instance cache.
  def self.preload_account_users_and_roles(accounts, user)
    return if user.nil?

    accounts = accounts.to_a
    return if accounts.empty?

    chain_ids_by_account = active_chain_ids_by_account(accounts)
    site_admin_global_id = Account.site_admin.global_id
    non_site_admin_chain_ids = chain_ids_by_account.values.flatten.uniq - [site_admin_global_id]

    account_users_by_global_id = {}
    Shard.partition_by_shard(non_site_admin_chain_ids) do |shard_chain_ids|
      AccountUser.active
                 .preload(:role)
                 .where(account_id: shard_chain_ids, user_id: user)
                 .to_a.each do |au|
        au.user = user
        global_id = Shard.global_id_for(au.account_id, Shard.current)
        (account_users_by_global_id[global_id] ||= []) << au
      end
    end

    # Route site_admin through its existing MultiCache-backed path so we don't
    # bypass the process-shared all_site_admin_account_users3 cache.
    site_admin_aus = Account.site_admin.account_users_for(user)
    account_users_by_global_id[site_admin_global_id] = site_admin_aus if site_admin_aus.present?

    accounts.each do |account|
      users_for_account = (chain_ids_by_account[account.global_id] || []).flat_map do |chain_id|
        account_users_by_global_id[chain_id] || []
      end
      account.preload_cached_account_users(user, users_for_account)
    end
  end

  # Returns { account.global_id => [global chain ids, active only, plus site_admin] }
  # using one recursive CTE per shard instead of per account.
  def self.active_chain_ids_by_account(accounts)
    result = {}
    site_admin_global_id = Account.site_admin.global_id

    accounts.group_by(&:shard).each do |shard, shard_accounts|
      shard.activate do
        local_ids_by_account = shard_accounts.index_with { |a| Shard.local_id_for(a.id).first }
        chains_local = Account.account_chain_ids_for_multiple_accounts(local_ids_by_account.values)
        chains_local = chains_local.transform_values do |chain|
          Account.add_federated_parent_id_to_chain!(chain.dup)
        end
        unique_chain_local_ids = chains_local.values.flatten.uniq
        active_local_ids = Account.where(id: unique_chain_local_ids, workflow_state: "active").pluck(:id).to_set

        shard_accounts.each do |account|
          chain_local = chains_local[local_ids_by_account[account]] || []
          active_chain = chain_local.select { |id| active_local_ids.include?(id) }
                                    .map { |id| Shard.global_id_for(id, shard) }
          active_chain << site_admin_global_id
          result[account.global_id] = active_chain
        end
      end
    end

    result
  end
  private_class_method :active_chain_ids_by_account
end
