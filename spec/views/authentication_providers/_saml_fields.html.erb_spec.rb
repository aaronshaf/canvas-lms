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

describe "authentication_providers/_saml_fields" do
  let(:account) { Account.default }

  before do
    account.authentication_providers.scope.delete_all
    assign(:context, assign(:account, account))
    assign(:domain_root_account, account)
    admin = account_admin_user(account:)
    assign(:current_user, admin)
    assign(:current_pseudonym, pseudonym(admin, account:))
    assign(:saml_identifiers, [])
    assign(:saml_authn_contexts, [])
    assign(:saml_login_attributes, {})
    assign(:presenter, AuthenticationProvidersPresenter.new(account))
  end

  def create_saml_provider
    account.authentication_providers.create!(auth_type: "saml")
  end

  context "when entity_id is a valid http URL" do
    it "renders a link with the http href" do
      account.settings[:saml_entity_id] = "https://example.com/saml2"
      account.save!
      create_saml_provider
      render "authentication_providers/index"
      doc = Nokogiri::HTML5(response.body)
      expect(doc.at_css("a[href='https://example.com/saml2']")).to be_present
    end
  end

  context "when entity_id is a javascript: URI" do
    it "renders the entity_id as plain text with no anchor tag" do
      account.settings[:saml_entity_id] = "javascript:alert(1)"
      account.save!
      create_saml_provider
      render "authentication_providers/index"
      doc = Nokogiri::HTML5(response.body)
      expect(doc.at_css("a[href='javascript:alert(1)']")).to be_nil
      expect(doc.at_css("a[href*='javascript']")).to be_nil
      expect(response.body).to include("javascript:alert(1)")
    end
  end
end
