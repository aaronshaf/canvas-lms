# frozen_string_literal: true

#
# Copyright (C) 2012 - present Instructure, Inc.
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

# @API Developer Keys
#
# Manage Canvas API Keys, used for OAuth access to this API.
# See <a href="file.oauth.html">the OAuth access docs</a> for usage of these keys.
# Note that DeveloperKeys are also (currently) used for LTI 1.3 registration and OIDC access,
# but this endpoint deals with Canvas API keys. See <a href="file.registration.html">LTI Registration</a>
# for details.
#
# @model DeveloperKey
#    {
#      "id": "DeveloperKey",
#      "description": "a Canvas API key (or LTI 1.3 registration)",
#      "properties": {
#        "id": {
#          "description": "The Canvas ID of the DeveloperKey object",
#          "example": 1,
#          "type": "integer"
#        },
#        "name": {
#          "description": "The display name",
#          "example": "Test Key",
#          "type": "string"
#        },
#        "created_at": {
#          "description": "Timestamp of the key's creation",
#          "example": "2025-05-30T17:09:18Z",
#          "type": "datetime"
#        },
#        "updated_at": {
#          "description": "Timestamp of the key's last update",
#          "example": "2025-05-30T17:09:18Z",
#          "type": "datetime"
#        },
#        "workflow_state": {
#          "description": "The state of the key",
#          "example": "active",
#          "type": "string",
#          "enum":
#          [
#            "active",
#            "deleted"
#          ]
#        },
#        "is_lti_key": {
#          "description": "True if key represents an LTI 1.3 Registration. False for Canvas API keys",
#          "example": false,
#          "type": "boolean"
#        },
#        "email": {
#          "description": "Contact email configured for key",
#          "example": "test@example.com",
#          "type": "string"
#        },
#        "icon_url": {
#          "description": "URL for a small icon to display in key list",
#          "example": "https://example.com/icon.png",
#          "type": "string"
#        },
#        "notes": {
#          "description": "User-provided notes about key",
#          "example": "this key is for testing",
#          "type": "string"
#        },
#        "vendor_code": {
#          "description": "User-specified code representing the vendor that uses the key",
#          "example": "Google",
#          "type": "string"
#        },
#        "account_name": {
#          "description": "The name of the account that owns the key",
#          "example": "Test Account",
#          "type": "string"
#        },
#        "visible": {
#          "description": "True for all keys except Site Admin-level keys, which default to false. Controls visibility in the Inherited tab.",
#          "example": true,
#          "type": "boolean"
#        },
#        "scopes": {
#          "description": "List of API endpoints key is allowed to access (API keys), or LTI 1.3 scopes (LTI keys)",
#          "example": ["url:GET|/api/v1/accounts"],
#          "type": "array",
#          "items": { "type": "string" }
#        },
#        "redirect_uri": {
#          "description": "Deprecated in favor of redirect_uris. Do not use.",
#          "example": "no",
#          "type": "string"
#        },
#        "redirect_uris": {
#          "description": "List of URLs used during OAuth2 flow to validate given redirect URI (API keys), or to redirect to after login (LTI keys)",
#          "example": ["https://mytool.com/oauth2/redirect", "https://mytool.com/1_3/launch"],
#          "type": "array",
#          "items": { "type": "string" }
#        },
#        "all_redirect_uris": {
#          "description": "All redirect URIs associated with the key, including any that have been automatically deactivated due to inactivity, along with their last-used timestamp and workflow_state (one of 'active' or 'inactive')",
#          "example": [{ "redirect_uri": "https://mytool.com/redirect", "last_used_at": "2024-01-15T12:00:00Z", "workflow_state": "active" }],
#          "type": "array",
#          "items": { "type": "object", "properties": { "redirect_uri": { "type": "string" }, "last_used_at": { "type": "datetime" }, "workflow_state": { "type": "string" } } }
#        },
#        "access_token_count": {
#          "description": "(API keys only) The number of active access tokens associated with the key",
#          "example": "42",
#          "type": "integer"
#        },
#        "last_used_at": {
#          "description": "(API keys only) The last time an access token for this key was used in an API request",
#          "example": "2025-05-30T17:09:18Z",
#          "type": "datetime"
#        },
#        "test_cluster_only": {
#          "description": "(API keys only) If true, key is only usable in non-production environments (test, beta). Avoids problems with beta refresh.",
#          "example": false,
#          "type": "boolean"
#        },
#        "allow_includes": {
#          "description": "(API keys only) If true, allows `includes` parameters in API requests that match the scopes of this key",
#          "example": true,
#          "type": "boolean"
#        },
#        "require_scopes": {
#          "description": "(API keys only) If true, then token requests with this key must include scopes",
#          "example": false,
#          "type": "boolean"
#        },
#        "client_credentials_audience": {
#          "description": "(API keys only) Used in OAuth2 client credentials flow to specify the audience for the access token",
#          "example": "external",
#          "type": "string"
#        },
#        "api_key": {
#          "description": "(API keys only) The client secret used in the OAuth authorization_code flow.",
#          "example": "sd45fg64....",
#          "type": "string"
#        },
#        "tool_configuration": {
#          "description": "(LTI keys only) The Canvas-style tool configuration for this key.",
#           "example": { "type": "Lti::ToolConfiguration" },
#           "$ref": "Lti::ToolConfiguration"
#        },
#        "public_jwk": {
#          "description": "(LTI keys only) The tool's public JWK in JSON format. Discouraged in favor of a url hosting a JWK set.",
#          "example": { "e": "AQAB", "etc": "etc" },
#          "type": "object"
#        },
#        "public_jwk_url": {
#          "description": "(LTI keys only) The tool-hosted URL containing its public JWK keyset. Canvas may cache JWKs up to 5 minutes.",
#          "example": "https://mytool.com/1_3/jwks",
#          "type": "string"
#        },
#        "lti_registration": {
#          "description": "(LTI keys only) The LTI IMS Registration object for this key, if key was created via Dynamic Registration.",
#          "example": { "type": "TODO Lti::IMS::Registration" },
#          "type": "object"
#        },
#        "is_lti_registration": {
#          "description": "(LTI keys only) Returns true if key was created via Dynamic Registration.",
#          "example": false,
#          "type": "boolean"
#        },
#        "user_name": {
#          "description": "Unused.",
#          "example": "",
#          "type": "string"
#        },
#        "user_id": {
#          "description": "Unused.",
#          "example": "",
#          "type": "string"
#        },
#        "unified_tool_id": {
#          "description": "Correlates an API key to a product configuration.",
#          "example": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
#          "type": "string"
#        }
#      }
#    }
class DeveloperKeysController < ApplicationController
  before_action :set_key, only: %i[update destroy regenerate_secret]
  before_action :require_manage_developer_keys
  before_action :require_modify_site_admin_developer_keys, except: %i[index lookup_utids]
  before_action :require_root_account, only: %i[index create]
  before_action :require_elevated_auth_provider,
                only: %i[index create update destroy regenerate_secret],
                if: :require_elevated_auth_provider_for_developer_keys?
  before_action :restrict_cross_domain_modifications, only: %i[create update destroy regenerate_secret]

  include HorizonMode

  before_action :load_canvas_career, only: [:index]

  include Api::V1::DeveloperKey

  # @API List Developer Keys
  #
  # List all developer keys created in the current account.
  #
  # @argument inherited [Optional, boolean] Defaults to false. If true, lists keys inherited from
  #   Site Admin (and consortium parent account, if applicable).
  #
  # @returns [DeveloperKey]
  def index
    respond_to do |format|
      format.html do
        set_navigation

        js_env({
                 accountEndpoint: api_v1_account_developer_keys_path(@context),
                 enableTestClusterChecks: DeveloperKey.test_cluster_checks_enabled?,
                 showApiGetWithBodyNotice: !!@domain_root_account.settings[:show_api_get_with_body_notice],
                 validLtiScopes:
            TokenScopes.public_lti_scopes_hash_for_account(@domain_root_account),
                 devKeysReadOnly: read_only_mode?,
                 developerKeyRegenerateSecretEnabled: @domain_root_account.feature_enabled?(:developer_key_regenerate_secret)
               })

        render :index
      end

      format.json do
        @keys = Api.paginate(index_scope, self, api_v1_account_developer_keys_url(@context))
        render json: developer_keys_json(
          @keys,
          current_principal,
          session,
          account_context,
          inherited: params[:inherited].present?,
          include_tool_config: params[:inherited].blank?
        )
      end
    end
  rescue => e
    report_error(e)
    raise e
  end

  # @API Create a Developer Key
  #
  # Create a new Canvas API key. Creating an LTI 1.3 registration is not supported here and
  # should be done via the LTI Registration API.
  #
  # @argument developer_key [Required, json]
  # @argument developer_key[auto_expire_tokens] [Optional, boolean] Defaults to false. If true, access tokens
  #   generated by this key will expire after 1 hour.
  # @argument developer_key[email] [Optional, string] Contact email for the key.
  # @argument developer_key[icon_url] [Optional, string] URL for a small icon to display in key list.
  # @argument developer_key[name] [Optional, string] The display name.
  # @argument developer_key[notes] [Optional, string] User-provided notes about the key.
  # @argument developer_key[redirect_uri] [Optional, string] Deprecated in favor of redirect_uris. Do not use.
  # @argument developer_key[redirect_uris] [Optional, array] List of URLs used during OAuth2 flow to validate
  #   given redirect URI.
  # @argument developer_key[vendor_code] [Optional, string] User-specified code representing the vendor that uses the key.
  # @argument developer_key[visible] [Optional, boolean] Defaults to true. If false, key will not be visible in the UI.
  # @argument developer_key[test_cluster_only] [Optional, boolean] Defaults to false. If true, key is only usable in
  #   non-production environments (test, beta). Avoids problems with beta refresh.
  # @argument developer_key[client_credentials_audience] [Optional, string] Used in OAuth2 client credentials flow to
  #   specify the audience for the access token.
  # @argument developer_key[scopes] [Optional, array] List of API endpoints key is allowed to access.
  # @argument developer_key[require_scopes] [Optional, boolean] If true, then token requests with this key must include scopes.
  # @argument developer_key[allow_includes] [Optional, boolean] If true, allows `includes` parameters in API requests that
  #   match the scopes of this key.
  #
  # @returns DeveloperKey
  def create
    @key = DeveloperKey.new(developer_key_params)
    @key.current_user = @current_user
    @key.account = @context if params[:account_id] && @context != Account.site_admin
    if @key.save
      render json: developer_key_json(@key, current_principal, session, account_context, show_full_secret: true)
    else
      report_error(nil, 400)
      render json: @key.errors, status: :bad_request
    end
  rescue => e
    report_error(e)
    raise e
  end

  # @API Update a Developer Key
  #
  # Update an existing Canvas API key. Updating an LTI 1.3 registration is not supported here and should
  # be done via the LTI Registration API.
  #
  # @argument developer_key [Required, json]
  # @argument developer_key[auto_expire_tokens] [Optional, boolean] Defaults to false. If true, access tokens
  #   generated by this key will expire after 1 hour.
  # @argument developer_key[email] [Optional, string] Contact email for the key.
  # @argument developer_key[icon_url] [Optional, string] URL for a small icon to display in key list.
  # @argument developer_key[name] [Optional, string] The display name.
  # @argument developer_key[notes] [Optional, string] User-provided notes about the key.
  # @argument developer_key[redirect_uri] [Optional, string] Deprecated in favor of redirect_uris. Do not use.
  # @argument developer_key[redirect_uris] [Optional, array] List of URLs used during OAuth2 flow to validate
  #   given redirect URI.
  # @argument developer_key[vendor_code] [Optional, string] User-specified code representing the vendor that uses the key.
  # @argument developer_key[visible] [Optional, boolean] Defaults to true. If false, key will not be visible in the UI.
  # @argument developer_key[test_cluster_only] [Optional, boolean] Defaults to false. If true, key is only usable in
  #   non-production environments (test, beta). Avoids problems with beta refresh.
  # @argument developer_key[client_credentials_audience] [Optional, string] Used in OAuth2 client credentials flow to
  #   specify the audience for the access token.
  # @argument developer_key[scopes] [Optional, array] List of API endpoints key is allowed to access.
  # @argument developer_key[require_scopes] [Optional, boolean] If true, then token requests with this key must include scopes.
  # @argument developer_key[allow_includes] [Optional, boolean] If true, allows `includes` parameters in API requests that
  #   match the scopes of this key.
  #
  # @returns DeveloperKey
  def update
    @key.process_event!(params[:developer_key].delete(:event)) if params[:developer_key].key?(:event)
    @key.attributes = developer_key_params unless params[:developer_key].empty?
    if @key.scopes.present? && !@key.is_lti_key?
      @key.scopes = @key.scopes.select do |scope|
        TokenScopes.all_scopes.include?(scope) ||
          scope.starts_with?("#{TokenScopes::ELEVATED_OPERATIONS_PREFIX}/")
      end
    end
    if @key.save
      render json: developer_key_json(@key, current_principal, session, account_context)
    else
      report_error(nil, 400)
      render json: @key.errors, status: :bad_request
    end
  rescue => e
    report_error(e)
    raise e
  end

  # @API Delete a Developer Key
  #
  # Delete an existing Canvas API key. Deleting an LTI 1.3 registration should be done via the LTI Registration API.
  #
  # @returns DeveloperKey
  def destroy
    DeveloperKey.transaction do
      raise ActiveRecord::RecordNotDestroyed unless @key.destroy
    end

    render json: developer_key_json(@key, current_principal, session, account_context)
  rescue => e
    report_error(e)
    raise e
  end

  # @API Regenerate Developer Key Secret
  #
  # Regenerate the secret (api_key) for an existing Canvas API key. This invalidates
  # the existing secret. Any applications using the old secret will stop working.
  # Regenerating a secret for an LTI key is not supported.
  #
  # This endpoint requires the developer_key_regenerate_secret feature flag to be enabled.
  # This feature flag can only be turned on by Site Admins
  #
  # @example_request
  #   curl https://<canvas>/api/v1/developer_keys/<key_id>/regenerate_secret \
  #     -X POST \
  #     -H 'Authorization: Bearer <token>'
  #
  # @example_response
  #   {
  #     "id": "10000000000123",
  #     "api_key": "abc123xyz789fullsecretkey",
  #     "name": "My API Integration",
  #     "created_at": "2026-01-15T12:00:00Z",
  #     "workflow_state": "active",
  #     "redirect_uri": "https://example.com/oauth/callback",
  #     "access_token_count": 5,
  #     ...
  #   }
  #
  # @returns DeveloperKey
  def regenerate_secret
    if account_context.site_admin?
      return render json: { errors: [{ message: "Cannot regenerate secret for Site Admin keys" }] },
                    status: :forbidden
    end

    unless account_context.root_account.feature_enabled?(:developer_key_regenerate_secret)
      return render json: { errors: [{ message: "Feature not enabled" }] },
                    status: :forbidden
    end

    if @access_token&.manually_created?
      return render json: { errors: [{ message: "Cannot regenerate secret using a user-generated access token" }] },
                    status: :forbidden
    end

    if @access_token && @access_token.developer_key != @key
      return render json: { errors: [{ message: "Cannot regenerate secret for a developer key other than the one associated with this access token" }] },
                    status: :forbidden
    end

    if @key.is_lti_key
      return render json: { errors: [{ message: "Cannot regenerate secret for LTI keys" }] },
                    status: :bad_request
    end

    @key.generate_api_key(overwrite: true)
    if @key.save
      render json: developer_key_json(@key, current_principal, session, account_context, show_full_secret: true)
    else
      report_error(nil, 400)
      render json: @key.errors, status: :bad_request
    end
  rescue => e
    report_error(e)
    raise e
  end

  # @API Lookup LP API Registrations by Redirect URIs
  # @internal
  # Returns a list of matching Unified Tool IDs (UTIDs) from Learn Platform
  # for the given redirect URIs.
  #
  # @argument redirect_uris [Required, Array]
  #   An array of redirect URI strings to match
  # @argument sources [Optional, Array]
  #   An array of sources to look up the redirect URIs from. Possible values are
  #   `partner_provided` and `manual` (defaults to both).
  #
  # @example_request
  #   {
  #     "redirect_uris": ["https://example.com/redirect", "https://another.com/callback"]
  #   }
  #
  # @returns [ApiRegistration]
  def lookup_utids
    redirect_uris = params.require(:redirect_uris)
    sources = params.permit(sources: [])[:sources]

    api_registrations = LearnPlatform::GlobalApi.lookup_api_registrations(redirect_uris, sources:)
    render json: { api_registrations: }, status: :ok
  rescue => e
    report_error(e, :bad_request)
    render json: { error: "Failed to match redirect URIs" }, status: :bad_request
  end

  protected

  def set_navigation
    set_active_tab "developer_keys"
    add_crumb t("#crumbs.developer_keys", "Developer Keys")
  end

  private

  def index_scope
    scope = if params[:inherited].present?
              # Return site admin keys that have been made
              # visible to inheriting accounts
              return DeveloperKey.none if @context.site_admin?

              Account.site_admin.shard.activate do
                DeveloperKey.visible.site_admin
              end
            elsif @context.site_admin?
              # Return all siteadmin keys
              DeveloperKey.site_admin
            else
              # Only return keys that belong to the current account
              DeveloperKey.where(account_id: @context.id)
            end
    scope = scope.eager_load(:tool_configuration) unless params[:inherited]
    scope = scope.nondeleted.preload(:account).order("developer_keys.id DESC")

    # query for parent keys is most likely cross-shard,
    # so doesn't fit into the scope cases above
    if params[:inherited].present? && !@context.root_account.primary_settings_root_account?
      federated_parent = @context.account_chain(include_federated_parent: true).last
      parent_keys = DeveloperKey
                    .shard(federated_parent.shard)
                    .where(account: federated_parent)
                    .nondeleted
                    .order("developer_keys.id DESC")

      return parent_keys + scope
    end

    if params[:id].present?
      scope = scope.where(id: params[:id])
    end

    scope
  end

  def set_key
    @key = DeveloperKey.nondeleted.find(params[:id])
  rescue ActiveRecord::RecordNotFound => e
    report_error(e)
    raise e
  end

  def account_context
    if @key
      return @key.account || Account.site_admin
    elsif params[:account_id]
      require_account_context
      return @context if context_is_domain_root_account?
    end

    # failover to what require_site_admin_with_permission uses
    Account.site_admin
  end

  def context_is_domain_root_account?
    @context == @domain_root_account
  end

  def require_manage_developer_keys
    require_context_with_permission(account_context, :manage_developer_keys)
  rescue ActiveRecord::RecordNotFound => e
    report_error(e)
    raise e
  end

  def read_only_mode?
    account_context.root_account.site_admin? &&
      Account.site_admin.feature_enabled?(:modify_site_admin_developer_keys_permission) &&
      !Account.site_admin.grants_right?(current_principal, :modify_site_admin_developer_keys)
  end

  def require_modify_site_admin_developer_keys
    if read_only_mode?
      respond_to do |format|
        format.html do
          flash[:error] = t("You don't have permission to modify Site Admin developer keys")
          redirect_to account_developer_keys_path(Account.site_admin)
        end
        format.json do
          render json: { errors: [{ message: "You don't have permission to modify Site Admin developer keys" }] },
                 status: :forbidden
        end
      end
    end
  rescue ActiveRecord::RecordNotFound => e
    report_error(e)
    raise e
  end

  def restrict_cross_domain_modifications
    return unless Account.site_admin.feature_enabled?(:developer_key_domain_root_account_restriction)
    return if Rails.env.development?

    key_account = @key ? (@key.account || Account.site_admin) : @context
    return if LoadAccount.from_host(request.host) == key_account

    render json: { errors: [{ message: "Developer keys may only be managed from their account's domain" }] },
           status: :forbidden
  end

  def require_root_account
    raise ActiveRecord::RecordNotFound unless @context.root_account?
  end

  def require_elevated_auth_provider_for_developer_keys?
    AuthenticationMethods::ElevatedAuthProvider.setting_enabled?("require_for_developer_keys")
  end

  def developer_key_params
    params.require(:developer_key).permit(
      :auto_expire_tokens,
      :email,
      :icon_url,
      :name,
      :notes,
      :redirect_uri,
      :redirect_uris,
      :unified_tool_id,
      :vendor_code,
      :visible,
      :test_cluster_only,
      :client_credentials_audience,
      :require_scopes,
      :allow_includes,
      redirect_uris: [],
      scopes: []
    )
  end

  def report_error(exception, code = nil)
    code ||= response_code_for_rescue(exception) if exception
    InstStatsd::Statsd.distributed_increment("canvas.developer_keys_controller.request_error", tags: { action: action_name, code: })
  end
end
