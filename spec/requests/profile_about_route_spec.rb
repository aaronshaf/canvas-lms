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

describe "GET /about/:id route constraint" do
  it "routes a numeric id to the profile controller" do
    user = user_with_pseudonym(active_all: true)

    get "/about/#{user.id}"

    # an anonymous request for a private profile gets bounced to login,
    # which proves the request reached ProfileController#show
    expect(response).to redirect_to(login_url)
  end

  it "routes a sis_user_id lookup to the profile controller" do
    user_with_pseudonym(active_all: true, sis_user_id: "SIS_42")

    get "/about/sis_user_id:SIS_42"

    expect(response).to redirect_to(login_url)
  end

  it "rejects scanner junk at the router before reaching the controller" do
    get "/about/function.php"

    expect(response).to have_http_status(:not_found)
  end

  it "rejects path-traversal junk at the router" do
    get "/about/..%2F..%2Fetc%2Fpasswd"

    expect(response).to have_http_status(:not_found)
  end
end
