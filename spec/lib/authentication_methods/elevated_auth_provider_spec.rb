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

describe AuthenticationMethods::ElevatedAuthProvider, type: :controller do
  controller(ApplicationController) do
    skip_before_action :require_user
    before_action :require_elevated_auth_provider

    def index
      respond_to do |format|
        format.html { render plain: "ok" }
        format.json { render json: { status: "ok" } }
      end
    end
  end

  let(:account) { Account.default }
  let!(:auth_provider) { account.authentication_providers.create!(auth_type: "saml") }
  let(:current_user) { user_with_pseudonym(active_all: true, account:) }
  let(:current_pseudonym) { current_user.pseudonyms.first }

  before do
    AuthenticationMethods::PseudonymAttributes.reset
    AuthenticationMethods::AccessTokenAttributes.reset
    allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?).and_return(false)
    allow(InstStatsd::Statsd).to receive(:distributed_increment).and_call_original
    allow(InstStatsd::Statsd).to receive(:event).and_call_original
  end

  shared_examples "allows the action through" do
    it "renders the html action" do
      get :index, format: :html
      expect(response).to have_http_status(:ok)
      expect(response.body).to eql "ok"
    end

    it "renders the json action" do
      get :index, format: :json
      expect(response).to have_http_status(:ok)
      expect(json_parse).to eql({ "status" => "ok" })
    end
  end

  describe "#require_elevated_auth_provider before_action" do
    context "when there is no current pseudonym" do
      it_behaves_like "allows the action through"

      it "emits the no_pseudonym_account statsd increment" do
        get :index
        expect(InstStatsd::Statsd).to have_received(:distributed_increment).with(
          "elevated_auth_provider.no_pseudonym_account",
          hash_including(:tags)
        )
      end
    end

    context "with a logged-in user" do
      before { user_session(current_user, current_pseudonym) }

      context "when the account does not require elevation" do
        it_behaves_like "allows the action through"

        it "does not emit a violation event" do
          get :index
          expect(InstStatsd::Statsd).not_to have_received(:event)
        end
      end

      context "when the account requires elevation" do
        before do
          account.settings[:elevated_auth_provider_global_id] = auth_provider.global_id
          account.save(validate: false)
        end

        context "and the session auth provider matches" do
          before do
            AuthenticationMethods::PseudonymAttributes.auth_provider_id = auth_provider.id
          end

          it_behaves_like "allows the action through"

          it "does not emit a violation event" do
            get :index
            expect(InstStatsd::Statsd).not_to have_received(:event)
          end
        end

        context "and the session auth provider does not match" do
          let!(:other_provider) { account.authentication_providers.create!(auth_type: "cas") }

          before do
            AuthenticationMethods::PseudonymAttributes.auth_provider_id = other_provider.id
          end

          context "with both rollout switches off" do
            it_behaves_like "allows the action through"

            it "does not emit a violation event" do
              get :index
              expect(InstStatsd::Statsd).not_to have_received(:event)
            end
          end

          context "with log_violations on" do
            before do
              allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?)
                .with("log_violations").and_return(true)
            end

            it_behaves_like "allows the action through"

            it "emits the violation event" do
              get :index
              expect(InstStatsd::Statsd).to have_received(:event).with(
                "Elevated Auth Provider Violation",
                satisfy { |msg|
                  msg.include?("A GET request to") &&
                    msg.include?("request_id:") &&
                    msg.include?("user '#{current_user.global_id}'")
                },
                hash_including(type: :elevated_auth_provider_violation, alert_type: :error)
              )
            end
          end

          context "with enforce_violations on" do
            before do
              allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?)
                .with("enforce_violations").and_return(true)
            end

            it "redirects html requests to root_url with a flash error" do
              get :index, format: :html
              expect(response).to redirect_to(root_url)
              expect(flash[:error][:html]).to include("requires using an elevated authentication provider")
              expect(flash[:error][:timeout]).to eq 60_000
            end

            it "responds 403 unauthorized for json requests" do
              get :index, format: :json
              expect(response).to have_http_status(:forbidden)
              expect(json_parse["status"]).to eql "unauthorized"
              expect(json_parse["errors"].first["message"]).to be_present
            end

            it "responds 403 unauthorized for unknown formats" do
              get :index, format: :xml
              expect(response).to have_http_status(:forbidden)
              expect(json_parse["status"]).to eql "unauthorized"
            end

            context "without @current_user" do
              before do
                @controller.singleton_class.prepend(Module.new do
                  def handle_no_elevated_auth_provider(pseudonym_account)
                    @current_user = nil
                    super
                  end
                end)
              end

              it "redirects html requests to login" do
                get :index, format: :html
                expect(response).to redirect_to(login_url)
              end

              it "responds 401 unauthenticated for json requests" do
                get :index, format: :json
                expect(response).to have_http_status(:unauthorized)
                expect(json_parse["status"]).to eql "unauthenticated"
              end
            end
          end
        end

        context "and there is no auth provider in the session" do
          before do
            allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?)
              .with("enforce_violations").and_return(true)
          end

          it "redirects html requests to root_url" do
            get :index, format: :html
            expect(response).to redirect_to(root_url)
          end

          it "responds 403 unauthorized for json requests" do
            get :index, format: :json
            expect(response).to have_http_status(:forbidden)
            expect(json_parse["status"]).to eql "unauthorized"
          end
        end

        context "with a developer key bypass" do
          let(:scopes) { ["#{TokenScopes::ELEVATED_OPERATIONS_PREFIX}/anonymous/index"] }
          let(:developer_key) { DeveloperKey.create!(name: "key", scopes:) }

          before do
            allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?)
              .with("enforce_violations").and_return(true)
            AuthenticationMethods::AccessTokenAttributes.current_developer_key = developer_key
          end

          context "when the key permits the controller/action" do
            it_behaves_like "allows the action through"

            it "does not emit a violation event" do
              get :index
              expect(InstStatsd::Statsd).not_to have_received(:event)
            end

            context "and log_violations is on" do
              before do
                allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?)
                  .with("log_violations").and_return(true)
              end

              it_behaves_like "allows the action through"

              it "does not emit a violation event" do
                get :index
                expect(InstStatsd::Statsd).not_to have_received(:event)
              end
            end
          end

          context "when the key has the wildcard /all scope" do
            let(:scopes) { ["#{TokenScopes::ELEVATED_OPERATIONS_PREFIX}/all"] }

            it_behaves_like "allows the action through"
          end

          context "when the key's scope does not match the controller/action" do
            let(:scopes) { ["#{TokenScopes::ELEVATED_OPERATIONS_PREFIX}/other/action"] }

            it "redirects html requests to root_url" do
              get :index, format: :html
              expect(response).to redirect_to(root_url)
            end

            it "responds 403 unauthorized for json requests" do
              get :index, format: :json
              expect(response).to have_http_status(:forbidden)
              expect(json_parse["status"]).to eql "unauthorized"
            end
          end

          context "when the key is not a client_credentials grant" do
            let(:developer_key) { DeveloperKey.create!(name: "key", scopes:) }

            it_behaves_like "allows the action through"
          end

          context "when require_client_credentials is enabled" do
            before do
              allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?)
                .with("require_client_credentials").and_return(true)
            end

            context "and the current token is an InstAccess::Token" do
              let(:developer_key) do
                DeveloperKey.create!(
                  name: "key",
                  scopes:,
                  authorized_flows: ["service_user_client_credentials"],
                  service_user: current_user
                )
              end

              before do
                AuthenticationMethods::AccessTokenAttributes.current_token =
                  InstAccess::Token.for_user(user_uuid: "fake-user-uuid", account_uuid: "fake-acct-uuid")
              end

              it_behaves_like "allows the action through"

              it "does not emit a violation event" do
                get :index
                expect(InstStatsd::Statsd).not_to have_received(:event)
              end
            end

            context "and the current token is not an InstAccess::Token" do
              before do
                AuthenticationMethods::AccessTokenAttributes.current_token = AccessToken.new
              end

              it "redirects html requests to root_url" do
                get :index, format: :html
                expect(response).to redirect_to(root_url)
              end

              it "responds 403 unauthorized for json requests" do
                get :index, format: :json
                expect(response).to have_http_status(:forbidden)
                expect(json_parse["status"]).to eql "unauthorized"
              end
            end

            context "and there is no current token" do
              it "redirects html requests to root_url" do
                get :index, format: :html
                expect(response).to redirect_to(root_url)
              end

              it "responds 403 unauthorized for json requests" do
                get :index, format: :json
                expect(response).to have_http_status(:forbidden)
                expect(json_parse["status"]).to eql "unauthorized"
              end
            end
          end
        end
      end
    end
  end
end
