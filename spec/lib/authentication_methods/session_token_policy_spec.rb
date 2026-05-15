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

describe AuthenticationMethods::SessionTokenPolicy do
  before do
    user_with_pseudonym(active: true)
    enable_default_developer_key!
    allow(InstStatsd::Statsd).to receive(:event).and_call_original
  end

  describe ".can_issue?" do
    context "with a user-generated access token" do
      let(:access_token) { @user.access_tokens.create!(purpose: "test") }

      it "emits a non-mobile issuance event with user_id" do
        described_class.can_issue?(access_token:)
        expect(InstStatsd::Statsd).to have_received(:event)
          .with("Non-Mobile Session Token Issuance", /user_id=#{@user.global_id}/, hash_including(type: :non_mobile_session_token_issuance, tags: hash_including(user_global_id: @user.global_id)))
      end

      it "returns true when the blocking flag is disabled" do
        expect(described_class.can_issue?(access_token:)).to be true
      end

      it "still emits the blocked DD event when the flag is disabled (for impact visibility)" do
        described_class.can_issue?(access_token:)
        expect(InstStatsd::Statsd).to have_received(:event)
          .with("Session Token Blocked", /user_id=#{@user.global_id}/, hash_including(type: :session_token_blocked, tags: hash_including(user_global_id: @user.global_id)))
      end

      context "when the global blocking flag is enabled" do
        before { Account.site_admin.enable_feature!(:block_session_token_for_user_generated_access_tokens_globally) }

        it "returns false" do
          expect(described_class.can_issue?(access_token:)).to be false
        end

        it "emits a blocked DD event with user_id in the message" do
          described_class.can_issue?(access_token:)
          expect(InstStatsd::Statsd).to have_received(:event)
            .with("Session Token Blocked", /user_id=#{@user.global_id}/, hash_including(type: :session_token_blocked, tags: hash_including(user_global_id: @user.global_id)))
        end

        it "still emits the non-mobile issuance event with user_id" do
          described_class.can_issue?(access_token:)
          expect(InstStatsd::Statsd).to have_received(:event)
            .with("Non-Mobile Session Token Issuance", /user_id=#{@user.global_id}/, hash_including(type: :non_mobile_session_token_issuance, tags: hash_including(user_global_id: @user.global_id)))
        end
      end

      context "when the site-admins blocking flag is enabled" do
        before { Account.site_admin.enable_feature!(:block_session_token_for_user_generated_access_tokens_for_site_admins) }

        it "returns false for a site admin user" do
          Account.site_admin.account_users.create!(user: @user)
          expect(described_class.can_issue?(access_token:)).to be false
        end

        it "returns true for a non-site-admin user" do
          expect(described_class.can_issue?(access_token:)).to be true
        end
      end
    end

    context "with an access token from a non-default, non-mobile developer key" do
      let(:dk) { DeveloperKey.create! }
      let(:access_token) { @user.access_tokens.create!(developer_key: dk, purpose: "test") }

      it "emits a non-mobile issuance event with user_id" do
        described_class.can_issue?(access_token:)
        expect(InstStatsd::Statsd).to have_received(:event)
          .with("Non-Mobile Session Token Issuance", /user_id=#{@user.global_id}/, hash_including(type: :non_mobile_session_token_issuance, tags: hash_including(user_global_id: @user.global_id)))
      end

      it "returns true even when the global blocking flag is enabled (not user-generated)" do
        Account.site_admin.enable_feature!(:block_session_token_for_user_generated_access_tokens_globally)
        expect(described_class.can_issue?(access_token:)).to be true
      end
    end

    context "with an access token from a mobile developer key" do
      let(:dk) { DeveloperKey.create! }
      let(:access_token) { @user.access_tokens.create!(developer_key: dk, purpose: "test") }

      before { Setting.set("ios_mobile_sso_developer_key_id", dk.id.to_s) }

      it "does not emit a non-mobile issuance event" do
        described_class.can_issue?(access_token:)
        expect(InstStatsd::Statsd).not_to have_received(:event)
          .with("Non-Mobile Session Token Issuance", anything, anything)
      end

      it "returns true" do
        expect(described_class.can_issue?(access_token:)).to be true
      end
    end
  end
end
