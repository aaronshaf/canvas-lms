# frozen_string_literal: true

#
# Copyright (C) 2011 - present Instructure, Inc.
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

require_relative "../lti_1_3_tool_configuration_spec_helper"

describe DeveloperKeysController do
  let(:test_domain_root_account) { Account.create! }
  let(:site_admin_key) { DeveloperKey.create!(name: "Site Admin Key", visible: false) }
  let(:sub_account) { test_domain_root_account.sub_accounts.create!(parent_account: test_domain_root_account, root_account: test_domain_root_account) }

  let(:root_account_key) do
    DeveloperKey.create!(name: "Root Account Key", account: test_domain_root_account, visible: true)
  end

  let(:error_metric_name) do
    "canvas.developer_keys_controller.request_error"
  end

  before do
    allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?).and_return(false)
  end

  context "Site admin" do
    before do
      account_admin_user(account: Account.site_admin)
      set_domain_root_account(account: Account.site_admin)
    end

    describe "GET 'index'" do
      context "with no session" do
        it "requires authorization" do
          get "/accounts/#{Account.site_admin.id}/developer_keys"
          expect(response).to be_redirect
        end
      end

      context "with a session" do
        let(:expected_id) { json_parse(response.body).first["id"] }

        before do
          user_session(@admin)
        end

        describe "Setting is set" do
          it "sets the scopes to empty" do
            dk = DeveloperKey.create!
            enable_developer_key_account_binding!(dk)
            get "/api/v1/accounts/#{Account.site_admin.id}/developer_keys.json"
            expect(response).to be_successful
            developer_key = json_parse(response.body).first
            expect(developer_key["scopes"]).to eq([])
          end
        end

        it "returns the list of developer keys" do
          dk = DeveloperKey.create!
          get "/api/v1/accounts/#{Account.site_admin.id}/developer_keys.json"
          expect(response).to be_successful
          expect(expected_id).to eq(dk.global_id)
        end

        it "references the API endpoint in the Link (pagination) header" do
          get "/api/v1/accounts/#{Account.site_admin.id}/developer_keys.json"
          route = Rails.application.routes.url_helpers.api_v1_account_developer_keys_path(Account.site_admin)
          expect(response.headers["Link"]).to include(route)
          expect(response.headers["Link"]).to include("http")
        end

        it "does not include non-siteadmin keys" do
          site_admin_key = DeveloperKey.create!
          DeveloperKey.create!(account: Account.default)

          get "/api/v1/accounts/#{Account.site_admin.id}/developer_keys.json"

          expect(json_parse.pluck("id")).to match_array [site_admin_key.global_id]
        end

        it "includes public LTI scopes for that root account (possible feature-flag-gated) in js env" do
          sample_scopes_for_root_account =
            TokenScopes::LTI_SCOPES.except(TokenScopes::LTI_ASSET_REPORT_SCOPE)

          acct_id_from_stub = nil
          expect(TokenScopes).to receive(:public_lti_scopes_hash_for_account) do |acct|
            acct_id_from_stub = acct.id
            sample_scopes_for_root_account
          end

          set_domain_root_account(account: Account.default)
          get "/accounts/#{Account.default.id}/developer_keys"
          expect(acct_id_from_stub).to eq(Account.default.id)

          expect(js_env_from_response(response)["validLtiScopes"]).to \
            eq(sample_scopes_for_root_account)
        end

        describe "js bundles" do
          it "includes developer_keys" do
            get "/accounts/#{Account.site_admin.id}/developer_keys"
            expect(response).to be_successful
          end
        end

        it "does not include deleted keys" do
          dk = DeveloperKey.create!
          dk.destroy
          get "/api/v1/accounts/#{Account.site_admin.id}/developer_keys.json"
          expect(response).to be_successful
          expect(expected_id).not_to eq(dk.global_id)
        end

        it "includes inactive keys" do
          dk = DeveloperKey.create!
          dk.deactivate!
          get "/api/v1/accounts/#{Account.site_admin.id}/developer_keys.json"
          expect(response).to be_successful
          expect(json_parse(response.body).second["id"]).to eq(dk.global_id)
        end

        it "includes the key's 'vendor_code'" do
          DeveloperKey.create!(vendor_code: "test_vendor_code")
          get "/api/v1/accounts/#{Account.site_admin.id}/developer_keys.json"
          expect(json_parse(response.body).first["vendor_code"]).to eq "test_vendor_code"
        end

        it "includes the key's 'visibility'" do
          key = DeveloperKey.create!
          enable_developer_key_account_binding! key
          get "/api/v1/accounts/#{Account.site_admin.id}/developer_keys.json"
          developer_key = json_parse(response.body).first
          expect(developer_key["visible"]).to eq(key.visible)
        end

        context "with developer_key_regenerate_secret feature flag" do
          context "when feature flag is enabled" do
            let(:api_key) { DeveloperKey.create! }

            before do
              Account.site_admin.enable_feature!(:developer_key_regenerate_secret)
            end

            it "masks the api_key in the response" do
              full_key = api_key.api_key

              get "/api/v1/accounts/#{Account.site_admin.id}/developer_keys.json"
              expect(response).to be_successful

              developer_key = json_parse(response.body).find { |k| k["id"] == api_key.global_id }
              expect(developer_key["api_key"]).to eq("#{full_key[0..4]}...")
              expect(developer_key["api_key"]).not_to eq(full_key)
            end
          end

          context "when feature flag is disabled" do
            let(:api_key) { DeveloperKey.create! }

            before do
              Account.site_admin.disable_feature!(:developer_key_regenerate_secret)
            end

            it "includes the full api_key in the response" do
              full_key = api_key.api_key

              get "/api/v1/accounts/#{Account.site_admin.id}/developer_keys.json"
              expect(response).to be_successful

              developer_key = json_parse(response.body).find { |k| k["id"] == api_key.global_id }
              expect(developer_key["api_key"]).to eq(full_key)
            end
          end
        end

        it "includes non-visible keys created in site admin" do
          site_admin_key = DeveloperKey.create!(name: "Site Admin Key", visible: false)
          get "/api/v1/accounts/site_admin/developer_keys.json"
          expect(expected_id).to eq site_admin_key.global_id
        end

        context "with inherited param" do
          before do
            site_admin_key
            root_account_key
          end

          context "on site_admin account" do
            it "returns empty array" do
              get "/api/v1/accounts/site_admin/developer_keys.json", params: { inherited: true }
              developer_keys = json_parse(response.body)
              expect(developer_keys.size).to eq 0
            end
          end

          context "on root account" do
            context "with site_admin key visible" do
              it "returns only the keys from site_admin" do
                dev_key = DeveloperKey.create!(name: "Site Admin Key 2")
                enable_developer_key_account_binding! dev_key
                dev_key.update!(visible: true)
                get "/api/v1/accounts/#{test_domain_root_account.id}/developer_keys.json", params: { inherited: true }
                developer_keys = json_parse(response.body)
                expect(developer_keys.size).to eq 1
                expect(developer_keys.first["name"]).to eq "Site Admin Key 2"
              end
            end

            context "with site_admin key not visible" do
              it "returns empty array" do
                get "/api/v1/accounts/#{test_domain_root_account.id}/developer_keys.json", params: { inherited: true }
                developer_keys = json_parse(response.body)
                expect(developer_keys.size).to eq 0
              end
            end
          end
        end

        context "when request fails" do
          before do
            allow(InstStatsd::Statsd).to receive(:distributed_increment)
          end

          it "reports error metric" do
            get "/api/v1/accounts/#{Account.last.id + 2}/developer_keys.json"
            expect(InstStatsd::Statsd).to have_received(:distributed_increment).with(error_metric_name, tags: { action: "index", code: 404 })
            expect(response).to be_not_found
          end
        end

        describe "api_key secret grace window" do
          let(:flag) { :site_admin_dev_key_secret_grace_window }
          let(:service_user) { user_model }
          let!(:key) { DeveloperKey.create!(name: "SA Key", service_user:) }

          before do
            # Disable the developer_key_regenerate_secret flag to prevent interference
            Account.site_admin.disable_feature!(:developer_key_regenerate_secret)
          end

          it "returns the full api_key when feature flag is disabled" do
            Account.site_admin.disable_feature!(flag) if Account.site_admin.feature_enabled?(flag)
            key.update_column(:created_at, 1.hour.ago)
            get "/api/v1/accounts/#{Account.site_admin.id}/developer_keys.json"
            entry = json_parse(response.body).find { |k| k["id"] == key.global_id }
            expect(entry["api_key"]).to eq key.api_key
            expect(entry).not_to have_key("api_key_truncated")
          end

          context "with the feature flag enabled" do
            before { Account.site_admin.enable_feature!(flag) }

            it "returns the api_key hint for keys older than the grace window" do
              key.update_column(:created_at, 1.hour.ago)
              get "/api/v1/accounts/#{Account.site_admin.id}/developer_keys.json"
              entry = json_parse(response.body).find { |k| k["id"] == key.global_id }
              expect(entry["api_key"]).to eq key.api_key_hint
              expect(entry["api_key_truncated"]).to be true
            end

            it "still returns the full api_key for keys within the grace window" do
              get "/api/v1/accounts/#{Account.site_admin.id}/developer_keys.json"
              entry = json_parse(response.body).find { |k| k["id"] == key.global_id }
              expect(entry["api_key"]).to eq key.api_key
              expect(entry).not_to have_key("api_key_truncated")
            end

            it "returns the full api_key for aged keys without a service user" do
              keyless = DeveloperKey.create!(name: "No Service User Key")
              keyless.update_column(:created_at, 1.hour.ago)
              get "/api/v1/accounts/#{Account.site_admin.id}/developer_keys.json"
              entry = json_parse(response.body).find { |k| k["id"] == keyless.global_id }
              expect(entry["api_key"]).to eq keyless.api_key
              expect(entry).not_to have_key("api_key_truncated")
            end
          end
        end
      end
    end

    describe "POST 'create'" do
      let(:create_params) do
        {
          account_id: Account.site_admin.id,
          developer_key: {
            redirect_uri: "http://example.com/sdf"
          }
        }
      end

      before do
        user_session(@admin)
      end

      it "returns the newly created key" do
        post "/api/v1/accounts/#{Account.site_admin.id}/developer_keys", params: create_params

        json_data = response.parsed_body
        expect(response).to be_successful
        key = DeveloperKey.find(json_data["id"])
        expect(key.account).to be_nil
      end

      it "cannot create keys for a subaccount" do
        post "/api/v1/accounts/#{sub_account.id}/developer_keys", params: create_params.merge(account_id: sub_account.id)
        expect(response).to be_not_found
      end

      it "returns the full api_key on creation even when the secret grace window flag is on" do
        Account.site_admin.enable_feature!(:site_admin_dev_key_secret_grace_window)
        post "/api/v1/accounts/#{Account.site_admin.id}/developer_keys", params: create_params
        json_data = response.parsed_body
        key = DeveloperKey.find(json_data["id"])
        expect(json_data["api_key"]).to eq key.api_key
        expect(json_data).not_to have_key("api_key_truncated")
      end

      context "when request errors" do
        before do
          allow(InstStatsd::Statsd).to receive(:distributed_increment)
        end

        context "when request fails" do
          before do
            # kind of weird trying to find _something_ that could fail during a key creation or serialization
            allow(DeveloperKey).to receive(:test_cluster_checks_enabled?).and_raise(ActiveRecord::StatementInvalid)
          end

          it "reports error metric with code 500" do
            post "/api/v1/accounts/#{Account.site_admin.id}/developer_keys", params: create_params
            expect(InstStatsd::Statsd).to have_received(:distributed_increment).with(error_metric_name, tags: { action: "create", code: 500 })
          end
        end

        context "when key validation fails" do
          let(:create_params) do
            {
              account_id: Account.site_admin.id,
              developer_key: {
                redirect_uri: "http://example.com/sdf",
                scopes: ["bad_scope"]
              }
            }
          end

          it "reports error metric with code 400" do
            post "/api/v1/accounts/#{Account.site_admin.id}/developer_keys", params: create_params
            expect(InstStatsd::Statsd).to have_received(:distributed_increment).with(error_metric_name, tags: { action: "create", code: 400 })
          end
        end
      end

      describe "scopes" do
        let(:valid_scopes) do
          %w[url:POST|/api/v1/courses/:course_id/quizzes/:id/validate_access_code
             url:GET|/api/v1/audit/grade_change/courses/:course_id/assignments/:assignment_id/graders/:grader_id]
        end
        let(:invalid_scopes) { ["url:POST/banana", "url:POST/invalid/scope"] }
        let(:root_account) { account_model }

        before do
          set_domain_root_account(account: root_account)
        end

        it 'allows setting "allow_includes"' do
          post "/api/v1/accounts/#{root_account.id}/developer_keys", params: { developer_key: { scopes: valid_scopes, allow_includes: true } }
          expect(DeveloperKey.find(json_parse["id"]).allow_includes).to be true
        end

        it "allows setting scopes" do
          post "/api/v1/accounts/#{root_account.id}/developer_keys", params: { developer_key: { scopes: valid_scopes } }
          expect(DeveloperKey.find(json_parse["id"]).scopes).to match_array valid_scopes
        end

        it "returns an error if an invalid scope is used" do
          post "/api/v1/accounts/#{root_account.id}/developer_keys", params: { developer_key: { scopes: invalid_scopes } }
          expect(json_parse.dig("errors", "scopes").first["attribute"]).to eq "scopes"
        end

        it "does not create the key if any scopes are invalid" do
          expect do
            post "/api/v1/accounts/#{root_account.id}/developer_keys", params: { developer_key: { scopes: invalid_scopes.concat(valid_scopes) } }
          end.not_to change(DeveloperKey, :count)
        end
      end
    end

    describe "PUT 'update'" do
      let(:dk) { DeveloperKey.create! }

      before do
        user_session(@admin)
      end

      it "deactivates a key" do
        put "/api/v1/developer_keys/#{dk.id}", params: { developer_key: { event: :deactivate }, account_id: Account.site_admin.id }
        expect(response).to be_successful
        expect(dk.reload.state).to eq :inactive
      end

      it "reactivates a key" do
        dk.deactivate!
        put "/api/v1/developer_keys/#{dk.id}", params: { developer_key: { event: :activate }, account_id: Account.site_admin.id }
        expect(response).to be_successful
        expect(dk.reload.state).to eq :active
      end

      context "when request errors" do
        before do
          allow(InstStatsd::Statsd).to receive(:distributed_increment)
        end

        context "when key is not found" do
          it "reports error metric with code 404" do
            put "/api/v1/developer_keys/#{dk.id + 1}", params: { developer_key: { name: "update key" }, account_id: Account.site_admin.id }
            expect(response).to be_not_found
            expect(InstStatsd::Statsd).to have_received(:distributed_increment).with(error_metric_name, tags: { action: "update", code: 404 })
          end
        end

        context "when request fails" do
          before do
            # kind of weird trying to find _something_ that could fail during a key update or serialization
            allow(DeveloperKey).to receive(:test_cluster_checks_enabled?).and_raise(ActiveRecord::StatementInvalid)
          end

          it "reports error metric with code 500" do
            put "/api/v1/developer_keys/#{dk.id}", params: { developer_key: { name: "update key" }, account_id: Account.site_admin.id }
            expect(InstStatsd::Statsd).to have_received(:distributed_increment).with(error_metric_name, tags: { action: "update", code: 500 })
          end
        end

        context "when key validation fails" do
          let(:long_string) { "a" * 5000 }

          it "reports error metric with code 400" do
            put "/api/v1/developer_keys/#{dk.id}", params: { developer_key: { redirect_uris: long_string }, account_id: Account.site_admin.id }
            expect(InstStatsd::Statsd).to have_received(:distributed_increment).with(error_metric_name, tags: { action: "update", code: 400 })
          end
        end
      end

      context "redirect URIs" do
        let(:developer_key) { DeveloperKey.create! }
        let(:valid_uris) { ["https://example.com/callback", "https://another-url.org/redirect"] }

        before do
          user_session(@admin)
        end

        it "allows updating a list of redirect URIs" do
          put "/api/v1/developer_keys/#{developer_key.id}", params: { account_id: Account.site_admin.id, developer_key: { redirect_uris: valid_uris } }
          expect(response).to be_successful
          expect(developer_key.reload.redirect_uris.map(&:redirect_uri)).to match_array(valid_uris)
        end

        it "replaces existing URIs with the new array" do
          developer_key.update!(redirect_uris: ["https://old-uri.com"])
          put "/api/v1/developer_keys/#{developer_key.id}", params: { account_id: Account.site_admin.id, developer_key: { redirect_uris: valid_uris } }
          expect(response).to be_successful
          expect(developer_key.reload.redirect_uris.map(&:redirect_uri)).to match_array(valid_uris)
        end

        it "stores the deprecated redirect_uri as a lenient record alongside the strict redirect_uris" do
          initial_uri = "https://old-uri.com"
          developer_key.update!(redirect_uris: [initial_uri])
          put "/api/v1/developer_keys/#{developer_key.id}", params: { account_id: Account.site_admin.id, developer_key: { redirect_uri: "http://deprecated.com", redirect_uris: valid_uris } }
          expect(response).to be_successful
          records = developer_key.reload.redirect_uris
          expect(records.reject(&:lenient).map(&:redirect_uri)).to match_array(valid_uris)
          expect(records.select(&:lenient).map(&:redirect_uri)).to eq ["http://deprecated.com"]
        end

        it "accepts space-separated string of redirect URIs" do
          space_separated_uris = "https://example.com/callback https://another-url.org/redirect"
          put "/api/v1/developer_keys/#{developer_key.id}", params: { account_id: Account.site_admin.id, developer_key: { redirect_uris: space_separated_uris } }
          expect(response).to be_successful
          expect(developer_key.reload.redirect_uris.map(&:redirect_uri)).to match_array(valid_uris)
        end

        it "accepts newline-separated string of redirect URIs" do
          newline_separated_uris = "https://example.com/callback\nhttps://another-url.org/redirect"
          put "/api/v1/developer_keys/#{developer_key.id}", params: { account_id: Account.site_admin.id, developer_key: { redirect_uris: newline_separated_uris } }
          expect(response).to be_successful
          expect(developer_key.reload.redirect_uris.map(&:redirect_uri)).to match_array(valid_uris)
        end
      end

      describe "scopes" do
        let(:valid_scopes) do
          %w[url:POST|/api/v1/courses/:course_id/quizzes/:id/validate_access_code
             url:GET|/api/v1/audit/grade_change/courses/:course_id/assignments/:assignment_id/graders/:grader_id]
        end
        let(:invalid_scopes) { ["url:POST|/api/v1/banana", "not_a_scope"] }
        let(:root_account) { account_model }
        let(:developer_key) { DeveloperKey.create!(account: root_account) }
        let(:site_admin_key) { DeveloperKey.create! }

        before do
          user_session(@admin)
          set_domain_root_account(account: root_account)
        end

        it 'allows setting "allow_includes"' do
          put "/api/v1/developer_keys/#{developer_key.id}", params: { developer_key: { scopes: valid_scopes, allow_includes: false } }
          expect(developer_key.reload.allow_includes).to be false
        end

        it "allows setting scopes for site admin keys" do
          set_domain_root_account(account: Account.site_admin)
          put "/api/v1/developer_keys/#{site_admin_key.id}", params: { developer_key: { scopes: valid_scopes } }
          expect(site_admin_key.reload.scopes).to match_array valid_scopes
        end

        it "allows setting scopes" do
          put "/api/v1/developer_keys/#{developer_key.id}", params: { developer_key: { scopes: valid_scopes } }
          expect(developer_key.reload.scopes).to match_array valid_scopes
        end

        it "removes invalid scopes and saves valid ones" do
          put "/api/v1/developer_keys/#{developer_key.id}", params: { developer_key: { scopes: invalid_scopes | valid_scopes } }
          expect(developer_key.reload.scopes).to match_array valid_scopes
        end

        it "sets the scopes to empty if the scopes parameter is an empty string" do
          put "/api/v1/developer_keys/#{developer_key.id}", params: { developer_key: { scopes: "" } }
          expect(developer_key.reload.scopes).to be_empty
        end

        it "preserves elevated_operations scopes" do
          elevated_scope = "#{TokenScopes::ELEVATED_OPERATIONS_PREFIX}/foo/bar"
          put "/api/v1/developer_keys/#{developer_key.id}", params: { developer_key: { scopes: valid_scopes + [elevated_scope] } }
          expect(developer_key.reload.scopes).to match_array(valid_scopes + [elevated_scope])
        end

        it "preserves the wildcard elevated_operations scope" do
          elevated_scope = "#{TokenScopes::ELEVATED_OPERATIONS_PREFIX}/all"
          put "/api/v1/developer_keys/#{developer_key.id}", params: { developer_key: { scopes: [elevated_scope] } }
          expect(developer_key.reload.scopes).to eql [elevated_scope]
        end
      end
    end

    describe "DELETE 'destroy'" do
      let(:dk) { DeveloperKey.create! }

      before do
        user_session(@admin)
      end

      it "softs delete a key" do
        delete "/api/v1/developer_keys/#{dk.id}", params: { account_id: Account.site_admin.id }
        expect(response).to be_successful
        expect(dk.reload.state).to eq :deleted
      end

      # These tests might seem odd, but we've run into issues in the past where a destroy call
      # actually returned false, but we still returned a 200 and were left in a weird state.
      # These are regression tests for that.
      context "when the destroy fails" do
        subject { delete "/api/v1/developer_keys/#{dk.id}", params: { account_id: account.id } }

        let_once(:account) { account_model }

        before do
          set_domain_root_account(account:)
          allow_any_instance_of(DeveloperKey).to receive(:destroy).and_return(false)
        end

        it "rolls everything back" do
          subject
          expect(dk.reload).to be_active
        end

        context "when the dev key is associated with a dynamic registration" do
          let(:reg) { dk.ims_registration }
          let(:dk) { dev_key_model_dyn_reg(account: account_model) }

          it "still rolls back properly" do
            subject
            expect(dk.reload).to be_active
            expect(reg.reload).to be_active
            expect(dk.lti_registration).to be_active
          end
        end

        context "when the dev key is associated with a tool configuration" do
          let(:dk) { lti_developer_key_model(account:) }
          let(:registration) { dk.lti_registration }

          it "still rolls back properly" do
            subject
            expect(dk.reload).to be_active
            expect(registration.reload).to be_active
          end
        end
      end

      context "when the key is associated with a tool configuration" do
        include_context "lti_1_3_tool_configuration_spec_helper"

        let(:dk) { lti_registration.developer_key }
        let(:account) { account_model }
        let(:lti_registration) do
          Lti::CreateRegistrationService.call(
            account:,
            created_by: @admin,
            registration_params: {
              name: "Test Registration",
            },
            configuration_params: internal_lti_configuration
          )
        end
        let(:tool_config) { lti_registration.manual_configuration }

        before do
          set_domain_root_account(account:)
        end

        it "soft deletes the tool configuration and the registration" do
          tool_config
          delete "/api/v1/developer_keys/#{dk.id}", params: { account_id: account.id }
          expect(lti_registration.reload).to be_deleted
          expect(tool_config.reload).to be_deleted
        end

        context "tools were installed from that config" do
          let(:tool) { lti_registration.new_external_tool(account) }
          let(:course_tool) { lti_registration.new_external_tool(course) }
          let(:course) { course_model(account:) }

          before do
            tool
          end

          it "deletes the tools in a job" do
            tool_config
            expect { delete "/api/v1/developer_keys/#{dk.id}", params: { account_id: account.id } }
              .to change { lti_registration.reload.workflow_state }.to "deleted"
            expect(tool_config.reload).to be_deleted
            expect(dk.reload).to be_deleted
            run_jobs
            expect(tool.reload).to be_deleted
          end
        end
      end

      context "when the key is associated with a dynamic registration" do
        let(:account) { account_model }
        let(:dk) { dev_key_model_dyn_reg(account:) }
        let(:lti_registration) { dk.lti_registration }
        let(:ims_registration) { dk.ims_registration }

        before do
          set_domain_root_account(account:)
        end

        it "soft deletes the registration" do
          delete "/api/v1/developer_keys/#{dk.id}", params: { account_id: account.id }
          expect(dk.reload).to be_deleted
          expect(lti_registration.reload).to be_deleted
          expect(ims_registration.reload).to be_deleted
        end

        context "tools were installed from the ims registration" do
          let(:tool) { lti_registration.new_external_tool(account) }
          let(:course_tool) { lti_registration.new_external_tool(course) }
          let(:course) { course_model(account:) }

          before do
            tool
            course_tool
          end

          it "deletes the tools in a job" do
            expect { delete "/api/v1/developer_keys/#{dk.id}", params: { account_id: account.id } }
              .to change { lti_registration.reload.workflow_state }.to "deleted"
            expect(ims_registration.reload).to be_deleted
            expect(dk.reload).to be_deleted
            run_jobs
            expect(tool.reload).to be_deleted
            expect(course_tool.reload).to be_deleted
          end
        end
      end

      context "when request errors" do
        before do
          allow(InstStatsd::Statsd).to receive(:distributed_increment)
        end

        context "when key is not found" do
          it "reports error metric with code 404" do
            delete "/api/v1/developer_keys/#{dk.id + 1}", params: { account_id: Account.site_admin.id }
            expect(response).to be_not_found
            expect(InstStatsd::Statsd).to have_received(:distributed_increment).with(error_metric_name, tags: { action: "destroy", code: 404 })
          end
        end

        context "when request fails" do
          before do
            # kind of weird trying to find _something_ that could fail during a key deletion or serialization
            allow(DeveloperKey).to receive(:test_cluster_checks_enabled?).and_raise(ActiveRecord::StatementInvalid)
          end

          it "reports error metric with code 500" do
            delete "/api/v1/developer_keys/#{dk.id}", params: { account_id: Account.site_admin.id }
            expect(InstStatsd::Statsd).to have_received(:distributed_increment).with(error_metric_name, tags: { action: "destroy", code: 500 })
          end
        end
      end
    end

    describe "POST 'regenerate_secret'" do
      let(:root_account) { Account.create! }
      let(:dk) { DeveloperKey.create!(account: root_account) }

      before do
        set_domain_root_account(account: root_account)
        account_admin_user(account: root_account)
        user_session(@admin)
      end

      context "when feature flag is disabled" do
        before do
          root_account.disable_feature!(:developer_key_regenerate_secret)
        end

        it "returns 403 forbidden" do
          post "/api/v1/developer_keys/#{dk.id}/regenerate_secret"
          expect(response).to have_http_status(:forbidden)
          expect(json_parse(response.body)["errors"].first["message"]).to eq("Feature not enabled")
        end
      end

      context "when feature flag is enabled" do
        before do
          root_account.enable_feature!(:developer_key_regenerate_secret)
        end

        it "regenerates the api_key" do
          original_key = dk.api_key

          post "/api/v1/developer_keys/#{dk.id}/regenerate_secret"
          expect(response).to be_successful

          dk.reload
          expect(dk.api_key).not_to eq(original_key)
          expect(dk.api_key).to be_present
        end

        it "returns the full api_key in the response" do
          post "/api/v1/developer_keys/#{dk.id}/regenerate_secret"
          expect(response).to be_successful

          response_key = json_parse(response.body)["api_key"]
          expect(response_key).to eq(dk.reload.api_key)
          expect(response_key).not_to include("...")
        end

        it "expires all existing active tokens for the key" do
          token1 = AccessToken.create!(user: @admin, developer_key: dk, purpose: "token 1")
          token2 = AccessToken.create!(user: @admin, developer_key: dk, purpose: "token 2")

          post "/api/v1/developer_keys/#{dk.id}/regenerate_secret"
          expect(response).to be_successful

          expect(token1.reload).to be_deleted
          expect(token2.reload).to be_deleted
        end

        it "returns 403 forbidden for site admin keys" do
          account_admin_user(account: Account.site_admin)
          user_session(@admin)
          set_domain_root_account(account: Account.site_admin)
          Account.site_admin.enable_feature!(:developer_key_regenerate_secret)
          site_admin_key = DeveloperKey.create!
          post "/api/v1/developer_keys/#{site_admin_key.id}/regenerate_secret"
          expect(response).to have_http_status(:forbidden)
          expect(json_parse(response.body)["errors"].first["message"]).to eq("Cannot regenerate secret for Site Admin keys")
        end

        context "when the key is an LTI key" do
          let(:lti_key) { lti_developer_key_model(account: root_account) }

          it "returns 400 bad request" do
            post "/api/v1/developer_keys/#{lti_key.id}/regenerate_secret"
            expect(response).to have_http_status(:bad_request)
            expect(json_parse(response.body)["errors"].first["message"]).to eq("Cannot regenerate secret for LTI keys")
          end
        end

        context "when the request uses an access token" do
          # In request specs the controller's @access_token is populated by real
          # Bearer-token authentication, which requires the user to have a
          # pseudonym on the domain root account.
          before do
            user_with_pseudonym(user: @admin, account: root_account)
          end

          context "when the token is user-generated (default developer key)" do
            let(:request_token) { AccessToken.create!(user: @admin, developer_key: DeveloperKey.default, purpose: "test token") }

            it "returns 403 forbidden" do
              post "/api/v1/developer_keys/#{dk.id}/regenerate_secret", headers: { "HTTP_AUTHORIZATION" => "Bearer #{request_token.full_token}" }
              expect(response).to have_http_status(:forbidden)
              expect(json_parse(response.body)["errors"].first["message"]).to eq("Cannot regenerate secret using a user-generated access token")
            end
          end

          context "when the token belongs to a different developer key" do
            let(:other_dk) { DeveloperKey.create!(account: root_account, name: "Other Key") }
            let(:request_token) { AccessToken.create!(user: @admin, developer_key: other_dk) }

            before { enable_developer_key_account_binding!(other_dk) }

            it "returns 403 forbidden" do
              post "/api/v1/developer_keys/#{dk.id}/regenerate_secret", headers: { "HTTP_AUTHORIZATION" => "Bearer #{request_token.full_token}" }
              expect(response).to have_http_status(:forbidden)
              expect(json_parse(response.body)["errors"].first["message"]).to include("other than the one associated with this access token")
            end
          end

          context "when the token belongs to the same developer key" do
            let(:request_token) { AccessToken.create!(user: @admin, developer_key: dk, purpose: "test token") }

            before { enable_developer_key_account_binding!(dk) }

            it "successfully regenerates the secret" do
              original_key = dk.api_key
              post "/api/v1/developer_keys/#{dk.id}/regenerate_secret", headers: { "HTTP_AUTHORIZATION" => "Bearer #{request_token.full_token}" }
              expect(response).to be_successful
              dk.reload
              expect(dk.api_key).not_to eq(original_key)
            end
          end
        end

        context "with permission checks" do
          let(:other_account) { Account.create! }
          let(:other_account_key) { DeveloperKey.create!(account: other_account) }
          let(:parent_account_key) { DeveloperKey.create!(account: test_domain_root_account) }

          context "when user lacks manage_developer_keys permission" do
            let(:non_admin_user) { user_model }

            before do
              user_session(non_admin_user)
            end

            it "returns 403 forbidden" do
              post "/api/v1/developer_keys/#{dk.id}/regenerate_secret"
              expect(response).to have_http_status(:forbidden)
            end
          end

          context "when attempting cross-account access" do
            let(:other_account_admin) { account_admin_user(account: other_account) }

            before do
              other_account.enable_feature!(:developer_key_regenerate_secret)
              user_session(other_account_admin)
            end

            it "returns 403 forbidden for site admin keys" do
              post "/api/v1/developer_keys/#{dk.id}/regenerate_secret"
              expect(response).to have_http_status(:forbidden)
            end

            it "returns 403 forbidden for keys from different account" do
              test_domain_root_account.enable_feature!(:developer_key_regenerate_secret)

              post "/api/v1/developer_keys/#{parent_account_key.id}/regenerate_secret"
              expect(response).to have_http_status(:forbidden)
            end
          end

          context "when child account tries to regenerate parent account key" do
            let(:child_account) { test_domain_root_account.sub_accounts.create! }
            let(:child_account_admin) { account_admin_user(account: child_account) }

            before do
              test_domain_root_account.enable_feature!(:developer_key_regenerate_secret)
              user_session(child_account_admin)
            end

            it "returns 403 forbidden" do
              post "/api/v1/developer_keys/#{parent_account_key.id}/regenerate_secret"
              expect(response).to have_http_status(:forbidden)
            end
          end

          context "when account admin regenerates their own account key" do
            let(:account_admin) { account_admin_user(account: test_domain_root_account) }
            let(:account_key) { DeveloperKey.create!(account: test_domain_root_account) }

            before do
              test_domain_root_account.enable_feature!(:developer_key_regenerate_secret)
              user_session(account_admin)
              set_domain_root_account(account: test_domain_root_account)
            end

            it "successfully regenerates the key" do
              original_key = account_key.api_key

              post "/api/v1/developer_keys/#{account_key.id}/regenerate_secret"
              expect(response).to be_successful

              account_key.reload
              expect(account_key.api_key).not_to eql(original_key)
              expect(account_key.api_key).to be_present
            end
          end
        end
      end
    end
  end

  context "Account admin (not site admin)" do
    let(:test_domain_root_account_admin) { account_admin_user(account: test_domain_root_account) }

    before do
      user_session(test_domain_root_account_admin)
      set_domain_root_account(account: test_domain_root_account)
    end

    describe "#index" do
      let(:expected_id) { json_parse(response.body).first["id"] }

      before do
        site_admin_key
        root_account_key
        allow_any_instance_of(Account).to receive(:feature_enabled?).and_return(false)
      end

      it "responds with not found if the account is a subaccount" do
        allow_any_instance_of(DeveloperKeysController).to receive(:require_context_with_permission).and_return(nil)
        get "/accounts/#{sub_account.id}/developer_keys"
        expect(response).to be_not_found
      end

      it "does not include non-visible keys from site admin" do
        get "/api/v1/accounts/#{test_domain_root_account.id}/developer_keys.json"
        expect(expected_id).to eq root_account_key.global_id
      end

      it "does not include visible keys from site admin" do
        site_admin_key.update!(visible: true)
        get "/api/v1/accounts/#{test_domain_root_account.id}/developer_keys.json"
        expect(expected_id).to eq root_account_key.global_id
      end

      it "includes non-visible keys created in the current context" do
        root_account_key.update!(visible: false)
        get "/api/v1/accounts/#{test_domain_root_account.id}/developer_keys.json"
        expect(expected_id).to eq root_account_key.global_id
      end

      context "an overlay exists for one of the keys" do
        let(:developer_key) do
          lti_developer_key_model(account: test_domain_root_account).tap do |developer_key|
            lti_tool_configuration_model(developer_key:, lti_registration: developer_key.lti_registration)
          end
        end
        let(:overlay) do
          Lti::Overlay.create!(account: test_domain_root_account,
                               registration: developer_key.lti_registration,
                               updated_by: user_model,
                               data: {
                                 "placements" => {
                                   "course_navigation" => {
                                     "text" => "some great little text"
                                   }
                                 }
                               })
        end

        it "applies the overlay to the returned configuration" do
          overlay
          get "/api/v1/accounts/#{test_domain_root_account.id}/developer_keys.json"
          result = json_parse.first.dig("tool_configuration", "extensions", 0, "settings", "placements")
          expect(result.find { |p| p["placement"] == "course_navigation" }["text"]).to eq "some great little text"
        end
      end

      context 'with "inherited" parameter' do
        it "does not include account developer keys" do
          root_account_key
          get "/api/v1/accounts/#{test_domain_root_account.id}/developer_keys.json", params: { inherited: true }
          expect(json_parse(response.body)).to be_blank
        end
      end

      context "when lti_deactivate_registrations is enabled" do
        let(:lti_key) { registration.developer_key }
        let(:registration) { lti_registration_with_tool(account: test_domain_root_account) }

        before do
          lti_key
          allow_any_instance_of(Account).to receive(:feature_enabled?)
            .with(:lti_deactivate_registrations)
            .and_return(true)
        end

        it "includes the real binding in developer_key_account_binding" do
          get "/api/v1/accounts/#{test_domain_root_account.id}/developer_keys.json"
          key_json = json_parse.find { |k| k["id"] == lti_key.global_id }
          expect(key_json["developer_key_account_binding"]).to have_key("id")
          expect(key_json["developer_key_account_binding"]).to have_key("account_id")
        end

        it "sets lti_registration_workflow_state to active when the registration is active" do
          get "/api/v1/accounts/#{test_domain_root_account.id}/developer_keys.json"
          key_json = json_parse.find { |k| k["id"] == lti_key.global_id }
          expect(key_json["lti_registration_workflow_state"]).to eq("active")
        end

        it "sets lti_registration_workflow_state to inactive when the registration is inactive" do
          lti_key.lti_registration.deactivate!
          get "/api/v1/accounts/#{test_domain_root_account.id}/developer_keys.json"
          key_json = json_parse.find { |k| k["id"] == lti_key.global_id }
          expect(key_json["lti_registration_workflow_state"]).to eq("inactive")
        end

        it "sets lti_registration_workflow_state to nil when there is no lti_registration" do
          lti_key.update_column(:lti_registration_id, nil)
          get "/api/v1/accounts/#{test_domain_root_account.id}/developer_keys.json"
          key_json = json_parse.find { |k| k["id"] == lti_key.global_id }
          expect(key_json["lti_registration_workflow_state"]).to be_nil
        end

        context "when the key is not an LTI key" do
          let(:non_lti_key) do
            DeveloperKey.create!(account: test_domain_root_account).tap do |key|
              key.account_binding_for(test_domain_root_account).update!(workflow_state: "on")
            end
          end

          before { non_lti_key }

          it "does not include lti_registration_workflow_state" do
            get "/api/v1/accounts/#{test_domain_root_account.id}/developer_keys.json"
            key_json = json_parse.find { |k| k["id"] == non_lti_key.global_id }
            expect(key_json).not_to have_key("lti_registration_workflow_state")
          end
        end
      end

      context "with sharding" do
        specs_require_sharding

        let(:root_account_admin) { root_account_shard.activate { account_admin_user(account: root_account) } }
        let(:site_admin_shard) { Account.site_admin.shard }
        let(:site_admin_key) do
          site_admin_shard.activate do
            key = DeveloperKey.create!
            key.update!(visible: true)
            key
          end
        end
        let(:root_account_shard) { @shard1 }
        let(:root_account) { root_account_shard.activate { account_model } }
        let(:root_account_key) { root_account_shard.activate { DeveloperKey.create!(account: root_account) } }

        before do
          site_admin_key
          root_account_key
        end

        it "includes visible site admin keys from the site admin shard" do
          user_session(root_account_admin)

          root_account_shard.activate do
            get "/api/v1/accounts/#{root_account.id}/developer_keys.json", params: { inherited: true }
          end

          expect(expected_id).to eq site_admin_key.global_id
        end
      end
    end

    it "is allowed to access their dev keys" do
      get "/accounts/#{test_domain_root_account.id}/developer_keys"
      expect(response).to be_successful
    end

    it "An account admin shouldn't be able to access site admin dev keys" do
      user_session(test_domain_root_account_admin)
      get "/accounts/#{Account.site_admin.id}/developer_keys"
      expect(response).to be_redirect
      expect(flash[:error]).to eq "You don't have permission to access that page"
    end

    describe "Should be able to create developer key" do
      include_context "key_storage_helper"

      let(:create_params) do
        {
          account_id: test_domain_root_account.id,
          developer_key: {
            redirect_uri: "http://example.com/sdf",
            name: "test tool"
          }
        }
      end

      it "is allowed to create a dev key" do
        post "/api/v1/accounts/#{test_domain_root_account.id}/developer_keys", params: create_params
        expect(response).to be_successful
      end

      it "is dev keys plus 1 key" do
        post "/api/v1/accounts/#{test_domain_root_account.id}/developer_keys", params: create_params
        expect(test_domain_root_account.developer_keys.count).to be 1
      end
    end

    it "is allowed update a dev key" do
      dk = test_domain_root_account.developer_keys.create!(redirect_uri: "http://asd.com/")
      put "/api/v1/developer_keys/#{dk.id}", params: { developer_key: {
        redirect_uri: "http://example.com/sdf"
      } }
      expect(response).to be_successful
      dk.reload
      expect(dk.redirect_uri).to eq("http://example.com/sdf")
    end

    it "is not allowed access dev keys for a sub account" do
      get "/accounts/#{sub_account.id}/developer_keys"
      expect(response).to be_redirect
      expect(flash[:error]).to eq "You don't have permission to access that page"
    end

    it "is not allowed to create dev keys for a sub account" do
      post "/api/v1/accounts/#{sub_account.id}/developer_keys"
      expect(response).to have_http_status(:forbidden)
    end

    describe "Shouldn't be able to access other accounts" do
      before :once do
        @other_root_account = Account.create!
        @other_sub_account = @other_root_account.sub_accounts.create!(parent_account: @other_root_account, root_account: @other_root_account)
      end

      it "is not allowed access dev keys for a foreign account" do
        get "/accounts/#{@other_root_account.id}/developer_keys"
        expect(response).to be_redirect
        expect(flash[:error]).to eq "You don't have permission to access that page"
      end

      it "is not allowed to create dev keys for a foreign account" do
        post "/api/v1/accounts/#{@other_root_account.id}/developer_keys"
        expect(response).to have_http_status(:forbidden)
      end

      it "is not allowed to update dev keys for a foreign account" do
        dk = @other_root_account.developer_keys.create!
        put "/api/v1/developer_keys/#{dk.id}", params: { account_id: test_domain_root_account_admin.id, developer_key: { event: :deactivate } }
        expect(response).to have_http_status(:forbidden)
      end

      it "is not allowed to update global dev keys" do
        dk = DeveloperKey.create!
        put "/api/v1/developer_keys/#{dk.id}", params: { account_id: test_domain_root_account_admin.id, developer_key: { event: :deactivate } }
        expect(response).to have_http_status(:forbidden)
      end

      it "is not allowed to view foreign accounts dev_key" do
        dk = @other_root_account.developer_keys.create!(redirect_uri: "http://asd.com/")

        put "/api/v1/developer_keys/#{dk.id}"
        expect(response).to have_http_status(:forbidden)
      end
    end

    describe "GET 'lookup_utids'" do
      let(:root_account) { account_model }
      let(:admin_user) { account_admin_user(account: root_account) }
      let(:redirect_uris) { ["https://example.com/redirect", "https://another.com/callback"] }
      let(:api_registrations) do
        [
          {
            unified_tool_id: "550e8400-e29b-41d4-a716-446655440000",
            global_product_id: "e8f9a0b1-c2d3-4567-e890-123456789abc",
            tool_name: "Math Learning Platform",
            tool_id: 789,
            company_id: 456,
            company_name: "Educational Tech Solutions",
            source: "partner_provided"
          },
          {
            unified_tool_id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
            global_product_id: "d7e8f9a0-b1c2-4345-d678-90abcdef1234",
            tool_name: "Science Lab Simulator",
            tool_id: 321,
            company_id: 654,
            company_name: "STEM Education Corp",
            source: "manual"
          }
        ]
      end

      before do
        set_domain_root_account(account: root_account)
        user_session(admin_user)
        allow(LearnPlatform::GlobalApi).to receive(:lookup_api_registrations).and_return(api_registrations)
      end

      it "returns matching UTIDs for given redirect URIs" do
        get "/api/v1/accounts/#{root_account.id}/developer_keys/lookup_utids", params: { redirect_uris: }
        expect(response).to be_successful
        json_response = json_parse(response.body)
        expect(json_response["api_registrations"]).to eq(JSON.parse(api_registrations.to_json))
      end

      it "calls LearnPlatform::GlobalApi.lookup_api_registrations with correct params" do
        expect(LearnPlatform::GlobalApi).to receive(:lookup_api_registrations).with(redirect_uris, sources: nil)
        get "/api/v1/accounts/#{root_account.id}/developer_keys/lookup_utids", params: { redirect_uris: }
      end

      it "passes sources parameter when provided" do
        sources = ["partner_provided", "manual"]
        expect(LearnPlatform::GlobalApi).to receive(:lookup_api_registrations).with(redirect_uris, sources:)
        get "/api/v1/accounts/#{root_account.id}/developer_keys/lookup_utids", params: { redirect_uris:, sources: }
      end

      it "handles errors gracefully" do
        allow(LearnPlatform::GlobalApi).to receive(:lookup_api_registrations).and_raise(StandardError, "API error")
        get "/api/v1/accounts/#{root_account.id}/developer_keys/lookup_utids", params: { redirect_uris: }
        expect(response).to have_http_status(:bad_request)
        json_response = json_parse(response.body)
        expect(json_response["error"]).to eq("Failed to match redirect URIs")
      end

      context "without proper permissions" do
        it "requires authorization" do
          user_model
          user_session(@user)
          get "/api/v1/accounts/#{root_account.id}/developer_keys/lookup_utids", params: { redirect_uris: }
          expect(response).to be_forbidden
        end
      end

      context "when redirect_uris is missing" do
        it "returns bad request" do
          get "/api/v1/accounts/#{root_account.id}/developer_keys/lookup_utids"
          expect(response).to have_http_status(:bad_request)
        end
      end
    end

    describe "modify_site_admin_developer_keys permission" do
      let(:site_admin_admin) { account_admin_user(account: Account.site_admin) }
      let(:site_admin_without_permission) do
        user = user_model
        role = custom_account_role("limited_admin", account: Account.site_admin)
        # Grant manage_developer_keys but not modify_site_admin_developer_keys
        Account.site_admin.role_overrides.create!(
          permission: :manage_developer_keys,
          role:,
          enabled: true
        )
        Account.site_admin.account_users.create!(user:, role:)
        user
      end

      describe "POST 'create'" do
        let(:create_params) do
          {
            account_id: Account.site_admin.id,
            developer_key: {
              name: "Test Key",
              redirect_uri: "http://example.com/redirect"
            }
          }
        end

        context "when user has modify_site_admin_developer_keys permission" do
          before do
            user_session(site_admin_admin)
            set_domain_root_account(account: Account.site_admin)
          end

          it "allows creating a site admin developer key" do
            post "/api/v1/accounts/#{Account.site_admin.id}/developer_keys", params: create_params
            expect(response).to be_successful
            key = DeveloperKey.find(json_parse(response.body)["id"])
            expect(key.account).to be_nil
          end
        end

        context "when user lacks modify_site_admin_developer_keys permission" do
          before do
            user_session(site_admin_without_permission)
            set_domain_root_account(account: Account.site_admin)
          end

          it "returns forbidden" do
            post "/api/v1/accounts/#{Account.site_admin.id}/developer_keys", params: create_params
            expect(response).to be_forbidden
            expect(json_parse(response.body)["errors"].first["message"]).to include("Site Admin developer keys")
          end
        end
      end

      describe "PUT 'update'" do
        let(:site_admin_key) { DeveloperKey.create!(name: "Site Admin Key") }

        context "when user has modify_site_admin_developer_keys permission" do
          before do
            user_session(site_admin_admin)
            set_domain_root_account(account: Account.site_admin)
          end

          it "allows updating a site admin developer key" do
            put "/api/v1/developer_keys/#{site_admin_key.id}", params: { developer_key: { name: "Updated Name" }, account_id: Account.site_admin.id }
            expect(response).to be_successful
            expect(site_admin_key.reload.name).to eq("Updated Name")
          end
        end

        context "when user lacks modify_site_admin_developer_keys permission" do
          before { user_session(site_admin_without_permission) }

          it "returns forbidden" do
            put "/api/v1/developer_keys/#{site_admin_key.id}", params: { developer_key: { name: "Updated Name" }, account_id: Account.site_admin.id }
            expect(response).to be_forbidden
            expect(json_parse(response.body)["errors"].first["message"]).to include("Site Admin developer keys")
          end
        end
      end

      describe "DELETE 'destroy'" do
        let(:site_admin_key) { DeveloperKey.create!(name: "Site Admin Key") }

        context "when user has modify_site_admin_developer_keys permission" do
          before do
            user_session(site_admin_admin)
            set_domain_root_account(account: Account.site_admin)
          end

          it "allows deleting a site admin developer key" do
            delete "/api/v1/developer_keys/#{site_admin_key.id}", params: { account_id: Account.site_admin.id }
            expect(response).to be_successful
            expect(site_admin_key.reload.state).to eq(:deleted)
          end
        end

        context "when user lacks modify_site_admin_developer_keys permission" do
          before do
            user_session(site_admin_without_permission)
            set_domain_root_account(account: Account.site_admin)
          end

          it "returns forbidden" do
            delete "/api/v1/developer_keys/#{site_admin_key.id}", params: { account_id: Account.site_admin.id }
            expect(response).to be_forbidden
            expect(json_parse(response.body)["errors"].first["message"]).to include("Site Admin developer keys")
          end
        end
      end

      describe "account-level developer keys" do
        let(:root_account) { account_model }
        let(:account_key) { DeveloperKey.create!(name: "Account Key", account: root_account) }
        let(:account_admin) do
          user = user_model
          role = custom_account_role("limited_admin", account: root_account)
          root_account.role_overrides.create!(
            permission: :manage_developer_keys,
            role:,
            enabled: true
          )
          root_account.account_users.create!(user:, role:)
          user
        end

        before do
          user_session(account_admin)
          set_domain_root_account(account: root_account)
        end

        it "does not require modify_site_admin_developer_keys for account-level keys" do
          put "/api/v1/developer_keys/#{account_key.id}", params: { developer_key: { name: "Updated" }, account_id: root_account.id }
          expect(response).to be_successful
        end
      end
    end
  end

  describe "developer_key_domain_root_account_restriction feature flag" do
    let(:site_admin_key) { DeveloperKey.create!(name: "Site Admin Key") }
    let(:root_account) { Account.create! }
    let(:account_key) { DeveloperKey.create!(name: "Account Key", account: root_account) }
    let(:site_admin_admin) { account_admin_user(account: Account.site_admin) }

    context "when flag is disabled" do
      before do
        Account.site_admin.disable_feature!(:developer_key_domain_root_account_restriction)
        user_session(site_admin_admin)
        set_domain_root_account(account: Account.site_admin)
        set_domain_root_account(account: root_account)
      end

      it "allows updating a site admin key from a non-site-admin domain" do
        put "/api/v1/developer_keys/#{site_admin_key.id}", params: { developer_key: { name: "Updated" }, account_id: Account.site_admin.id }
        expect(response).to be_successful
      end
    end

    context "when in development mode" do
      before do
        allow(Rails.env).to receive(:development?).and_return(true)
        user_session(site_admin_admin)
        set_domain_root_account(account: Account.site_admin)
        set_domain_root_account(account: root_account)
      end

      it "allows updating a site admin key from a non-site-admin domain" do
        put "/api/v1/developer_keys/#{site_admin_key.id}", params: { developer_key: { name: "Updated" }, account_id: Account.site_admin.id }
        expect(response).to be_successful
      end
    end

    context "when domain does not match key's root account" do
      before do
        user_session(site_admin_admin)
        set_domain_root_account(account: Account.site_admin)
        allow(LoadAccount).to receive(:from_host).and_return(root_account)
      end

      it "returns forbidden when updating a site admin key" do
        put "/api/v1/developer_keys/#{site_admin_key.id}", params: { developer_key: { name: "Updated" }, account_id: Account.site_admin.id }
        expect(response).to be_forbidden
        expect(json_parse(response.body)["errors"].first["message"]).to include("account's domain")
      end

      it "returns forbidden when deleting a site admin key" do
        delete "/api/v1/developer_keys/#{site_admin_key.id}"
        expect(response).to be_forbidden
      end

      it "returns forbidden when creating a site admin key" do
        post "/api/v1/accounts/#{Account.site_admin.id}/developer_keys", params: { developer_key: { name: "New Key" } }
        expect(response).to be_forbidden
      end

      it "allows updating a key that belongs to the current domain" do
        set_domain_root_account(account: root_account)
        account_admin_user(account: root_account)
        user_session(@admin)
        put "/api/v1/developer_keys/#{account_key.id}", params: { developer_key: { name: "Updated" }, account_id: root_account.id }
        expect(response).to be_successful
      end

      it "returns forbidden when updating a key from a different root account domain" do
        other_account = Account.create!
        other_key = DeveloperKey.create!(account: other_account)
        set_domain_root_account(account: other_account)
        allow(LoadAccount).to receive(:from_host).and_return(root_account)
        put "/api/v1/developer_keys/#{other_key.id}", params: { developer_key: { name: "Updated" }, account_id: other_account.id }
        expect(response).to be_forbidden
      end
    end
  end

  describe "elevated auth provider enforcement" do
    let(:account) { Account.site_admin }
    let!(:elevated_provider) { account.authentication_providers.create!(auth_type: "saml") }
    let(:dk) { DeveloperKey.create! }
    let(:enforce_flag_enabled) { true }
    let(:developer_keys_flag_enabled) { true }

    before do
      account_admin_user(account:)
      user_with_pseudonym(user: @admin, account:)
      user_session(@admin, @pseudonym)
      set_domain_root_account(account:)

      AuthenticationMethods::PseudonymAttributes.reset

      allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?).and_return(false)
      allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?)
        .with("enforce_violations").and_return(enforce_flag_enabled)
      allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?)
        .with("require_for_developer_keys").and_return(developer_keys_flag_enabled)
    end

    context "when an elevated provider is configured" do
      before do
        account.settings[:elevated_auth_provider_global_id] = elevated_provider.global_id
        account.save(validate: false)
      end

      context "and the session uses the elevated provider" do
        # A real request reloads PseudonymAttributes from session["login_aac"],
        # which the stubbed test session does not set, so stub the auth provider
        # the elevated check resolves.
        before { allow(AuthenticationMethods::PseudonymAttributes).to receive(:load_auth_provider).and_return(elevated_provider) }

        it "allows index" do
          get "/api/v1/accounts/#{account.id}/developer_keys.json"
          expect(response).to be_successful
        end

        it "allows create" do
          post "/api/v1/accounts/#{account.id}/developer_keys", params: { developer_key: { redirect_uri: "http://example.com/sdf" } }
          expect(response).to be_successful
        end

        it "allows update" do
          put "/api/v1/developer_keys/#{dk.id}", params: { developer_key: { event: :deactivate }, account_id: account.id }
          expect(response).to be_successful
        end

        it "allows destroy" do
          delete "/api/v1/developer_keys/#{dk.id}", params: { account_id: account.id }
          expect(response).to be_successful
        end
      end

      context "and the session does not use the elevated provider" do
        it "blocks index json with 401" do
          get "/api/v1/accounts/#{account.id}/developer_keys.json"
          expect(response).to have_http_status(:forbidden)
        end

        it "redirects index html with a flash error" do
          get "/accounts/#{account.id}/developer_keys"
          expect(response).to be_redirect
          expect(flash[:error][:html]).to include("requires using an elevated authentication provider")
        end

        it "blocks create" do
          post "/api/v1/accounts/#{account.id}/developer_keys", params: { developer_key: { redirect_uri: "http://example.com/sdf" } }
          expect(response).to have_http_status(:forbidden)
        end

        it "blocks update" do
          put "/api/v1/developer_keys/#{dk.id}", params: { developer_key: { event: :deactivate }, account_id: account.id }
          expect(response).to have_http_status(:forbidden)
        end

        it "blocks destroy" do
          delete "/api/v1/developer_keys/#{dk.id}", params: { account_id: account.id }
          expect(response).to have_http_status(:forbidden)
        end

        context "but the enforce_violations flag is off" do
          let(:enforce_flag_enabled) { false }

          it "allows the request through" do
            get "/api/v1/accounts/#{account.id}/developer_keys.json"
            expect(response).to be_successful
          end
        end

        context "but the require_for_developer_keys flag is off" do
          let(:developer_keys_flag_enabled) { false }

          it "allows the request through" do
            get "/api/v1/accounts/#{account.id}/developer_keys.json"
            expect(response).to be_successful
          end
        end

        it "does not gate lookup_utids" do
          allow(LearnPlatform::GlobalApi).to receive(:lookup_api_registrations).and_return([])
          get "/api/v1/accounts/#{account.id}/developer_keys/lookup_utids", params: { redirect_uris: ["https://example.com/cb"] }
          expect(response).to be_successful
        end
      end
    end

    context "when no elevated provider is configured" do
      it "allows the request" do
        get "/api/v1/accounts/#{account.id}/developer_keys.json"
        expect(response).to be_successful
      end
    end
  end
end
