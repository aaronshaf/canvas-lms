# frozen_string_literal: true

#
# Copyright (C) 2022 - present Instructure, Inc.
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

describe Lti::IMS::Concerns::AdvantageServices, type: :request do
  let(:root_account) { Account.default }
  let(:developer_key) do
    dk = lti_developer_key_model(account: root_account)
    dk.developer_key_account_bindings.first.update!(workflow_state: "on")
    dk
  end
  let(:access_token_jwt) do
    timestamp = Time.zone.now.to_i
    JSON::JWT.new(
      iss: "https://canvas.instructure.com",
      sub: developer_key.global_id,
      aud: "http://www.example.com/login/oauth2/token",
      iat: timestamp,
      exp: timestamp + 1.hour.to_i,
      nbf: timestamp - 30,
      jti: SecureRandom.uuid,
      scopes: TokenScopes::LTI_NRPS_V2_SCOPE
    ).sign(Canvas::Security.jwt_encryption_key, :HS256).to_s
  end
  let(:course) { course_factory(active_all: true, account: root_account) }
  let(:headers) { { "Authorization" => "Bearer #{access_token_jwt}" } }

  before do
    t = ContextExternalTool.create!(
      context: course,
      consumer_key: "key",
      shared_secret: "secret",
      name: "test tool",
      url: "http://www.tool.com/launch",
      developer_key:,
      lti_version: "1.3",
      workflow_state: "public"
    )
    control = t.context_controls.new(registration: developer_key.lti_registration, available: true)
    control.course = course
    control.save!
  end

  describe "#tool" do
    it "returns success when the developer key has a tool in the context" do
      get("/api/lti/courses/#{course.id}/names_and_roles", headers:)
      expect(response).to have_http_status(:ok)
    end

    it "returns unauthorized when the developer key has no tool in the context" do
      other_course = course_factory(active_all: true, account: root_account)
      get("/api/lti/courses/#{other_course.id}/names_and_roles", headers:)
      expect(response).to have_http_status(:unauthorized)
      expect(response.parsed_body["errors"]["message"]).to eq(
        "Access Token not linked to a Tool associated with this Context"
      )
    end
  end

  describe "#verify_developer_key" do
    it "adds dk meta header with developer_key.global_id when developer_key is present" do
      get("/api/lti/courses/#{course.id}/names_and_roles", headers:)
      expect(response.headers["X-Canvas-Meta"]).to include("dk=#{developer_key.global_id}")
    end
  end
end
