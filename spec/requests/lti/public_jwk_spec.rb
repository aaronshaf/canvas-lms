# frozen_string_literal: true

#
# Copyright (C) 2019 - present Instructure, Inc.
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

require_relative "../../controllers/lti/ims/concerns/advantage_services_shared_context"
require_relative "../../controllers/lti/ims/concerns/lti_services_shared_examples"

module Lti
  describe PublicJwkController do
    describe "#update" do
      include_context "advantage services context"
      include_context "advantage access token context"

      def action_url_for(_action, _params_overrides)
        "/api/lti/developer_key/update_public_jwk"
      end

      def send_http
        url = action_url_for(action, params_overrides)
        headers = { "Host" => "test.host" }
        headers["Authorization"] = "Bearer #{access_token_jwt}" if access_token_jwt
        case request_method
        when :get, :delete
          send(request_method, url, headers:)
        when :post, :put
          body_params = (body_overrides || {}).merge(params_overrides)
          send(request_method,
               url,
               params: body_params,
               as: :json,
               headers:)
        end
      end

      def send_request
        send_http
      end

      let(:action) { :update }
      let(:request_method) { :put }
      let(:old_public_jwk) { developer_key.public_jwk }
      let(:new_public_jwk) do
        key_hash = CanvasSecurity::RSAKeyPair.new.public_jwk.to_h
        key_hash["kty"] = key_hash["kty"].to_s
        key_hash
      end

      it_behaves_like "lti services" do
        let(:action) { :update }
        let(:expected_mime_type) { described_class::MIME_TYPE }
        let(:scope_to_remove) { "https://canvas.instructure.com/lti/public_jwk/scope/update" }
        let(:new_public_jwk) do
          key_hash = CanvasSecurity::RSAKeyPair.new.public_jwk.to_h
          key_hash["kty"] = key_hash["kty"].to_s
          key_hash
        end
        let(:params_overrides) do
          { developer_key: { public_jwk: new_public_jwk } }
        end
        let(:body_overrides) do
          { developer_key: { public_jwk: new_public_jwk } }
        end
        let(:request_method) { :put }
      end

      def make_request(public_jwk)
        put "/api/lti/developer_key/update_public_jwk",
            params: { developer_key: { public_jwk: } },
            as: :json,
            headers: {
              "Authorization" => "Bearer #{access_token_jwt}",
              "Host" => "test.host"
            }
      end

      context "when public jwk is valid" do
        let(:body_overrides) do
          { developer_key: { public_jwk: new_public_jwk } }
        end

        before do
          old_public_jwk
          send_request
        end

        it "update public jwk was successful" do
          expect(response.parsed_body["public_jwk"]).not_to eq old_public_jwk
          expect(response.parsed_body["public_jwk"]).to eq new_public_jwk
          expect(developer_key.reload.public_jwk).to eq new_public_jwk
        end

        it "return 200 success http status" do
          expect(response).to have_http_status :ok
        end
      end

      context "when pubic jwk is not valid" do
        let(:body_overrides) do
          { developer_key: { public_jwk: { hello: "world" } } }
        end

        before do
          old_public_jwk
          send_request
        end

        it "update public jwk was not successful" do
          expect(developer_key.reload.public_jwk).to eq old_public_jwk
        end

        it "return 422 unathorized http status" do
          expect(response).to have_http_status :unprocessable_content
        end
      end

      context "when public jwk is empty" do
        let(:body_overrides) do
          { developer_key: { public_jwk: {} } }
        end

        before do
          old_public_jwk
          send_request
        end

        it "update public jwk to nil" do
          expect(developer_key.reload.public_jwk).to be_nil
        end

        it "return 200 success http status" do
          expect(response).to have_http_status :ok
        end
      end
    end
  end
end
