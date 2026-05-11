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

RSpec.describe Operations::ForceCanvasPasswordReset do
  let(:root_account) { account_model }
  let(:operation) { described_class.new(root_account:) }

  describe "#execute" do
    it "sets must_reset_password on active pseudonyms with a nil authentication_provider_id" do
      user_a = user_with_pseudonym(account: root_account)
      user_b = user_with_pseudonym(account: root_account)

      expect { operation.execute }
        .to change { user_a.pseudonyms.first.reload.must_reset_password }.from(false).to(true)
        .and change { user_b.pseudonyms.first.reload.must_reset_password }.from(false).to(true)
    end

    it "sets must_reset_password on pseudonyms explicitly assigned to the canvas auth provider" do
      canvas_ap = root_account.canvas_authentication_provider
      user = user_with_pseudonym(account: root_account)
      user.pseudonyms.first.update!(authentication_provider: canvas_ap)

      operation.execute

      expect(user.pseudonyms.first.reload.must_reset_password).to be(true)
    end

    it "does not affect pseudonyms assigned to a non-canvas authentication provider" do
      google_ap = root_account.authentication_providers.create!(auth_type: "google")
      user = user_with_pseudonym(account: root_account)
      user.pseudonyms.first.update!(authentication_provider: google_ap)

      operation.execute

      expect(user.pseudonyms.first.reload.must_reset_password).to be(false)
    end

    it "does not affect pseudonyms belonging to a different root account" do
      other_account = account_model
      other_user = user_with_pseudonym(account: other_account)

      operation.execute

      expect(other_user.pseudonyms.first.reload.must_reset_password).to be(false)
    end

    it "does not affect deleted pseudonyms" do
      user = user_with_pseudonym(account: root_account)
      pseudonym = user.pseudonyms.first
      pseudonym.destroy

      operation.execute

      expect(pseudonym.reload.must_reset_password).to be(false)
    end
  end

  describe "#job_options" do
    it "uses Delayed::HIGH_PRIORITY" do
      expect(operation.send(:job_options)[:priority]).to be(Delayed::HIGH_PRIORITY)
    end
  end
end
