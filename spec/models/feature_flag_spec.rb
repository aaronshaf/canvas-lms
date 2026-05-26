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
#

describe FeatureFlag do
  let_once(:t_root_account) { account_model }
  let_once(:t_sub_account) { account_model parent_account: t_root_account }
  let_once(:t_course) { course_factory account: t_sub_account, active_all: true }

  before do
    allow(Account.site_admin).to receive(:feature_enabled?).with(:instructure_identity_global_flag)
    allow(Feature).to receive(:definitions).and_return({
                                                         "root_account_feature" => Feature.new(feature: "root_account_feature", applies_to: "RootAccount"),
                                                         "account_feature" => Feature.new(feature: "account_feature", applies_to: "Account"),
                                                         "course_feature" => Feature.new(feature: "course_feature", applies_to: "Course"),
                                                         "user_feature" => Feature.new(feature: "user_feature", applies_to: "User"),
                                                         "inheritable_user_feature" => Feature.new(feature: "inheritable_user_feature", applies_to: "InheritableUser"),
                                                         "hidden_feature" => Feature.new(feature: "hidden_feature", state: "hidden", applies_to: "Course"),
                                                         "hidden_root_opt_in_feature" => Feature.new(feature: "hidden_feature", state: "hidden", applies_to: "Course", root_opt_in: true)
                                                       })
  end

  context "validation" do
    it "validates the state" do
      flag = t_root_account.feature_flags.build(feature: "root_account_feature", state: "nonplussed")
      expect(flag).not_to be_valid
    end

    it "validates the feature exists" do
      flag = t_root_account.feature_flags.build(feature: "xyzzy")
      expect(flag).not_to be_valid
      expect(flag.errors[:feature].first).to eq("does not exist")
    end

    it "allows 'allowed' state only in accounts" do
      flag = t_sub_account.feature_flags.build(feature: "course_feature", state: "allowed")
      expect(flag).to be_valid

      flag = t_course.feature_flags.build(feature: "course_feature", state: "allowed")
      expect(flag).not_to be_valid
    end

    it "validates the feature applies to the context" do
      flag = t_root_account.feature_flags.build(feature: "root_account_feature")
      expect(flag).to be_valid

      flag = t_sub_account.feature_flags.build(feature: "root_account_feature")
      expect(flag).not_to be_valid
      expect(flag.errors[:feature].first).to eq("does not apply to context")
    end

    context "InheritableUser features" do
      let_once(:t_user) { account_admin_user(account: t_root_account) }

      it "allows 'allowed' and 'allowed_on' states on a root account" do
        flag = t_root_account.feature_flags.build(feature: "inheritable_user_feature", state: "allowed")
        expect(flag).to be_valid, -> { flag.errors.full_messages.to_sentence }

        flag = t_root_account.feature_flags.build(feature: "inheritable_user_feature", state: "allowed_on")
        expect(flag).to be_valid, -> { flag.errors.full_messages.to_sentence }
      end

      it "allows 'on' and 'off' states on a root account" do
        flag = t_root_account.feature_flags.build(feature: "inheritable_user_feature", state: "on")
        expect(flag).to be_valid, -> { flag.errors.full_messages.to_sentence }

        flag = t_root_account.feature_flags.build(feature: "inheritable_user_feature", state: "off")
        expect(flag).to be_valid, -> { flag.errors.full_messages.to_sentence }
      end

      it "allows 'allowed' and 'allowed_on' states on site admin" do
        flag = Account.site_admin.feature_flags.build(feature: "inheritable_user_feature", state: "allowed")
        expect(flag).to be_valid, -> { flag.errors.full_messages.to_sentence }

        flag = Account.site_admin.feature_flags.build(feature: "inheritable_user_feature", state: "allowed_on")
        expect(flag).to be_valid, -> { flag.errors.full_messages.to_sentence }
      end

      it "allows 'on' and 'off' states on a user" do
        flag = t_user.feature_flags.build(feature: "inheritable_user_feature", state: "on")
        expect(flag).to be_valid, -> { flag.errors.full_messages.to_sentence }

        flag = t_user.feature_flags.build(feature: "inheritable_user_feature", state: "off")
        expect(flag).to be_valid, -> { flag.errors.full_messages.to_sentence }
      end

      it "does not allow 'allowed' or 'allowed_on' states on a user" do
        flag = t_user.feature_flags.build(feature: "inheritable_user_feature", state: "allowed")
        expect(flag).not_to be_valid
        expect(flag.errors[:state].first).to eq("is not valid in context")

        flag = t_user.feature_flags.build(feature: "inheritable_user_feature", state: "allowed_on")
        expect(flag).not_to be_valid
        expect(flag.errors[:state].first).to eq("is not valid in context")
      end

      it "does not apply to a course context" do
        flag = t_course.feature_flags.build(feature: "inheritable_user_feature", state: "on")
        expect(flag).not_to be_valid
        expect(flag.errors[:feature].first).to eq("does not apply to context")
      end

      it "does not apply to a sub-account context" do
        flag = t_sub_account.feature_flags.build(feature: "inheritable_user_feature", state: "allowed")
        expect(flag).not_to be_valid
        expect(flag.errors[:feature].first).to eq("does not apply to context")
      end

      it "populates root_account_ids from the account when an InheritableUser flag is saved on a root account" do
        flag = t_root_account.feature_flags.create!(feature: "inheritable_user_feature", state: "allowed")
        expect(flag.root_account_ids).to eq([t_root_account.id])
      end

      it "populates root_account_ids from the user when saved" do
        t_user.update_column(:root_account_ids, [])
        t_user.update_root_account_ids
        expect(t_user.reload.root_account_ids).to eq([t_root_account.id])

        flag = t_user.feature_flags.create!(feature: "inheritable_user_feature", state: "on")
        expect(flag.root_account_ids).to eq([t_root_account.id])
      end
    end
  end

  describe "locked?" do
    it "returns false for allowed features" do
      flag = t_root_account.feature_flags.create! feature: "account_feature", state: "allowed"
      expect(flag.locked?(t_root_account)).to be_falsey
      expect(flag.locked?(t_sub_account)).to be_falsey
    end

    describe "not allowed" do
      let!(:t_flag) { t_root_account.feature_flags.create! feature: "account_feature", state: "off" }

      it "is false in the setting context" do
        expect(t_flag.locked?(t_root_account)).to be_falsey
      end

      it "is true in a lower context" do
        expect(t_flag.locked?(t_sub_account)).to be_truthy
      end
    end
  end

  describe "unhides_feature?" do
    it "is true on a site admin feature flag" do
      Account.site_admin.allow_feature! :hidden_feature
      expect(Account.site_admin.lookup_feature_flag(:hidden_feature)).to be_unhides_feature
    end

    it "is true on a root account feature flag with no site admin flag set" do
      t_root_account.allow_feature! :hidden_feature
      expect(t_root_account.lookup_feature_flag(:hidden_feature)).to be_unhides_feature
    end

    it "is false on a root account feature flag with site admin flag set" do
      allow_any_instance_of(Account).to receive(:feature_enabled?).with(:instructure_identity_global_flag)
      Account.site_admin.allow_feature! :hidden_feature
      t_root_account.enable_feature! :hidden_feature
      expect(t_root_account.lookup_feature_flag(:hidden_feature)).not_to be_unhides_feature
    end

    it "is true on a sub-account feature flag with no root or site admin flags set" do
      t_sub_account.allow_feature! :hidden_feature
      expect(t_sub_account.lookup_feature_flag(:hidden_feature)).to be_unhides_feature
    end

    it "is false on a sub-account feature flag with a root flag set" do
      t_root_account.allow_feature! :hidden_feature
      t_sub_account.enable_feature! :hidden_feature
      expect(t_sub_account.lookup_feature_flag(:hidden_feature)).not_to be_unhides_feature
    end

    it "is true on a sub-account root-opt-in feature flag with no root or site admin flags set" do
      t_course.enable_feature! :hidden_root_opt_in_feature
      expect(t_course.feature_flag(:hidden_root_opt_in_feature)).to be_unhides_feature
    end
  end

  describe "#clear_cache" do
    specs_require_cache(:redis_cache_store)

    context "with sharding" do
      specs_require_sharding

      before do
        allow(Feature).to receive(:definitions).and_return(
          { "high_contrast" => Feature.new(feature: "high_contrast", applies_to: "User") }
        )
        @acting_user = user_model
        @acting_user.associate_with_shard(@shard1)
        @shard1.activate do
          @flag = @acting_user.feature_flags.build(feature: "high_contrast", state: "off")
          @flag.current_user = @acting_user
          @flag.save!
        end
      end

      it "deletes the feature flag cache using the context's shard prefix" do
        context = @acting_user
        redis = context.feature_flag_cache
        cache_key = context.feature_flag_cache_key("high_contrast")
        @shard1.activate do
          allow(redis).to receive(:delete)
          @flag.update!(state: "on")
          expect(redis).to have_received(:delete).with(cache_key)
          expect(context.prefers_high_contrast?).to be_truthy
        end
      end
    end

    context "cross-region fan-out for InheritableUser writes" do
      before do
        allow(Feature).to receive(:definitions).and_return(
          {
            "iu_feature" => Feature.new(feature: "iu_feature", applies_to: "InheritableUser"),
            "user_only_feature" => Feature.new(feature: "user_only_feature", applies_to: "User")
          }
        )
        @target_user = user_model
      end

      it "fans out the per-context feature_flag_cache delete for User-context IU writes" do
        expect(Switchman::DatabaseServer).to receive(:send_in_each_region)
          .with(FeatureFlag, :clear_feature_flag_cache_in_region, {}, @target_user, "iu_feature")
        @target_user.feature_flags.create! feature: "iu_feature", state: "on"
      end

      it "fans out :feature_flags cache_key bump for RootAccount-context IU writes" do
        expect(Switchman::DatabaseServer).to receive(:send_in_each_region)
          .with(FeatureFlag, :clear_feature_flag_cache_in_region, {}, t_root_account, "iu_feature")
        expect(Switchman::DatabaseServer).to receive(:send_in_each_region)
          .with(t_root_account, :clear_cache_key, {}, :feature_flags)
        t_root_account.feature_flags.create! feature: "iu_feature", state: "allowed_on"
      end

      it "does not fan out for non-IU User-context writes" do
        expect(Switchman::DatabaseServer).not_to receive(:send_in_each_region)
        @target_user.feature_flags.create! feature: "user_only_feature", state: "on"
      end

      it "clear_feature_flag_cache_in_region deletes the per-context Rails.cache key" do
        memory_store = ActiveSupport::Cache::MemoryStore.new
        allow(@target_user).to receive(:feature_flag_cache).and_return(memory_store)
        cache_key = @target_user.feature_flag_cache_key("iu_feature")
        memory_store.write(cache_key, "seeded-stale-value")
        expect(memory_store.read(cache_key)).to eq "seeded-stale-value"

        FeatureFlag.clear_feature_flag_cache_in_region(@target_user, "iu_feature")

        expect(memory_store.read(cache_key)).to be_nil
      end
    end
  end

  describe "audit log" do
    let_once(:acting_user) { user_model }

    it "logs account feature creation" do
      flag = t_root_account.feature_flags.build(feature: "root_account_feature")
      flag.current_user = acting_user
      flag.save!
      log = Auditors::FeatureFlag.for_feature_flag(flag).paginate(per_page: 1).first
      expect(log.feature_flag_id).to eq(flag.id)
      expect(log.state_before).to eq("allowed")
      expect(log.state_after).to eq(flag.state)
      expect(log.context_type).to eq("Account")
      expect(log.context_id).to eq(t_root_account.id)
    end

    it "logs course feature creation" do
      flag = t_course.feature_flags.build(feature: "course_feature", state: "on")
      flag.current_user = acting_user
      flag.save!
      log = Auditors::FeatureFlag.for_feature_flag(flag).paginate(per_page: 1).first
      expect(log.feature_flag_id).to eq(flag.id)
      expect(log.state_before).to eq("allowed")
      expect(log.state_after).to eq("on")
      expect(log.context_type).to eq("Course")
      expect(log.context_id).to eq(t_course.id)
    end

    it "does not log user feature creation" do
      flag = acting_user.feature_flags.build(feature: "user_feature", state: "on")
      flag.current_user = acting_user
      flag.save!
      logs = Auditors::FeatureFlag.for_feature_flag(flag).paginate(per_page: 1)
      expect(logs).to be_empty
    end

    it "logs feature state changes" do
      flag = t_root_account.feature_flags.build(feature: "root_account_feature", state: "allowed")
      flag.current_user = acting_user
      flag.save!
      flag.state = "off"
      flag.save!
      logs = Auditors::FeatureFlag.for_feature_flag(flag).paginate(per_page: 3).to_a
      log = logs.detect { |l| l.state_after == "off" }
      expect(log.feature_flag_id).to eq(flag.id)
      expect(log.state_before).to eq("allowed")
      expect(log.state_after).to eq("off")
      expect(log.context_type).to eq("Account")
      expect(log.context_id).to eq(t_root_account.id)
    end

    it "logs feature destruction" do
      flag = t_root_account.feature_flags.build(feature: "root_account_feature", state: "on")
      flag.current_user = acting_user
      flag.save!
      flag.destroy
      logs = Auditors::FeatureFlag.for_feature_flag(flag).paginate(per_page: 3).to_a
      log = logs.detect { |l| l.state_after == "allowed" }
      expect(log.feature_flag_id).to eq(flag.id)
      expect(log.state_after).to eq("allowed")
      expect(log.state_before).to eq("on")
      expect(log.context_type).to eq("Account")
      expect(log.context_id).to eq(t_root_account.id)
    end

    it "can be logged by a null user" do
      flag = t_root_account.feature_flags.build(feature: "root_account_feature", state: "allowed")
      flag.current_user = nil
      flag.save!
      logs = Auditors::FeatureFlag.for_feature_flag(flag).paginate(per_page: 3).to_a
      expect(logs.size).to eq(1)
      rec = logs.first
      expect(rec.user_id).to be_nil
    end
  end
end
