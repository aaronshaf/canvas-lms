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

describe "adheres_to_policy monkeypatches" do
  let_once(:user) { user_model }
  let(:principal) { Canvas::AdheresToPolicy::UserPrincipal.new(user) }

  describe AdheresToPolicy::Canvas do
    describe ".deprecation_check" do
      before do
        allow(described_class).to receive(:deprecation_config).and_return(Hash.new(level))
      end

      context "when level is :raise" do
        let(:level) { :raise }

        it "raises a DeprecationFailure and does not report, count, or log" do
          expect(Sentry).not_to receive(:with_scope)
          expect(InstStatsd::Statsd).not_to receive(:event)
          expect(Rails.logger).not_to receive(:warn)
          expect { described_class.deprecation_check(:default) }.to raise_error(described_class::DeprecationFailure)
        end
      end

      context "when level is :report" do
        let(:level) { :report }

        it "reports to Sentry, sends a Statsd metric, and logs a warning" do
          expect(Sentry).to receive(:capture_message).with(/AdheresToPolicy/, level: :warning)
          expect(InstStatsd::Statsd).to receive(:event).with(anything, anything, hash_including(type: :adheres_to_policy_deprecation))
          expect(Rails.logger).to receive(:warn).with(/AdheresToPolicy/)
          described_class.deprecation_check(:default)
        end
      end

      context "when level is :count" do
        let(:level) { :count }

        it "sends a Statsd metric and logs a warning but does not report to Sentry" do
          expect(Sentry).not_to receive(:with_scope)
          expect(InstStatsd::Statsd).to receive(:event).with(anything, anything, hash_including(type: :adheres_to_policy_deprecation))
          expect(Rails.logger).to receive(:warn).with(/AdheresToPolicy/)
          described_class.deprecation_check(:default)
        end
      end

      context "when level is :log" do
        let(:level) { :log }

        it "logs a warning but does not report to Sentry or send a Statsd metric" do
          expect(Sentry).not_to receive(:with_scope)
          expect(InstStatsd::Statsd).not_to receive(:event)
          expect(Rails.logger).to receive(:warn).with(/AdheresToPolicy/)
          described_class.deprecation_check(:default)
        end
      end

      context "when level is :ignore" do
        let(:level) { :ignore }

        it "does nothing" do
          expect(Sentry).not_to receive(:with_scope)
          expect(InstStatsd::Statsd).not_to receive(:event)
          expect(Rails.logger).not_to receive(:warn)
          expect { described_class.deprecation_check(:default) }.not_to raise_error
        end
      end

      context "when called twice from the same callsite" do
        let(:level) { :log }

        it "only logs once per request" do
          expect(Rails.logger).to receive(:warn).once.with(/AdheresToPolicy/)
          RequestCache.enable do
            described_class.deprecation_check(:default)
            described_class.deprecation_check(:default)
          end
        end
      end
    end
  end

  describe User do
    context "when deprecation mode is :ignore" do
      before do
        allow(AdheresToPolicy::Canvas).to receive(:deprecation_config).and_return(Hash.new(:ignore))
      end

      it "acts as Principal" do
        expect(user.user).to be user
      end

      it "compares directly with principal" do
        expect(user).to eq principal
      end
    end

    context "when deprecation mode is :raise" do
      before do
        allow(AdheresToPolicy::Canvas).to receive(:deprecation_config).and_return(Hash.new(:raise))
      end

      it "acts as Principal" do
        expect { user.user }.to raise_error(AdheresToPolicy::Canvas::DeprecationFailure)
      end

      it "compares directly with principal" do
        expect { user == principal }.to raise_error(AdheresToPolicy::Canvas::DeprecationFailure)
      end
    end
  end

  describe Canvas::AdheresToPolicy::UserPrincipal do
    context "when deprecation mode is :ignore" do
      before do
        allow(AdheresToPolicy::Canvas).to receive(:deprecation_config).and_return(Hash.new(:ignore))
      end

      describe "#initialize" do
        it "passes a nil through" do
          expect(Canvas::AdheresToPolicy::UserPrincipal.new(nil)).to be_nil
        end

        it "disallows nesting" do
          expect(Canvas::AdheresToPolicy::UserPrincipal.new(principal)).to be principal
        end
      end

      it "compares directly with user" do
        expect(principal).to eq user
      end
    end

    context "when deprecation mode is :raise" do
      before do
        allow(AdheresToPolicy::Canvas).to receive(:deprecation_config).and_return(Hash.new(:raise))
      end

      describe "#initialize" do
        it "passes a nil through" do
          expect { Canvas::AdheresToPolicy::UserPrincipal.new(nil) }.to raise_error(AdheresToPolicy::Canvas::DeprecationFailure)
        end

        it "disallows nesting" do
          expect { Canvas::AdheresToPolicy::UserPrincipal.new(principal) }.to raise_error(AdheresToPolicy::Canvas::DeprecationFailure)
        end
      end

      it "compares directly with user" do
        expect { principal == user }.to raise_error(AdheresToPolicy::Canvas::DeprecationFailure)
      end
    end

    describe "YAML round-trip" do
      let(:pseudonym) { pseudonym_model(user:) }

      it "round-trips a user-wrapping principal as a UserPrincipal (not a bare User)" do
        round_tripped = YAML.unsafe_load(YAML.dump(principal))
        expect(round_tripped).to be_a(Canvas::AdheresToPolicy::UserPrincipal)
        expect(round_tripped.user).to eq user
        expect(round_tripped.pseudonym).to be_nil
      end

      it "round-trips a pseudonym-wrapping principal with both user and pseudonym" do
        principal = Canvas::AdheresToPolicy::UserPrincipal.new(pseudonym)
        round_tripped = YAML.unsafe_load(YAML.dump(principal))
        expect(round_tripped).to be_a(Canvas::AdheresToPolicy::UserPrincipal)
        expect(round_tripped.user).to eq user
        expect(round_tripped.pseudonym).to eq pseudonym
      end
    end
  end

  describe AdheresToPolicy::InstanceMethods do
    describe "#check_right?" do
      # indirection is because I need something I can reference by reference
      let(:storage) { {} }
      let(:policy) do
        # convert from method to local variable so it can be captured by the policy block
        storage = self.storage
        AdheresToPolicy::Policy.new do
          given do |principal|
            storage[:principal] = principal
            true
          end
          can :read
        end
      end
      let(:received_principal) { storage[:principal] }

      before do
        allow(User).to receive(:policy).and_return(policy)
      end

      context "when deprecation mode is :ignore" do
        before do
          allow(AdheresToPolicy::Canvas).to receive(:deprecation_config).and_return(Hash.new(:ignore))
        end

        it "wraps users in a UserPrincipal" do
          user.grants_right?(user, :read)
          expect(received_principal).to be_a(Canvas::AdheresToPolicy::UserPrincipal)
          expect(received_principal.user).to eq user
        end

        it "does not wrap principals in a UserPrincipal" do
          user.grants_right?(principal, :read)
          expect(received_principal).to be principal
        end

        it "reuses Canvas::AdheresToPolicy::Current.principal when grants_right? is called with the User it wraps" do
          expected_principal = AdheresToPolicy::MasqueradingPrincipal.new(
            Canvas::AdheresToPolicy::UserPrincipal.new(user),
            Canvas::AdheresToPolicy::UserPrincipal.new(user_model)
          )
          Canvas::AdheresToPolicy::Current.principal = expected_principal

          resource = Account.default
          captured = nil
          allow(resource).to receive(:permission_cache_key_for).and_wrap_original do |orig, principal, *rest|
            captured = principal
            orig.call(principal, *rest)
          end

          resource.grants_right?(user, :read)
          expect(captured).to be expected_principal
        end
      end

      context "when deprecation mode is :raise" do
        before do
          allow(AdheresToPolicy::Canvas).to receive(:deprecation_config).and_return(Hash.new(:raise))
        end

        it "wraps users in a UserPrincipal" do
          expect { user.grants_right?(user, :read) }.to raise_error(AdheresToPolicy::Canvas::DeprecationFailure)
        end
      end
    end
  end
end
