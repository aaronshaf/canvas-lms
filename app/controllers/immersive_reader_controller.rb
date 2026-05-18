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

# This API requires Immersive Reader to be configured

class ImmersiveReaderController < ApplicationController
  CACHE_DEFAULT_EXPIRY = 30.minutes
  CACHE_EXPIRY_BUFFER = 8.seconds
  CACHE_RACE_CONDITION_TTL = 5.seconds

  EXTRA_REQUEST_COST = 100

  before_action :require_config
  before_action :require_feature_enabled

  class ServiceError < StandardError; end

  def authenticate
    cache_hit = true
    token = Rails.cache.fetch(
      token_cache_key,
      expires_in: CACHE_DEFAULT_EXPIRY - CACHE_EXPIRY_BUFFER - CACHE_RACE_CONDITION_TTL,
      race_condition_ttl: CACHE_RACE_CONDITION_TTL
    ) do
      cache_hit = false
      increment_request_cost(EXTRA_REQUEST_COST)
      fetch_access_token
    end

    log_token_issuance(cache_hit)
    render json: { token:, subdomain: ir_config[:subdomain] }
  rescue ServiceError => e
    Canvas::Errors.capture_exception(:immersive_reader, e, :warn)
  end

  private

  def fetch_access_token
    response = CanvasHttp.post(service_url, headers, form_data: form)

    if response && response.code == "200"
      JSON.parse(response.body)["access_token"]
    else
      body = begin
        JSON.parse(response.body)
      rescue JSON::ParserError
        {}
      end

      increment_error_count(response)
      raise ServiceError, "Error connecting to cognitive services #{body["error_description"]}"
    end
  end

  def log_token_issuance(cache_hit)
    cache_tag = cache_hit ? "hit" : "miss"
    InstStatsd::Statsd.distributed_increment(
      "immersive_reader.authentication_success",
      tags: { cache: cache_tag }
    )
    Rails.logger.info(
      "[immersive_reader] token issued " \
      "user_id=#{@current_user&.global_id} " \
      "root_account_id=#{@domain_root_account&.global_id} " \
      "request_id=#{request.request_id} cache=#{cache_tag}"
    )
  end

  def increment_error_count(response)
    InstStatsd::Statsd.distributed_increment(
      "immersive_reader.authentication_failure",
      tags: { status: response.code }
    )
  end

  def ir_config
    @ir_config ||= Rails.application.credentials.immersive_reader || {}
  end

  def require_config
    render json: { message: "Service not found" }, status: :not_found unless ir_config.present?
  end

  def require_feature_enabled
    return if feature_enabled_for_caller?

    render json: { message: "Service not found" }, status: :not_found
  end

  def feature_enabled_for_caller?
    @domain_root_account&.feature_enabled?(:immersive_reader_wiki_pages) ||
      @current_user&.feature_enabled?(:user_immersive_reader_wiki_pages)
  end

  def token_cache_key
    ["immersive_reader_token", ir_config[:client_id]]
  end

  def service_url
    "https://login.windows.net/#{ir_config[:tenant_id]}/oauth2/token"
  end

  def headers
    { "content-type": "application/x-www-form-urlencoded" }
  end

  def form
    {
      grant_type: "client_credentials",
      client_id: ir_config[:client_id],
      client_secret: ir_config[:client_secret],
      resource: "https://cognitiveservices.azure.com/"
    }
  end
end
