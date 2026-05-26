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

require_relative "../views_helper"

describe "shared/_account_notification" do
  let_once(:account) { Account.default }
  let_once(:user) { user_factory }

  let(:file_url) { "/users/#{user.id}/files/1800103/preview?verifier=some_uuid" }
  let(:notification) do
    account_notification(
      account:,
      message: %(<p>See attachment: <a href="#{file_url}">file</a></p>)
    )
  end

  before do
    assign(:current_user, user)
    assign(:domain_root_account, account)
  end

  def rendered_html
    render partial: "shared/account_notification", locals: { account_notification: notification }
    response.body
  end

  context "when file_association_access feature flag is disabled" do
    before { account.disable_feature!(:file_association_access) }

    it "does not append a location tag to file URLs" do
      expect(rendered_html).not_to include("location=account_notification_#{notification.id}")
    end

    it "preserves the verifier in file URLs" do
      expect(rendered_html).to include("verifier=some_uuid")
    end
  end

  context "when file_association_access feature flag is enabled" do
    before { account.enable_feature!(:file_association_access) }

    it "appends a location tag to file URLs" do
      expect(rendered_html).to include("location=account_notification_#{notification.id}")
    end
  end
end
