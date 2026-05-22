# frozen_string_literal: true

# rubocop:disable RSpec/MultipleDescribes
#
# Copyright (C) 2015 - present Instructure, Inc.
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

describe Login::ExternalAuthObserversController, type: :request do
  describe "POST #redirect_login" do
    let(:valid_params) do
      {
        "user" => { "name" => "parent", "terms_of_use" => "1", "initial_enrollment_type" => "observer" },
        "pseudonym" => { "unique_id" => "parent@test.com" },
        "observee" => { "unique_id" => "childstudent" },
        "authenticity_token" => "9fHC1DSto0V"
      }
    end

    it "returns an error if unique_id is not valid" do
      invalid_params = valid_params.merge("observee" => { "unique_id" => "nonexistent" })
      post("/external_auth_observers/redirect_login", params: invalid_params)
      expect(response).to have_http_status :unprocessable_content
    end
  end
end

# ExternalAuthObservers "redirects to login path" test requires controller spec style due to
# session serialization issues in request specs. This is kept separate for clarity.
describe Login::ExternalAuthObserversController do
  describe "POST #redirect_login" do
    let(:params) do
      {
        "user" => { "name" => "parent", "terms_of_use" => "1", "initial_enrollment_type" => "observer" },
        "pseudonym" => { "unique_id" => "parent@test.com" },
        "observee" => { "unique_id" => "childstudent" },
        "authenticity_token" => "9fHC1DSto0V"
      }
    end

    it "redirects to login path" do
      allow(controller).to receive_messages(valid_observee_unique_id?: true, observer_email_taken?: false)
      subject = post(:redirect_login, params:)
      expect(subject).to be_successful
    end
  end
end
# rubocop:enable RSpec/MultipleDescribes
