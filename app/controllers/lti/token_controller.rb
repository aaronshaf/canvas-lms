# frozen_string_literal: true

#
# Copyright (C) 2021 - present Instructure, Inc.
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
require "rotp"

class Lti::TokenController < ApplicationController
  include SupportHelpers::ControllerHelpers
  include AuthenticationMethods::ElevatedAuthProvider

  before_action :require_site_admin
  before_action :require_session_authentication
  before_action :require_elevated_auth_provider
  before_action :verify_account_domain, only: :create_lti_token
  before_action :verify_1_3_tool, only: :create_lti_token
  before_action :verify_otp, only: :create_lti_token

  # UI form for generating an LTI 1.3 Advantage Access Token.
  # POSTs to create_lti_token.
  def lti_token_form; end

  # Processes the lti_token_form submission. Requires OTP verification,
  # a valid LTI 1.3 tool_id, and that the request domain matches the
  # tool's root account.
  def create_lti_token
    @token_data = lti_advantage_token.with_indifferent_access
    render :lti_token_form
  end

  def lti_2_token
    unless tool_proxy
      return render json: {
                      status: :bad_request,
                      errors: [{ message: "Unable to find tool for given parameters" }]
                    },
                    status: :bad_request
    end
    token = Lti::OAuth2::AccessToken.create_jwt(aud: request.host, sub: tool_proxy.guid)
    render plain: token.to_s
  end

  private

  def lti_advantage_token
    Canvas::OAuth::ClientCredentials::LtiAdvantage::SupportTokenProvider.new(
      key.global_id,
      request.host_with_port,
      TokenScopes::LTI_SCOPES.keys,
      @current_user,
      request.protocol
    ).generate_token
  end

  def require_session_authentication
    return unless @access_token

    render json: { errors: [{ message: "This endpoint requires session-based authentication" }] },
           status: :forbidden
    false
  end

  def verify_otp
    increment_request_cost(150)

    if @current_user.otp_secret_key.blank?
      @error = t("lti.token.errors.otp_not_configured",
                 "OTP authentication is not configured for your account.")
      render :lti_token_form, status: :forbidden
      return false
    end

    verification_code = params[:verification_code].to_s.delete(" ")

    force_fail = false
    if Canvas.redis_enabled?
      redis_key = "otp_used:#{@current_user.global_id}:#{verification_code}"
      if Canvas.redis.get(redis_key)
        force_fail = true
      else
        Canvas.redis.setex(redis_key, 10.minutes, "1")
      end
    end

    verified = (!force_fail && ROTP::TOTP.new(@current_user.otp_secret_key).verify(
      verification_code, drift_behind: 30, drift_ahead: 30
    )) || @current_user.authenticate_one_time_password(verification_code)

    unless verified
      @error = t("lti.token.errors.invalid_otp", "Invalid OTP code. Please try again.")
      render :lti_token_form, status: :unauthorized
    end
  end

  def verify_account_domain
    root_account = tool.root_account
  rescue ActiveRecord::RecordNotFound
    @error = t("lti.token.errors.tool_not_found", "Tool not found for the given Tool ID.")
    render :lti_token_form, status: :not_found
    false
  else
    if root_account == Account.site_admin
      @error = t("lti.token.errors.site_admin_tool",
                 "Cannot generate a token for a tool installed on the site admin account.")
      render :lti_token_form, status: :forbidden
      return false
    end

    unless LoadAccount.from_host(request.host) == root_account
      @error = t("lti.token.errors.domain_mismatch",
                 "The request domain does not match the tool's account domain. " \
                 "Please make the request from the tool's account domain.")
      render :lti_token_form, status: :forbidden
    end
  end

  def verify_1_3_tool
    return if key&.is_lti_key

    render json: {
             status: :bad_request,
             errors: [{ message: "Tool/Developer Key must be for LTI 1.3 tool" }]
           },
           status: :bad_request
  end

  def tool
    @tool ||= Lti::ToolFinder.find(params.require(:tool_id))
  end

  def key
    @key ||= tool.developer_key
  end

  def tool_proxy
    @tool_proxy ||= if params[:basic_launch_lti2_id]
                      Lti::MessageHandler.find(params.require(:basic_launch_lti2_id)).tool_proxy
                    else
                      Lti::ToolProxy.find params.require(:tool_proxy_id)
                    end
  end
end
