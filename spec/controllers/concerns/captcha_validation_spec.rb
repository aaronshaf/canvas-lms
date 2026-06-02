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

class CaptchaValidationTestController < ApplicationController
  include CaptchaValidation

  skip_before_action :require_user, raise: false

  def validate_captcha_test
    result = validate_captcha
    render json: { errors: result }
  end
end

describe CaptchaValidation, type: :request do
  before :all do # rubocop:disable RSpec/BeforeAfterAll
    Rails.application.routes.draw do
      root "captcha_validation_test#validate_captcha_test"
      post "validate_captcha_test", to: "captcha_validation_test#validate_captcha_test"
    end
  end

  before do
    allow(Rails.application.credentials).to receive(:dig) do |*args|
      if args == [:recaptcha_keys, :server_key]
        "test_key"
      elsif args == [:recaptcha_keys]
        { server_key: "test_key" }
      end
    end
  end

  it "returns nil when captcha key is not configured" do
    allow(Rails.application.credentials).to receive(:dig).and_return(nil)
    post "/validate_captcha_test"
    expect(response.parsed_body["errors"]).to be_nil
  end

  it "returns nil for authenticated users" do
    user = user_factory
    user_session(user)
    post "/validate_captcha_test"
    expect(response.parsed_body["errors"]).to be_nil
  end

  it "returns error when captcha verification fails" do
    allow(CanvasHttp).to receive(:post).and_return(
      instance_double(Net::HTTPResponse, code: "200", body: { "success" => false, "error-codes" => ["invalid-input"] }.to_json)
    )
    post "/validate_captcha_test", params: { "g-recaptcha-response" => "test" }
    expect(response.parsed_body["errors"]).to eq(["invalid-input"])
  end

  it "returns error when hostname doesn't match" do
    allow(CanvasHttp).to receive(:post).and_return(
      instance_double(Net::HTTPResponse, code: "200", body: { "success" => true, "hostname" => "wrong.host" }.to_json)
    )
    post "/validate_captcha_test", params: { "g-recaptcha-response" => "test" }
    expect(response.parsed_body["errors"]).to eq(["invalid-hostname"])
  end

  it "returns nil when verification succeeds" do
    allow(CanvasHttp).to receive(:post).and_return(
      instance_double(Net::HTTPResponse, code: "200", body: { "success" => true, "hostname" => "www.example.com" }.to_json)
    )
    post "/validate_captcha_test", params: { "g-recaptcha-response" => "test" }
    expect(response.parsed_body["errors"]).to be_nil
  end

  it "raises error when captcha service fails" do
    allow(CanvasHttp).to receive(:post).and_return(instance_double(Net::HTTPResponse, code: "500"))
    post "/validate_captcha_test", params: { "g-recaptcha-response" => "test" }
    expect(response).to have_http_status(:internal_server_error)
  end
end
