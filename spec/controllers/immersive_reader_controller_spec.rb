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

require "webmock/rspec"

describe ImmersiveReaderController, type: :request do
  around do |example|
    WebMock.disable_net_connect!(allow_localhost: true)
    example.run
    WebMock.enable_net_connect!
  end

  let(:ir_config) do
    {
      tenant_id: "faketenantid",
      client_id: "fakeclientid",
      client_secret: "fakesecret",
      subdomain: "fakesub"
    }
  end

  it "requires a user be logged in" do
    get "/api/v1/immersive_reader/authenticate"
    assert_unauthorized
  end

  it "requires the plugin be configured" do
    user_model
    user_session(@user)
    get "/api/v1/immersive_reader/authenticate"
    assert_status(404)
  end

  context "when the feature flag is disabled" do
    before do
      user_model
      user_session(@user)
      allow_any_instance_of(ImmersiveReaderController).to receive(:ir_config).and_return(ir_config)
    end

    it "returns 404 without contacting cognitive services" do
      get "/api/v1/immersive_reader/authenticate"
      assert_status(404)
      expect(WebMock).not_to have_requested(:post, /login\.windows\.net/)
    end
  end

  context "when the feature flag is enabled" do
    before do
      user_model
      @user.enable_feature!(:user_immersive_reader_wiki_pages)
      user_session(@user)
      allow_any_instance_of(ImmersiveReaderController).to receive(:ir_config).and_return(ir_config)
    end

    it "authenticates with cognitive services" do
      stub_request(:post, "https://login.windows.net/faketenantid/oauth2/token")
        .to_return(status: 200, body: { access_token: "tok-123" }.to_json)

      get "/api/v1/immersive_reader/authenticate"

      expect(WebMock).to have_requested(:post, "https://login.windows.net/faketenantid/oauth2/token")
        .with(
          body:
            "grant_type=client_credentials&client_id=fakeclientid&client_secret=fakesecret&resource=https%3A%2F%2Fcognitiveservices.azure.com%2F",
          headers: { "Content-Type" => "application/x-www-form-urlencoded" }
        )
        .once
      expect(response.parsed_body).to include("token" => "tok-123", "subdomain" => "fakesub")
    end

    it "caches the access_token across calls so a flood of inbound callers makes one outbound STS call" do
      stub_request(:post, "https://login.windows.net/faketenantid/oauth2/token")
        .to_return(status: 200, body: { access_token: "tok-cached" }.to_json)

      enable_cache do
        get "/api/v1/immersive_reader/authenticate"
        get "/api/v1/immersive_reader/authenticate"
      end

      expect(WebMock).to have_requested(:post, "https://login.windows.net/faketenantid/oauth2/token").once
      expect(response.parsed_body).to include("token" => "tok-cached")
    end

    it "increments a success statsd counter tagged with the cache result" do
      stub_request(:post, "https://login.windows.net/faketenantid/oauth2/token")
        .to_return(status: 200, body: { access_token: "tok-123" }.to_json)
      allow(InstStatsd::Statsd).to receive(:distributed_increment)

      expect(InstStatsd::Statsd).to receive(:distributed_increment).with(
        "immersive_reader.authentication_success",
        tags: { cache: "miss" }
      )

      get "/api/v1/immersive_reader/authenticate"
    end

    it "writes an audit log line on success" do
      stub_request(:post, "https://login.windows.net/faketenantid/oauth2/token")
        .to_return(status: 200, body: { access_token: "tok-123" }.to_json)
      allow(Rails.logger).to receive(:info)

      expect(Rails.logger).to receive(:info).with(/\[immersive_reader\] token issued/).at_least(:once)

      get "/api/v1/immersive_reader/authenticate"
    end

    context "when the token request fails" do
      let(:response_body) { { error_description: "Some error" }.to_json }

      before do
        stub_request(
          :post,
          "https://login.windows.net/faketenantid/oauth2/token"
        ).to_return(
          status: 401,
          body: response_body,
          headers: {}
        )
      end

      shared_examples_for "contexts_with_a_captured_exception" do
        it "captures the error" do
          expect(Canvas::Errors).to receive(:capture_exception).with(
            :immersive_reader,
            instance_of(ImmersiveReaderController::ServiceError),
            :warn
          )

          get "/api/v1/immersive_reader/authenticate"
        end

        it "increments the error counter" do
          allow(InstStatsd::Statsd).to receive(:distributed_increment)

          expect(InstStatsd::Statsd).to receive(:distributed_increment).with(
            "immersive_reader.authentication_failure",
            tags: { status: "401" }
          )

          get "/api/v1/immersive_reader/authenticate"
        end

        it "does not emit a success statsd counter" do
          allow(InstStatsd::Statsd).to receive(:distributed_increment)

          expect(InstStatsd::Statsd).not_to receive(:distributed_increment).with(
            "immersive_reader.authentication_success",
            anything
          )

          get "/api/v1/immersive_reader/authenticate"
        end
      end

      it_behaves_like "contexts_with_a_captured_exception"

      context "and the response has an empty body" do
        let(:response_body) { "" }

        it_behaves_like "contexts_with_a_captured_exception"
      end
    end
  end
end
