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

require_relative "../feature_flag_helper"

describe FeatureFlags do
  include FeatureFlagHelper

  let(:t_site_admin) { Account.site_admin }
  let(:t_root_account) { account_model }
  let(:t_user) { user_with_pseudonym account: t_root_account }
  let(:t_sub_account) { account_model parent_account: t_root_account }
  let(:t_course) { course_with_teacher(user: t_user, account: t_sub_account, active_all: true).course }
  let(:analytics_service) { class_double(Services::FeatureAnalyticsService).as_stubbed_const }

  # Save and restore Account.current_domain_root_account for the duration of an
  # example. If the including context defines `let(:current_dra) { ... }` the
  # value is assigned up-front; otherwise the example is responsible for
  # setting DRA itself (used by cross-shard / caching contexts that flip DRA
  # mid-example).
  shared_context "with saved current_domain_root_account" do
    around do |example|
      prev = Account.current_domain_root_account
      Account.current_domain_root_account = current_dra if respond_to?(:current_dra)
      example.run
    ensure
      Account.current_domain_root_account = prev
    end
  end

  before do
    silence_undefined_feature_flag_errors
    allow(InstStatsd::Statsd).to receive(:distributed_increment)
    allow(Feature).to receive(:definitions).and_return({
                                                         "site_admin_feature" => Feature.new(feature: "site_admin_feature", applies_to: "SiteAdmin", state: "allowed"),
                                                         "root_account_feature" => Feature.new(feature: "root_account_feature", applies_to: "RootAccount", state: "off"),
                                                         "account_feature" => Feature.new(feature: "account_feature", applies_to: "Account", state: "on"),
                                                         "course_feature" => Feature.new(feature: "course_feature", applies_to: "Course", state: "allowed"),
                                                         "user_feature" => Feature.new(feature: "user_feature", applies_to: "User", state: "allowed"),
                                                         "root_opt_in_feature" => Feature.new(feature: "root_opt_in_feature", applies_to: "Course", state: "allowed", root_opt_in: true),
                                                         "default_on_feature" => Feature.new(feature: "default_on_feature", applies_to: "Account", state: "allowed_on"),
                                                         "hidden_feature" => Feature.new(feature: "hidden_feature", applies_to: "Course", state: "hidden"),
                                                         "hidden_root_opt_in_feature" => Feature.new(feature: "hidden_feature", applies_to: "Course", state: "hidden", root_opt_in: true),
                                                         "hidden_user_feature" => Feature.new(feature: "hidden_user_feature", applies_to: "User", state: "hidden"),
                                                         "shadow_feature" => Feature.new(feature: "shadow_feature", applies_to: "Course", state: "on", shadow: true),
                                                         "inheritable_user_feature" => Feature.new(feature: "inheritable_user_feature", applies_to: "InheritableUser", state: "allowed"),
                                                         "hidden_inheritable_user_feature" => Feature.new(feature: "hidden_inheritable_user_feature", applies_to: "InheritableUser", state: "hidden"),
                                                         "shadow_inheritable_user_feature" => Feature.new(feature: "shadow_inheritable_user_feature", applies_to: "InheritableUser", state: "on", shadow: true),
                                                         "root_opt_in_inheritable_user_feature" => Feature.new(feature: "root_opt_in_inheritable_user_feature", applies_to: "InheritableUser", state: "allowed", root_opt_in: true),
                                                         "disabled_feature" => Feature::DISABLED_FEATURE
                                                       })
    allow(analytics_service).to receive(:persist_feature_evaluation)
  end

  after do
    LocalCache.cache.clear(force: true)
  end

  describe "#feature_enabled?" do
    it "reports correctly" do
      expect(t_sub_account.feature_enabled?(:course_feature)).to be_falsey
      expect(t_sub_account.feature_enabled?(:default_on_feature)).to be_truthy
      expect(t_sub_account.feature_enabled?(:account_feature)).to be_truthy
      Account.ensure_dummy_root_account
      expect(Account.find(0).feature_enabled?(:account_feature)).to be false
    end

    it "logs feature enablement" do
      t_sub_account.feature_enabled?(:course_feature)
      expect(InstStatsd::Statsd).to have_received(:distributed_increment).with("feature_flag_check", tags: {
                                                                                 feature: :course_feature,
                                                                                 enabled: "false"
                                                                               }).exactly(:once)

      t_sub_account.feature_enabled?(:account_feature)
      expect(InstStatsd::Statsd).to have_received(:distributed_increment).with("feature_flag_check", tags: {
                                                                                 feature: :account_feature,
                                                                                 enabled: "true"
                                                                               }).exactly(:once)
    end
  end

  describe "#feature_allowed?" do
    it "returns true if the feature is 'on' or 'allowed', and false otherwise" do
      expect(t_site_admin.feature_allowed?(:site_admin_feature)).to be_truthy
      expect(t_sub_account.feature_allowed?(:account_feature)).to be_truthy
      expect(t_sub_account.feature_allowed?(:default_on_feature)).to be_truthy
      expect(t_root_account.feature_allowed?(:root_account_feature)).to be_falsey
      expect(t_course.feature_allowed?(:course_feature)).to be_truthy
    end
  end

  describe "lookup_feature_flag" do
    it "returns nil if the feature is currently disabled" do
      expect(t_course.lookup_feature_flag("disabled_feature")).to be_nil
    end

    it "returns nil if the feature doesn't apply" do
      expect(t_course.lookup_feature_flag("user_feature")).to be_nil
    end

    it "returns nil if the visible_on returns false" do
      feature = instance_double(
        Feature,
        feature: "some_feature",
        visible_on: ->(_) { false },
        state: "allowed",
        shadow?: false
      )
      expect(feature).to receive(:applies_to_object).and_return(true)
      allow(Feature.definitions).to receive(:[]).and_call_original
      expect(Feature.definitions).to receive(:[]).with("some_feature").and_return(feature)
      expect(t_course.lookup_feature_flag("some_feature")).to be_nil
    end

    it "skip_cache bypasses the per-instance memo for non-InheritableUser lookups" do
      t_course.feature_flags.create! feature: "course_feature", state: "on"
      t_course.lookup_feature_flag("course_feature")
      t_course.instance_variable_get(:@feature_flag_cache)["course_feature"] = nil
      expect(t_course.lookup_feature_flag("course_feature", skip_cache: true)&.state).to eq "on"
    end

    it "returns defaults when no flags exist" do
      expect(t_user.lookup_feature_flag("user_feature")).to be_default
    end

    context "overrides at site admin" do
      it "ignores site admin settings if definition doesn't allow override" do
        t_site_admin.feature_flags.create! feature: "root_account_feature", state: "allowed"
        expect(t_root_account.lookup_feature_flag("root_account_feature")).to be_default
      end

      it "applies site admin settings if definition does allow override" do
        t_site_admin.feature_flags.create! feature: "course_feature", state: "on"
        expect(t_course.lookup_feature_flag("course_feature").context).to eql t_site_admin
      end

      it "overrides lower settings if not allowed" do
        t_root_account.feature_flags.create! feature: "course_feature", state: "on"
        expect(t_root_account.lookup_feature_flag("course_feature").context).to eql t_root_account
        expect(t_course.feature_enabled?("course_feature")).to be_truthy
        t_site_admin.feature_flags.create! feature: "course_feature", state: "off"
        t_root_account.instance_variable_set(:@feature_flag_cache, nil)
        expect(t_root_account.lookup_feature_flag("course_feature").context).to eql t_site_admin
        t_course.instance_variable_set(:@feature_flag_cache, nil)
        expect(t_course.feature_enabled?("course_feature")).to be_falsey
      end
    end

    context "site admin flags" do
      it "works for site admin overrides" do
        expect(t_site_admin.feature_enabled?("site_admin_feature")).to be_falsey
        t_site_admin.feature_flags.create! feature: "site_admin_feature", state: "on"
        t_site_admin.instance_variable_set(:@feature_flag_cache, nil)
        expect(t_site_admin.feature_enabled?("site_admin_feature")).to be_truthy
      end
    end

    context "account flags" do
      it "applies settings at the sub-account level" do
        t_sub_account.feature_flags.create! feature: "course_feature", state: "on"
        expect(t_root_account.lookup_feature_flag("course_feature")).to be_default
        expect(t_root_account.feature_enabled?("course_feature")).to be_falsey
        expect(t_sub_account.lookup_feature_flag("course_feature").context).to eql t_sub_account
        expect(t_sub_account.feature_enabled?("course_feature")).to be_truthy
        expect(t_course.feature_enabled?("course_feature")).to be_truthy
        expect(course_model(account: t_root_account).feature_enabled?("course_feature")).to be_falsey
      end

      it "ignores settings locked by a higher account" do
        t_sub_account.feature_flags.create! feature: "course_feature", state: "on"
        t_root_account.feature_flags.create! feature: "course_feature", state: "off"
        expect(t_sub_account.lookup_feature_flag("course_feature").context).to eql t_root_account
        expect(t_sub_account.feature_enabled?("course_feature")).to be_falsey
        expect(t_course.feature_enabled?("course_feature")).to be_falsey
      end

      it "caches the lookup" do
        t_sub_account.feature_flags.create! feature: "course_feature", state: "on"
        t_root_account.feature_flags.create! feature: "course_feature", state: "off"
        expect(t_sub_account.lookup_feature_flag("course_feature").context).to eql t_root_account
        expect_any_instance_of(Account).not_to receive(:feature_flag)
        expect(t_sub_account.lookup_feature_flag("course_feature").context).to eql t_root_account
      end
    end

    context "course flags" do
      it "applies settings at the course level" do
        other_course = t_sub_account.courses.create!
        other_course.feature_flags.create! feature: "course_feature", state: "on"
        expect(other_course.feature_enabled?("course_feature")).to be_truthy
        expect(t_course.feature_enabled?("course_feature")).to be_falsey
      end
    end

    context "user flags" do
      it "applies settings at the site admin level" do
        expect(t_user.lookup_feature_flag("user_feature")).to be_default
        t_site_admin.feature_flags.create! feature: "user_feature", state: "off"
        t_user.instance_variable_set(:@feature_flag_cache, nil)
        expect(t_user.lookup_feature_flag("user_feature").context).to eql t_site_admin
        expect(t_user.feature_enabled?("user_feature")).to be_falsey
      end

      it "applies settings at the user level" do
        t_user.feature_flags.create! feature: "user_feature", state: "off"
        expect(t_user.lookup_feature_flag("user_feature").context).to eql t_user
        expect(t_user.feature_allowed?("user_feature")).to be_falsey
        expect(user_with_pseudonym(account: t_root_account).feature_allowed?("user_feature")).to be_truthy
      end
    end

    context "inheritable_user flags" do
      it "does not apply to courses" do
        expect(t_course.lookup_feature_flag("inheritable_user_feature")).to be_nil
      end

      it "does not apply to sub-accounts" do
        expect(t_sub_account.lookup_feature_flag("inheritable_user_feature")).to be_nil
      end

      it "returns the default flag at the root account context" do
        expect(t_root_account.lookup_feature_flag("inheritable_user_feature")).to be_default
      end

      it "returns the default flag at the site admin context" do
        expect(t_site_admin.lookup_feature_flag("inheritable_user_feature")).to be_default
      end

      it "returns the default flag at the user context" do
        expect(t_user.lookup_feature_flag("inheritable_user_feature")).to be_default
      end

      context "user lookup with inheritance" do
        let(:current_dra) { t_root_account }

        include_context "with saved current_domain_root_account"

        it "a SiteAdmin 'on' flag wins over user-level overrides" do
          t_site_admin.feature_flags.create! feature: "inheritable_user_feature", state: "on"
          t_user.feature_flags.create! feature: "inheritable_user_feature", state: "off"
          expect(t_user.lookup_feature_flag("inheritable_user_feature").context).to eq t_site_admin
          expect(t_user.feature_enabled?("inheritable_user_feature")).to be_truthy
        end

        it "a SiteAdmin 'off' flag wins over user-level overrides" do
          t_site_admin.feature_flags.create! feature: "inheritable_user_feature", state: "off"
          t_user.feature_flags.create! feature: "inheritable_user_feature", state: "on"
          expect(t_user.lookup_feature_flag("inheritable_user_feature").context).to eq t_site_admin
          expect(t_user.feature_enabled?("inheritable_user_feature")).to be_falsey
        end

        it "treats SiteAdmin 'allowed_on' as default-on but overridable" do
          t_site_admin.feature_flags.create! feature: "inheritable_user_feature", state: "allowed_on"
          flag = t_user.lookup_feature_flag("inheritable_user_feature")
          expect(flag.context).to eq t_site_admin
          expect(flag).to be_can_override
          expect(t_user.feature_enabled?("inheritable_user_feature")).to be_truthy
        end

        it "lets a RootAccount flag override SiteAdmin 'allowed_on'" do
          t_site_admin.feature_flags.create! feature: "inheritable_user_feature", state: "allowed_on"
          t_root_account.feature_flags.create! feature: "inheritable_user_feature", state: "allowed"
          expect(t_user.lookup_feature_flag("inheritable_user_feature").context).to eq t_root_account
          expect(t_user.feature_enabled?("inheritable_user_feature")).to be_falsey
        end

        it "applies RootAccount 'on' as locked for the user" do
          t_root_account.feature_flags.create! feature: "inheritable_user_feature", state: "on"
          expect(t_user.lookup_feature_flag("inheritable_user_feature").context).to eq t_root_account
          expect(t_user.feature_enabled?("inheritable_user_feature")).to be_truthy
        end

        it "ignores RootAccount overrides when SiteAdmin locks the flag" do
          t_site_admin.feature_flags.create! feature: "inheritable_user_feature", state: "off"
          t_root_account.feature_flags.create! feature: "inheritable_user_feature", state: "on"
          expect(t_user.lookup_feature_flag("inheritable_user_feature").context).to eq t_site_admin
          expect(t_user.feature_enabled?("inheritable_user_feature")).to be_falsey
        end

        it "applies a User-level flag when SiteAdmin and RootAccount allow override" do
          t_root_account.feature_flags.create! feature: "inheritable_user_feature", state: "allowed_on"
          t_user.feature_flags.create! feature: "inheritable_user_feature", state: "off"
          expect(t_user.lookup_feature_flag("inheritable_user_feature").context).to eq t_user
          expect(t_user.feature_enabled?("inheritable_user_feature")).to be_falsey
        end

        it "ignores a User-level flag when RootAccount locks the flag" do
          t_root_account.feature_flags.create! feature: "inheritable_user_feature", state: "on"
          t_user.feature_flags.create! feature: "inheritable_user_feature", state: "off"
          expect(t_user.lookup_feature_flag("inheritable_user_feature").context).to eq t_root_account
          expect(t_user.feature_enabled?("inheritable_user_feature")).to be_truthy
        end

        it "excludes the user's own flag with inherited_only: true" do
          t_user.feature_flags.create! feature: "inheritable_user_feature", state: "off"
          t_root_account.feature_flags.create! feature: "inheritable_user_feature", state: "on"
          expect(t_user.lookup_feature_flag("inheritable_user_feature", inherited_only: true).context).to eq t_root_account
        end

        it "exposes the RootAccount flag's state via inherited_only for parent_state" do
          t_root_account.feature_flags.create! feature: "inheritable_user_feature", state: "on"
          parent_flag = t_user.lookup_feature_flag("inheritable_user_feature", inherited_only: true)
          expect(parent_flag.state).to eq "on"
        end

        it "treats a non-overridable RootAccount IU flag as locked for the user" do
          t_root_account.feature_flags.create! feature: "inheritable_user_feature", state: "on"
          flag = t_user.lookup_feature_flag("inheritable_user_feature")
          expect(flag.locked?(t_user)).to be true
        end

        it "treats an overridable RootAccount IU flag as not locked for the user" do
          t_root_account.feature_flags.create! feature: "inheritable_user_feature", state: "allowed_on"
          flag = t_user.lookup_feature_flag("inheritable_user_feature")
          expect(flag.locked?(t_user)).to be false
        end

        it "round-trips set_feature_flag! through the DB without populating the per-instance memo" do
          t_user.set_feature_flag!("inheritable_user_feature", "on")
          cache = t_user.instance_variable_get(:@feature_flag_cache) || {}
          expect(cache).not_to have_key("inheritable_user_feature")
          expect(cache).not_to have_key(["inheritable_user_feature", t_root_account.global_id])
          flag = t_user.lookup_feature_flag("inheritable_user_feature")
          expect(flag.context).to eq t_user
          expect(flag.state).to eq "on"
        end
      end

      context "multi-root-account user" do
        let(:other_root_account) { account_model }
        let(:current_dra) { other_root_account }

        include_context "with saved current_domain_root_account"

        it "resolves via the current domain root account, not the user's home root" do
          t_root_account.feature_flags.create! feature: "inheritable_user_feature", state: "on"
          other_root_account.feature_flags.create! feature: "inheritable_user_feature", state: "off"
          expect(t_user.lookup_feature_flag("inheritable_user_feature").context).to eq other_root_account
          expect(t_user.feature_enabled?("inheritable_user_feature")).to be_falsey
        end
      end

      context "without a current domain root account" do
        let(:current_dra) { nil }

        include_context "with saved current_domain_root_account"

        it "uses SiteAdmin-only chain when current_domain_root_account is unset" do
          t_root_account.feature_flags.create! feature: "inheritable_user_feature", state: "on"
          expect(t_user.lookup_feature_flag("inheritable_user_feature")).to be_default
        end
      end

      context "with hidden feature" do
        let(:current_dra) { t_root_account }

        include_context "with saved current_domain_root_account"

        it "returns nil at user context with no admin-level flag" do
          expect(t_user.lookup_feature_flag("hidden_inheritable_user_feature")).to be_nil
        end

        it "returns the cloned def when override_hidden is given" do
          expect(t_user.lookup_feature_flag("hidden_inheritable_user_feature", override_hidden: true)).to be_default
        end

        it "is visible at user context once SiteAdmin sets a flag" do
          t_site_admin.feature_flags.create! feature: "hidden_inheritable_user_feature"
          expect(t_user.lookup_feature_flag("hidden_inheritable_user_feature").context).to eq t_site_admin
        end

        it "is visible at user context once RootAccount sets a flag" do
          t_root_account.feature_flags.create! feature: "hidden_inheritable_user_feature"
          expect(t_user.lookup_feature_flag("hidden_inheritable_user_feature").context).to eq t_root_account
        end
      end

      context "with shadow feature" do
        it "is filtered when include_shadowed: false" do
          expect(t_user.lookup_feature_flag("shadow_inheritable_user_feature", include_shadowed: false)).to be_nil
        end

        it "is included by default" do
          expect(t_user.lookup_feature_flag("shadow_inheritable_user_feature")).to be_default
        end
      end

      context "with root_opt_in feature" do
        let(:current_dra) { t_root_account }

        include_context "with saved current_domain_root_account"

        it "returns nil at user context until the root account opts in" do
          expect(t_user.lookup_feature_flag("root_opt_in_inheritable_user_feature")).to be_nil
        end

        it "becomes available at user context once the root account creates a flag" do
          t_root_account.feature_flags.create! feature: "root_opt_in_inheritable_user_feature"
          flag = t_user.lookup_feature_flag("root_opt_in_inheritable_user_feature")
          expect(flag.context).to eq t_root_account
          expect(t_user.feature_enabled?("root_opt_in_inheritable_user_feature")).to be_falsey
        end

        it "respects a user-level override after the root account opts in" do
          t_root_account.feature_flags.create! feature: "root_opt_in_inheritable_user_feature"
          t_user.feature_flags.create! feature: "root_opt_in_inheritable_user_feature", state: "on"
          expect(t_user.lookup_feature_flag("root_opt_in_inheritable_user_feature").context).to eq t_user
          expect(t_user.feature_enabled?("root_opt_in_inheritable_user_feature")).to be_truthy
        end
      end

      context "with a consortium parent in the chain" do
        let(:consortium_parent) { account_model }
        let(:current_dra) { t_root_account }

        include_context "with saved current_domain_root_account"

        before do
          allow(t_root_account).to receive(:account_chain)
            .with(include_site_admin: true)
            .and_return([t_root_account, consortium_parent, Account.site_admin])
        end

        it "honors a flag set on the consortium parent" do
          consortium_parent.feature_flags.create! feature: "inheritable_user_feature", state: "on"
          expect(t_user.lookup_feature_flag("inheritable_user_feature").context).to eq consortium_parent
          expect(t_user.feature_enabled?("inheritable_user_feature")).to be_truthy
        end

        it "lets the current root account override consortium 'allowed_on'" do
          consortium_parent.feature_flags.create! feature: "inheritable_user_feature", state: "allowed_on"
          t_root_account.feature_flags.create! feature: "inheritable_user_feature", state: "off"
          expect(t_user.lookup_feature_flag("inheritable_user_feature").context).to eq t_root_account
          expect(t_user.feature_enabled?("inheritable_user_feature")).to be_falsey
        end

        it "does not let the root account override a locked consortium flag" do
          consortium_parent.feature_flags.create! feature: "inheritable_user_feature", state: "off"
          t_root_account.feature_flags.create! feature: "inheritable_user_feature", state: "on"
          expect(t_user.lookup_feature_flag("inheritable_user_feature").context).to eq consortium_parent
          expect(t_user.feature_enabled?("inheritable_user_feature")).to be_falsey
        end
      end

      context "with a real consortium parent via the federated-parent hook" do
        let(:consortium_parent) { account_model }
        let(:current_dra) { t_root_account }

        include_context "with saved current_domain_root_account"

        before do
          # add_site_admin_to_chain! calls add_federated_parent_to_chain! before
          # appending site_admin, so the chain becomes
          # [t_root_account, consortium_parent, site_admin]; after the .reverse
          # in inheritable_user_account_ids the account walk is
          # [site_admin, consortium_parent, t_root_account], then
          # lookup_feature_flag checks the user-level override last.
          allow(Account).to receive(:add_federated_parent_to_chain!).and_wrap_original do |original, chain|
            original.call(chain)
            chain << consortium_parent
            chain
          end
        end

        it "honors a flag set on the consortium parent" do
          consortium_parent.feature_flags.create! feature: "inheritable_user_feature", state: "on"
          expect(t_user.lookup_feature_flag("inheritable_user_feature").context).to eq consortium_parent
          expect(t_user.feature_enabled?("inheritable_user_feature")).to be_truthy
        end

        it "lets the current root account override consortium 'allowed_on'" do
          consortium_parent.feature_flags.create! feature: "inheritable_user_feature", state: "allowed_on"
          t_root_account.feature_flags.create! feature: "inheritable_user_feature", state: "off"
          expect(t_user.lookup_feature_flag("inheritable_user_feature").context).to eq t_root_account
          expect(t_user.feature_enabled?("inheritable_user_feature")).to be_falsey
        end

        it "does not let the root account override a locked consortium flag" do
          consortium_parent.feature_flags.create! feature: "inheritable_user_feature", state: "off"
          t_root_account.feature_flags.create! feature: "inheritable_user_feature", state: "on"
          expect(t_user.lookup_feature_flag("inheritable_user_feature").context).to eq consortium_parent
          expect(t_user.feature_enabled?("inheritable_user_feature")).to be_falsey
        end
      end

      context "cross-shard" do
        specs_require_sharding

        include_context "with saved current_domain_root_account"

        it "resolves the current_domain_root_account on its own shard for a user on a different shard" do
          @other_root_account = @shard1.activate { Account.create! }
          @shard1.activate do
            @other_root_account.feature_flags.create! feature: "inheritable_user_feature", state: "on"
          end
          Account.current_domain_root_account = @other_root_account
          expect(t_user.lookup_feature_flag("inheritable_user_feature").context).to eq @other_root_account
          expect(t_user.feature_enabled?("inheritable_user_feature")).to be_truthy
        end

        it "resolves correctly when the user lives on a different shard than the current_domain_root_account" do
          shard1_user = @shard1.activate { user_with_pseudonym(account: Account.create!) }
          t_root_account.feature_flags.create! feature: "inheritable_user_feature", state: "on"
          Account.current_domain_root_account = t_root_account
          expect(shard1_user.lookup_feature_flag("inheritable_user_feature").context).to eq t_root_account
          expect(shard1_user.feature_enabled?("inheritable_user_feature")).to be_truthy
        end

        it "resolves correctly when Shard.current differs from both user.shard and root_account.shard" do
          shard1_user = @shard1.activate { user_with_pseudonym(account: Account.create!) }
          t_root_account.feature_flags.create! feature: "inheritable_user_feature", state: "on"
          Account.current_domain_root_account = t_root_account
          @shard2.activate do
            expect(shard1_user.lookup_feature_flag("inheritable_user_feature").context).to eq t_root_account
            expect(shard1_user.feature_enabled?("inheritable_user_feature")).to be_truthy
          end
        end

        it "walks a consortium parent on a third shard" do
          consortium_parent = @shard1.activate { Account.create! }
          @shard1.activate do
            consortium_parent.feature_flags.create! feature: "inheritable_user_feature", state: "on"
          end
          shard2_user = @shard2.activate { user_with_pseudonym(account: Account.create!) }
          # Stub the actual plugin extension point so the real
          # account_chain walk (and its internal shard activations) runs.
          allow(Account).to receive(:add_federated_parent_to_chain!).and_wrap_original do |original, chain|
            original.call(chain)
            chain << consortium_parent unless chain.include?(consortium_parent)
            chain
          end
          Account.current_domain_root_account = t_root_account
          expect(shard2_user.lookup_feature_flag("inheritable_user_feature").context).to eq consortium_parent
          expect(shard2_user.feature_enabled?("inheritable_user_feature")).to be_truthy
        end
      end

      context "caching" do
        include_context "with saved current_domain_root_account"

        it "re-evaluates when current_domain_root_account changes on the same user instance" do
          other_root = account_model
          t_root_account.feature_flags.create! feature: "inheritable_user_feature", state: "on"
          other_root.feature_flags.create! feature: "inheritable_user_feature", state: "off"

          Account.current_domain_root_account = t_root_account
          expect(t_user.lookup_feature_flag("inheritable_user_feature").context).to eq t_root_account

          Account.current_domain_root_account = other_root
          expect(t_user.lookup_feature_flag("inheritable_user_feature").context).to eq other_root
        end

        context "with current_domain_root_account set" do
          before { Account.current_domain_root_account = t_root_account }

          it "re-walks when skip_cache is true" do
            t_root_account.feature_flags.create! feature: "inheritable_user_feature", state: "on"
            expect(t_user.lookup_feature_flag("inheritable_user_feature").context).to eq t_root_account

            t_root_account.feature_flags.where(feature: "inheritable_user_feature").update_all(state: "off")
            expect(t_user.lookup_feature_flag("inheritable_user_feature", skip_cache: true).state).to eq "off"
          end

          it "does not poison the cache from an inherited_only lookup" do
            t_user.feature_flags.create! feature: "inheritable_user_feature", state: "off"
            t_root_account.feature_flags.create! feature: "inheritable_user_feature", state: "allowed_on"
            expect(t_user.lookup_feature_flag("inheritable_user_feature", inherited_only: true).context).to eq t_root_account
            expect(t_user.lookup_feature_flag("inheritable_user_feature").context).to eq t_user
          end

          it "does not store the IU memo on the user instance across requests" do
            t_root_account.feature_flags.create! feature: "inheritable_user_feature", state: "on"
            expect(t_user.lookup_feature_flag("inheritable_user_feature").state).to eq "on"

            instance_cache = t_user.instance_variable_get(:@feature_flag_cache) || {}
            expect(instance_cache).not_to have_key(["inheritable_user_feature", t_root_account.global_id])

            RequestCache.clear
            t_root_account.feature_flags.where(feature: "inheritable_user_feature").update_all(state: "off")
            expect(t_user.lookup_feature_flag("inheritable_user_feature", skip_cache: true).state).to eq "off"
          end
        end
      end
    end

    describe "root_opt_in" do
      context "with no feature flags" do
        it "does not find the feature beneath the root account" do
          expect(t_site_admin.lookup_feature_flag("root_opt_in_feature")).to be_default
          expect(t_root_account.lookup_feature_flag("root_opt_in_feature")).to be_new_record
          expect(t_sub_account.lookup_feature_flag("root_opt_in_feature")).to be_nil
          expect(t_course.lookup_feature_flag("root_opt_in_feature")).to be_nil
        end

        it "caches the nil of the feature beneath the root account" do
          expect(t_course.lookup_feature_flag("root_opt_in_feature")).to be_nil
          expect_any_instance_of(Account).not_to receive(:feature_flag)
          expect(t_course.lookup_feature_flag("root_opt_in_feature")).to be_nil
        end
      end

      context "with site admin feature flag" do
        it "does not find the feature beneath the root account" do
          t_site_admin.feature_flags.create! feature: "root_opt_in_feature"

          expect(t_site_admin.lookup_feature_flag("root_opt_in_feature").context).to eql t_site_admin
          expect(t_root_account.lookup_feature_flag("root_opt_in_feature")).to be_new_record
          expect(t_sub_account.lookup_feature_flag("root_opt_in_feature")).to be_nil
          expect(t_course.lookup_feature_flag("root_opt_in_feature")).to be_nil
        end

        it "finds the default_on feature beneath the root account" do
          t_site_admin.feature_flags.create! feature: "root_opt_in_feature", state: Feature::STATE_DEFAULT_ON
          expect(t_site_admin.lookup_feature_flag("root_opt_in_feature").context).to eql t_site_admin
          expect(t_root_account.lookup_feature_flag("root_opt_in_feature").context).to eql t_site_admin
          expect(t_sub_account.lookup_feature_flag("root_opt_in_feature").context).to eql t_site_admin
          expect(t_course.lookup_feature_flag("root_opt_in_feature").context).to eql t_site_admin
        end
      end

      context "with root account feature flag" do
        before do
          t_root_account.feature_flags.create! feature: "root_opt_in_feature"
        end

        it "finds the feature beneath the root account" do
          expect(t_root_account.lookup_feature_flag("root_opt_in_feature").context).to eql t_root_account
          expect(t_sub_account.lookup_feature_flag("root_opt_in_feature").context).to eql t_root_account
          expect(t_course.lookup_feature_flag("root_opt_in_feature").context).to eql t_root_account
        end
      end
    end

    describe "hidden" do
      context "with no feature flags" do
        it "does not find the feature beneath site admin" do
          expect(t_site_admin.lookup_feature_flag("hidden_feature")).to be_default
          expect(t_root_account.lookup_feature_flag("hidden_feature")).to be_nil
          expect(t_sub_account.lookup_feature_flag("hidden_feature")).to be_nil
          expect(t_course.lookup_feature_flag("hidden_feature")).to be_nil
          expect(t_user.lookup_feature_flag("hidden_user_feature")).to be_nil
        end

        it "finds hidden features if override_hidden is given" do
          expect(t_site_admin.lookup_feature_flag("hidden_feature", override_hidden: true)).to be_default
          expect(t_root_account.lookup_feature_flag("hidden_feature", override_hidden: true)).to be_default
          expect(t_sub_account.lookup_feature_flag("hidden_feature", override_hidden: true)).to be_default
          expect(t_course.lookup_feature_flag("hidden_feature", override_hidden: true)).to be_default
          expect(t_user.lookup_feature_flag("hidden_user_feature", override_hidden: true)).to be_default
        end

        it "does not create the implicit-off root_opt_in flag" do
          flag = t_root_account.lookup_feature_flag("hidden_root_opt_in_feature", override_hidden: true)
          expect(flag).to be_default
          expect(flag).to be_hidden
        end

        it "override_hidden should not trump root_opt_in" do
          expect(t_root_account.lookup_feature_flag("hidden_root_opt_in_feature", override_hidden: true)).to be_default
          expect(t_sub_account.lookup_feature_flag("hidden_root_opt_in_feature", override_hidden: true)).to be_nil
          expect(t_course.lookup_feature_flag("hidden_root_opt_in_feature", override_hidden: true)).to be_nil
        end
      end

      context "with site admin feature flag" do
        before do
          t_site_admin.feature_flags.create! feature: "hidden_feature"
          t_site_admin.feature_flags.create! feature: "hidden_user_feature"
        end

        it "finds the feature beneath site admin" do
          expect(t_site_admin.lookup_feature_flag("hidden_feature").context).to eql t_site_admin
          expect(t_root_account.lookup_feature_flag("hidden_feature").context).to eql t_site_admin
          expect(t_sub_account.lookup_feature_flag("hidden_feature").context).to eql t_site_admin
          expect(t_course.lookup_feature_flag("hidden_feature").context).to eql t_site_admin
          expect(t_user.lookup_feature_flag("hidden_user_feature").context).to eql t_site_admin
        end

        it "creates the implicit-off root_opt_in flag" do
          t_site_admin.feature_flags.create! feature: "hidden_root_opt_in_feature"
          flag = t_root_account.lookup_feature_flag("hidden_root_opt_in_feature")
          expect(flag).to be_new_record
          expect(flag.context).to eql t_root_account
          expect(flag.state).to eql "off"
        end
      end

      context "with root account feature flag" do
        before do
          t_root_account.feature_flags.create! feature: "hidden_feature"
        end

        it "finds the feature beneath site admin" do
          expect(t_site_admin.lookup_feature_flag("hidden_feature")).to be_default
          expect(t_root_account.lookup_feature_flag("hidden_feature").context).to eql t_root_account
          expect(t_sub_account.lookup_feature_flag("hidden_feature").context).to eql t_root_account
          expect(t_course.lookup_feature_flag("hidden_feature").context).to eql t_root_account
        end

        it "does not find the feature on a root account without a flag" do
          expect(account_model.lookup_feature_flag("hidden_feature")).to be_nil
        end
      end
    end

    describe "shadow" do
      it "does not find the feature unless site admin" do
        expect(t_root_account.lookup_feature_flag("shadow_feature", include_shadowed: false)).to be_nil
        expect(t_root_account.lookup_feature_flag("shadow_feature", include_shadowed: true)).to be_default
      end
    end

    context "cross-sharding" do
      specs_require_sharding

      it "searches on the correct shard" do
        t_sub_account.feature_flags.create! feature: "course_feature", state: "on"
        @other_course = t_sub_account.courses.create!

        @shard1.activate do
          flag = @other_course.lookup_feature_flag("course_feature")
          expect(flag).not_to be_default
          expect(@other_course.feature_enabled?("course_feature")).to be_truthy
        end
      end

      it "searches for site admin flags on the correct shard" do
        t_site_admin.feature_flags.create! feature: "course_feature", state: "on"

        @shard1.activate do
          account = Account.create!
          @other_course = account.courses.create!
          flag = @other_course.lookup_feature_flag("course_feature")
          expect(flag).not_to be_default
          expect(@other_course.feature_enabled?("course_feature")).to be_truthy
        end
      end
    end
  end

  describe "set_feature_flag!" do
    it "creates a feature flag" do
      t_root_account.set_feature_flag!(:course_feature, "allowed")
      expect(t_root_account.feature_flags.where(feature: "course_feature").first).to be_can_override
    end

    it "updates a feature flag" do
      flag = t_root_account.feature_flags.create! feature: "course_feature", state: "allowed"
      t_root_account.set_feature_flag!(:course_feature, "on")
      expect(flag.reload).to be_enabled
    end
  end

  describe "convenience methods" do
    it "enable_feature!s" do
      t_root_account.enable_feature! :course_feature
      expect(t_root_account.feature_flags.where(feature: "course_feature").first).to be_enabled
    end

    it "allow_feature!s" do
      t_root_account.allow_feature! :course_feature
      expect(t_root_account.feature_flags.where(feature: "course_feature").first).to be_can_override
    end

    it "reset_feature!s" do
      t_root_account.feature_flags.create! feature: "course_feature", state: "allowed"
      t_root_account.reset_feature! :course_feature
      expect(t_root_account.feature_flags.where(feature: "course_feature")).not_to be_any
    end
  end

  describe "caching" do
    let(:t_cache_key) { t_root_account.feature_flag_cache_key("course_feature") }

    before do
      t_root_account.feature_flags.create! feature: "course_feature", state: "allowed"
    end

    it "caches an object's feature flag" do
      enable_cache do
        t_root_account.feature_flag("course_feature")
        expect(Rails.cache).to exist(t_cache_key)
      end
    end

    it "caches a nil result" do
      enable_cache do
        t_root_account.feature_flag("course_feature2")
        expect(Rails.cache).to exist(t_root_account.feature_flag_cache_key("course_feature2"))
        expect(FeatureFlag).not_to receive(:where)
        t_root_account.reload.feature_flag("course_feature2")
      end
    end

    it "invalidates the cache when a feature flag is changed" do
      enable_cache do
        t_root_account.feature_flag("course_feature")
        t_root_account.feature_flags.where(feature: "course_feature").first.update_attribute(:state, "on")
        expect(Rails.cache).not_to exist(t_cache_key)
      end
    end

    it "invalidates the cache when a feature flag is destroyed" do
      enable_cache do
        t_root_account.feature_flag("course_feature")
        t_root_account.feature_flags.where(feature: "course_feature").first.destroy
        expect(Rails.cache).not_to exist(t_cache_key)
      end
    end

    it "skips the cache if requested" do
      enable_cache do
        flag = t_root_account.feature_flag("course_feature")
        expect(flag.state).to eq "allowed"
        allow(flag).to receive(:clear_cache).and_return(true) # pretend it was delayed
        flag.update_attribute(:state, "on") # update in db
        expect(t_root_account.feature_flag("course_feature").state).to eq "allowed" # still pulls from cache
        expect(t_root_account.feature_flag("course_feature", skip_cache: true).state).to eq "on" # skips it
      end
    end
  end

  describe "analytics" do
    it "sends nothing without a sampling_rate configured in DynamicSettings" do
      expect(analytics_service).not_to receive(:persist_feature_evaluation)
      t_sub_account.feature_enabled?(:account_feature)
    end

    it "send nothing if below the sampling rate" do
      allow(t_sub_account).to receive(:rand).and_return(0.8)
      override_dynamic_settings(private: { canvas: { feature_analytics: { sampling_rate: 0.5 } } }) do
        expect(analytics_service).not_to receive(:persist_feature_evaluation)
        t_sub_account.feature_enabled?(:account_feature)
      end
    end

    it "send feature context if above the sampling rate" do
      allow(t_sub_account).to receive(:rand).and_return(0.2)
      override_dynamic_settings(private: { canvas: { feature_analytics: { sampling_rate: 0.5 } } }) do
        expect(analytics_service).to receive(:persist_feature_evaluation)
        t_sub_account.feature_enabled?(:account_feature)
      end
    end

    it "caches redundant feature evaluations" do
      cache_key = t_sub_account.feature_analytics_cache_key("account_feature", true)
      override_dynamic_settings(private: { canvas: { feature_analytics: { sampling_rate: 1 } } }) do
        expect(analytics_service).to receive(:persist_feature_evaluation).once
        t_sub_account.feature_enabled?(:account_feature)
        t_sub_account.feature_enabled?(:account_feature)
        t_sub_account.feature_enabled?(:account_feature)
        expect(LocalCache.read(cache_key)).to be_truthy
      end
    end

    it "rescues and captures any unexpected exceptions" do
      err = StandardError.new("oh no!")
      expect(analytics_service).to receive(:persist_feature_evaluation).and_raise(err)
      expect(Canvas::Errors).to receive(:capture_exception).with(:feature_analytics, err)
      override_dynamic_settings(private: { canvas: { feature_analytics: { sampling_rate: 1 } } }) do
        t_sub_account.feature_enabled?(:account_feature)
      end
    end

    it "correctly sends context for root account-level flags" do
      expected_fields = {
        feature: :root_account_feature,
        context: "Account",
        root_account_id: t_root_account.global_id,
        account_id: t_root_account.global_id,
        course_id: nil,
        state: false
      }
      expect(analytics_service).to receive(:persist_feature_evaluation).with(hash_including(expected_fields))
      override_dynamic_settings(private: { canvas: { feature_analytics: { sampling_rate: 1 } } }) do
        t_root_account.feature_enabled?(:root_account_feature)
      end
    end

    it "correctly sends context for account-level flags" do
      expected_fields = {
        feature: :account_feature,
        context: "Account",
        root_account_id: t_root_account.global_id,
        account_id: t_sub_account.global_id,
        course_id: nil,
        state: true
      }
      expect(analytics_service).to receive(:persist_feature_evaluation).with(hash_including(expected_fields))
      override_dynamic_settings(private: { canvas: { feature_analytics: { sampling_rate: 1 } } }) do
        t_sub_account.feature_enabled?(:account_feature)
      end
    end

    it "correctly sends context for course-level flags" do
      expected_fields = {
        feature: :course_feature,
        context: "Course",
        root_account_id: t_root_account.global_id,
        account_id: t_sub_account.global_id,
        course_id: t_course.global_id,
        state: false
      }
      expect(analytics_service).to receive(:persist_feature_evaluation).with(hash_including(expected_fields))
      override_dynamic_settings(private: { canvas: { feature_analytics: { sampling_rate: 1 } } }) do
        t_course.feature_enabled?(:course_feature)
      end
    end
  end
end
