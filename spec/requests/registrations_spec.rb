# frozen_string_literal: true

#
# Copyright (C) 2025 - present Instructure, Inc.
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

describe 'UsersController' do
  before do
    Account.default.canvas_authentication_provider.update_attribute(
      :self_registration, true
    )
  end

  # ---------------------------------------------------------------------------
  # Registration page does not require terms when globally disabled
  # Covers: spec/selenium/people/users_spec.rb:191
  # When Setting terms_required is 'false', the ACCOUNT ENV on the
  # registration page must have terms_required: false.
  # ---------------------------------------------------------------------------
  describe 'GET /register (globally no terms)' do
    it 'returns terms_required false when Setting terms_required is false' do
      Setting.set('terms_required', 'false')
      TermsOfService.ensure_terms_for_account(Account.default)

      get '/register'

      expect(response).to have_http_status(:ok)
      expect(response.body).to include('"terms_required":false')
    end
  end

  # ---------------------------------------------------------------------------
  # Registration page does not require terms when account opt-out
  # Covers: spec/selenium/people/users_spec.rb:204
  # When account_terms_required is false on the account, the ACCOUNT ENV on
  # the registration page must have terms_required: false.
  # ---------------------------------------------------------------------------
  describe 'GET /register (account-level no terms)' do
    it 'returns terms_required false when account_terms_required is disabled' do
      Account.default.settings[:account_terms_required] = false
      Account.default.save!
      TermsOfService.ensure_terms_for_account(Account.default)

      get '/register'

      expect(response).to have_http_status(:ok)
      expect(response.body).to include('"terms_required":false')
    end
  end
end
