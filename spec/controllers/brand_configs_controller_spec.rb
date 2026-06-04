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

require_relative "../feature_flag_helper"

describe BrandConfigsController do
  include FeatureFlagHelper

  before :once do
    @account = Account.default
    @bc = BrandConfig.create(variables: { "ic-brand-primary" => "#321" })
  end

  describe "#index" do
    it "allows authorized admin to view" do
      admin = account_admin_user(account: @account)
      user_session(admin)
      get "index", params: { account_id: @account.id }
      assert_status(200)
    end

    it "does not allow non admin access" do
      user = user_with_pseudonym(active_all: true)
      user_session(user)
      get "index", params: { account_id: @account.id }
      assert_status(401)
    end

    it "requires branding enabled on the account" do
      subaccount = @account.sub_accounts.create!(name: "sub")
      admin = account_admin_user(account: @account)
      user_session(admin)
      get "index", params: { account_id: subaccount.id }
      assert_status(302)
      expect(flash[:error]).to match(/cannot edit themes/)
    end
  end

  describe "#new" do
    it "allows authorized admin to see create" do
      admin = account_admin_user(account: @account)
      user_session(admin)
      get "new", params: { brand_config: @bc, account_id: @account.id }
      assert_status(200)
    end

    it "does not allow non admin access" do
      user = user_with_pseudonym(active_all: true)
      user_session(user)
      get "new", params: { brand_config: @bc, account_id: @account.id }
      assert_status(401)
    end

    it "creates variableSchema based on parent configs" do
      @account.brand_config_md5 = @bc.md5
      @account.settings = { global_includes: true, sub_account_includes: true }
      @account.save!

      @subaccount = Account.create!(parent_account: @account)
      @sub_bc = BrandConfig.create(variables: { "ic-brand-global-nav-bgd" => "#123" }, parent_md5: @bc.md5)
      @subaccount.brand_config_md5 = @sub_bc.md5
      @subaccount.save!

      admin = account_admin_user(account: @subaccount)
      user_session(admin)

      get "new", params: { brand_config: @sub_bc, account_id: @subaccount.id }

      variable_schema = assigns[:js_env][:variableSchema]
      variable_schema.each do |s|
        expect(s["group_name"]).to be_present
      end

      vars = variable_schema.pluck("variables").flatten
      vars.each do |v|
        expect(v["human_name"]).to be_present
      end

      expect(vars.detect { |v| v["variable_name"] == "ic-brand-header-image" }["helper_text"]).to be_present

      primary = vars.detect { |v| v["variable_name"] == "ic-brand-primary" }
      expect(primary["default"]).to eq "#321"
    end

    context "with login brand config filter" do
      let_once(:admin) { account_admin_user(account: @account) }

      before do
        user_session(admin)
      end

      it "always calls the login brand config filter with variable schema and account" do
        expect(Login::LoginBrandConfigFilter).to receive(:filter).with(instance_of(Array), @account).and_call_original
        get "new", params: { brand_config: @bc, account_id: @account.id }
        assert_status(200)
      end

      it "filter handles feature flag logic internally" do
        mock_feature_flag(:login_registration_ui_identity, false, [@account])
        expect(Login::LoginBrandConfigFilter).to receive(:filter).with(instance_of(Array), @account).and_call_original
        get "new", params: { brand_config: @bc, account_id: @account.id }
        assert_status(200)
      end
    end
  end

  describe "#create" do
    let_once(:admin) { account_admin_user(account: @account) }
    let(:bcin) { { variables: { "ic-brand-primary" => "#000000" } } }

    it "allows authorized admin to create" do
      user_session(admin)
      post "create", params: { account_id: @account.id, brand_config: bcin }
      assert_status(200)
      json = response.parsed_body
      expect(json["brand_config"]["variables"]["ic-brand-primary"]).to eq "#000000"
    end

    it "does not fail when a brand_config is not passed" do
      user_session(admin)
      post "create", params: { account_id: @account.id }
      assert_status(200)
    end

    it "does not allow non admin access" do
      user = user_with_pseudonym(active_all: true)
      user_session(user)
      post "create", params: { account_id: @account.id, brand_config: bcin }
      assert_status(401)
    end

    it "returns an existing brand config" do
      user_session(admin)
      post "create", params: { account_id: @account.id,
                               brand_config: {
                                 variables: {
                                   "ic-brand-primary" => "#321"
                                 }
                               } }
      assert_status(200)
      json = response.parsed_body
      expect(json["brand_config"]["md5"]).to eq @bc.md5
    end

    it "uploads a js file successfully" do
      user_session(admin)
      tf = Tempfile.new("test.js")
      tf.write("test")
      uf = ActionDispatch::Http::UploadedFile.new(tempfile: tf, filename: "test.js")
      request.headers["CONTENT_TYPE"] = "multipart/form-data"
      expect_any_instance_of(Attachment).to receive(:save_to_storage).and_return(true)

      post "create", params: { account_id: @account.id, brand_config: bcin, js_overrides: uf }
      assert_status(200)

      json = response.parsed_body
      expect(json["brand_config"]["js_overrides"]).to be_present
    end

    context "override URL processing" do
      before { user_session(admin) }

      %i[js_overrides css_overrides mobile_js_overrides mobile_css_overrides].each do |override|
        context override.to_s do
          # merge avoids mixing new-style and hash-rocket keys in the same literal
          def override_params(override, url)
            { account_id: @account.id, brand_config: bcin }.merge(override => url)
          end

          it "accepts a valid https:// URL" do
            post "create", params: override_params(override, "https://cdn.example.com/app.js")
            expect(response).to have_http_status(:ok)
          end

          it "accepts a valid http:// URL" do
            post "create", params: override_params(override, "http://cdn.example.com/app.js")
            expect(response).to have_http_status(:ok)
          end

          it "accepts a root-relative URL" do
            post "create", params: override_params(override, "/assets/app.js")
            expect(response).to have_http_status(:ok)
          end

          it "rejects javascript: scheme" do
            post "create", params: override_params(override, "javascript:alert(1)")
            expect(response).to have_http_status(:bad_request)
          end

          it "rejects data: scheme" do
            post "create", params: override_params(override, "data:text/html,<script>alert(1)</script>")
            expect(response).to have_http_status(:bad_request)
          end

          it "rejects a URL with a double-quote" do
            post "create", params: override_params(override, 'https://example.com/app.js?x="1"')
            expect(response).to have_http_status(:bad_request)
          end

          it "rejects a URL with a single-quote" do
            post "create", params: override_params(override, "https://example.com/app.js?x='1'")
            expect(response).to have_http_status(:bad_request)
          end

          it "rejects a URL with angle brackets" do
            post "create", params: override_params(override, "https://example.com/<script>")
            expect(response).to have_http_status(:bad_request)
          end

          it "rejects a URL with parentheses" do
            post "create", params: override_params(override, "https://example.com/url(x)")
            expect(response).to have_http_status(:bad_request)
          end

          it "rejects a URL with a backslash" do
            post "create", params: override_params(override, "https://example.com/path\\file")
            expect(response).to have_http_status(:bad_request)
          end

          it "rejects a URL with a control character" do
            post "create", params: override_params(override, "https://example.com/path\x00end")
            expect(response).to have_http_status(:bad_request)
          end

          it "rejects a URL exceeding 2048 characters" do
            post "create", params: override_params(override, "https://example.com/#{"a" * 2040}")
            expect(response).to have_http_status(:bad_request)
          end

          it "accepts a URL at exactly 2048 characters" do
            url = "https://example.com/" + ("a" * (2048 - "https://example.com/".length))
            post "create", params: override_params(override, url)
            expect(response).to have_http_status(:ok)
          end
        end
      end

      it "does not affect the UploadedFile branch" do
        tf = Tempfile.new("test.js")
        tf.write("test")
        uf = ActionDispatch::Http::UploadedFile.new(tempfile: tf, filename: "test.js")
        request.headers["CONTENT_TYPE"] = "multipart/form-data"
        expect_any_instance_of(Attachment).to receive(:save_to_storage).and_return(true)
        post "create", params: { account_id: @account.id, brand_config: bcin, js_overrides: uf }
        expect(response).to have_http_status(:ok)
      end
    end

    context "textarea variable processing" do
      it "sanitizes XSS attempts in textarea values" do
        user_session(admin)
        post "create", params: {
          account_id: @account.id,
          brand_config: {
            variables: {
              "ic-brand-Login-custom-message" => "<script>alert('xss')</script>Hello"
            }
          }
        }
        json = response.parsed_body
        expect(json["brand_config"]["variables"]["ic-brand-Login-custom-message"]).to eq("Hello")
      end

      it "sanitizes event handlers in textarea values" do
        user_session(admin)
        post "create", params: {
          account_id: @account.id,
          brand_config: {
            variables: {
              "ic-brand-Login-custom-message" => "<img src=x onerror=\"alert(1)\">"
            }
          }
        }
        json = response.parsed_body
        expect(json["brand_config"]["variables"]["ic-brand-Login-custom-message"]).not_to include("<img")
        expect(json["brand_config"]["variables"]["ic-brand-Login-custom-message"]).not_to include("onerror")
      end

      it "rejects textarea values exceeding 500 characters" do
        user_session(admin)
        long_text = "a" * 501
        post "create", params: {
          account_id: @account.id,
          brand_config: {
            variables: {
              "ic-brand-Login-custom-message" => long_text
            }
          }
        }
        expect(response).to have_http_status(:bad_request)
      end

      it "rejects textarea values with control characters" do
        user_session(admin)
        post "create", params: {
          account_id: @account.id,
          brand_config: {
            variables: {
              "ic-brand-Login-custom-message" => "test\x00value"
            }
          }
        }
        expect(response).to have_http_status(:bad_request)
      end

      it "preserves legitimate textarea content" do
        user_session(admin)
        text = "Welcome to our login page!\nPlease sign in."
        post "create", params: {
          account_id: @account.id,
          brand_config: {
            variables: {
              "ic-brand-Login-custom-message" => text
            }
          }
        }
        json = response.parsed_body
        expect(json["brand_config"]["variables"]["ic-brand-Login-custom-message"]).to eq(text)
      end

      it "accepts textarea values at exactly 500 characters" do
        user_session(admin)
        exact_text = "a" * 500
        post "create", params: {
          account_id: @account.id,
          brand_config: {
            variables: {
              "ic-brand-Login-custom-message" => exact_text
            }
          }
        }
        json = response.parsed_body
        expect(json["brand_config"]["variables"]["ic-brand-Login-custom-message"].length).to eq(500)
        expect(json["brand_config"]["variables"]["ic-brand-Login-custom-message"]).to eq(exact_text)
      end

      it "rejects other control characters in the range" do
        user_session(admin)
        # test various control characters: \x01, \x08, \x0B (vertical tab), \x0C (form feed), \x0E-\x1F, \x7F (DEL)
        ["\x01", "\x08", "\x0B", "\x0C", "\x0E", "\x1F", "\x7F"].each do |control_char|
          post "create", params: {
            account_id: @account.id,
            brand_config: {
              variables: {
                "ic-brand-Login-custom-message" => "test#{control_char}value"
              }
            }
          }
          expect(response).to have_http_status(:bad_request)
        end
      end

      it "preserves tabs in textarea content" do
        user_session(admin)
        text = "Line 1\tTabbed\tText"
        post "create", params: {
          account_id: @account.id,
          brand_config: {
            variables: {
              "ic-brand-Login-custom-message" => text
            }
          }
        }
        json = response.parsed_body
        expect(json["brand_config"]["variables"]["ic-brand-Login-custom-message"]).to eq(text)
        expect(json["brand_config"]["variables"]["ic-brand-Login-custom-message"]).to include("\t")
      end

      it "normalizes line endings in textarea content" do
        user_session(admin)
        text = "Line 1\r\nLine 2"
        post "create", params: {
          account_id: @account.id,
          brand_config: {
            variables: {
              "ic-brand-Login-custom-message" => text
            }
          }
        }
        json = response.parsed_body
        # Sanitize.clean normalizes \r\n to \n
        expect(json["brand_config"]["variables"]["ic-brand-Login-custom-message"]).to eq("Line 1\nLine 2")
      end

      it "handles textarea values that become empty after sanitization" do
        user_session(admin)
        post "create", params: {
          account_id: @account.id,
          brand_config: {
            variables: {
              "ic-brand-Login-custom-message" => "<script></script>"
            }
          }
        }
        json = response.parsed_body
        expect(json["brand_config"]["variables"]["ic-brand-Login-custom-message"]).to eq("")
      end

      it "rejects oversized content even after sanitization" do
        user_session(admin)
        # 501 'a's wrapped in <b> tags - still over limit after tag removal
        long_html = "<b>#{"a" * 501}</b>"
        post "create", params: {
          account_id: @account.id,
          brand_config: {
            variables: {
              "ic-brand-Login-custom-message" => long_html
            }
          }
        }
        expect(response).to have_http_status(:bad_request)
      end

      it "sanitizes multiple XSS vectors" do
        user_session(admin)
        xss_payload = '<script>alert(1)</script><img src=x onerror="alert(2)"><a href="javascript:alert(3)">click</a>Hello'
        post "create", params: {
          account_id: @account.id,
          brand_config: {
            variables: {
              "ic-brand-Login-custom-message" => xss_payload
            }
          }
        }
        json = response.parsed_body
        result = json["brand_config"]["variables"]["ic-brand-Login-custom-message"]
        expect(result).to eq("clickHello")
        expect(result).not_to include("<script")
        expect(result).not_to include("<img")
        expect(result).not_to include("onerror")
        expect(result).not_to include("javascript:")
      end

      it "sanitizes HTML entities and special characters" do
        user_session(admin)
        text = "Test &lt;script&gt;alert('xss')&lt;/script&gt; &amp; more"
        post "create", params: {
          account_id: @account.id,
          brand_config: {
            variables: {
              "ic-brand-Login-custom-message" => text
            }
          }
        }
        json = response.parsed_body
        # FullSanitizer strips tags but preserves HTML entities
        expect(json["brand_config"]["variables"]["ic-brand-Login-custom-message"]).to include("&")
      end

      it "handles mixed content with newlines and HTML" do
        user_session(admin)
        text = "Welcome!\n<script>alert('xss')</script>\nPlease login."
        post "create", params: {
          account_id: @account.id,
          brand_config: {
            variables: {
              "ic-brand-Login-custom-message" => text
            }
          }
        }
        json = response.parsed_body
        result = json["brand_config"]["variables"]["ic-brand-Login-custom-message"]
        expect(result).to eq("Welcome!\n\nPlease login.")
        expect(result).not_to include("<script")
      end
    end

    shared_examples_for "a brand variable type" do |variable_name, valid_values, invalid_values|
      before { user_session(admin) }

      def submit(variable, value)
        post "create", params: {
          account_id: @account.id,
          brand_config: { variables: { variable => value } }
        }
      end

      valid_values.each do |description, value|
        it "accepts #{description}" do
          submit(variable_name, value)
          expect(response).to have_http_status(:ok)
          expect(response.parsed_body["brand_config"]["variables"][variable_name]).to eql(value)
        end
      end

      invalid_values.each do |description, value|
        it "rejects #{description}" do
          submit(variable_name, value)
          expect(response).to have_http_status(:bad_request)
        end
      end
    end

    context "color variable processing" do
      it_behaves_like(
        "a brand variable type",
        "ic-brand-primary",
        {
          "3-digit hex colors" => "#abc",
          "4-digit hex colors with alpha" => "#abcd",
          "6-digit hex colors" => "#A1B2C3",
          "8-digit hex colors with alpha" => "#11223344",
        },
        {
          ":has() CSS payloads" => "red; } :has(input[name=\"authenticity_token\"][value^=\"a\"]) { background-image: url(https://evil.example/a",
          "url() payloads" => "url(https://evil.example/leak)",
          "CSS named colors" => "red",
          "rgb() color functions" => "rgb(255,0,0)",
          "hex colors with trailing content" => "#abc;color:red",
          "5-digit hex (not a valid CSS color)" => "#abcde",
          "7-digit hex (not a valid CSS color)" => "#abcdef0",
        }
      )
    end

    context "percentage variable processing" do
      it_behaves_like(
        "a brand variable type",
        "ic-brand-watermark-opacity",
        {
          "integer percentage values" => "75%",
          "decimal values without a percent sign" => "0.5",
          "100% upper bound" => "100%",
          "zero" => "0",
        },
        {
          "percentage values with CSS payloads" => "50%; background: url(https://evil.example)",
          "non-numeric percentage values" => "abc",
          "negative percentage values" => "-1",
          "values above 100" => "9999999%",
        }
      )
    end

    context "image variable processing" do
      it_behaves_like(
        "a brand variable type",
        "ic-brand-header-image",
        {
          "relative image paths" => "/images/logo.png",
          "http image URLs" => "http://cdn.example.com/logo.png",
          "https image URLs" => "https://cdn.example.com/logo.png",
        },
        {
          "javascript: scheme" => "javascript:alert(1)",
          "data: image URIs" => "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
          "data: html URIs" => "data:text/html;base64,PGgxPng=",
          "vbscript: scheme" => "vbscript:msgbox(1)",
          "file: scheme" => "file:///etc/passwd",
          "bare relative paths without a leading slash" => "logo.png",
          "protocol-relative URLs" => "//evil.example.com/logo.png",
          "triple-slash URLs" => "///evil.example.com/logo.png",
          "image URLs containing single quotes" => "logo.png'); background: red; ('",
          "image URLs containing parentheses" => "evil(payload).png",
          "image URLs containing newlines" => "logo.png\n} :root { color: red",
        }
      )
    end

    context "textarea variable rendering" do
      it "does not include textarea-typed variables in the generated brand stylesheet" do
        user_session(admin)
        malicious = "Hello; } :has(input) { background-image: url(//evil)"
        post "create", params: {
          account_id: @account.id,
          brand_config: { variables: { "ic-brand-Login-custom-message" => malicious } }
        }
        md5 = response.parsed_body["brand_config"]["md5"]
        css = BrandableCSS.all_brand_variable_values_as_css(BrandConfig.find(md5))
        expect(css).not_to include("ic-brand-Login-custom-message")
        expect(css).not_to include("Hello;")
      end
    end

    context "unsupported variable types" do
      it "rejects variables whose schema declares an unknown type" do
        user_session(admin)
        allow(BrandableCSS).to receive(:variables_map).and_return(
          BrandableCSS.variables_map.merge(
            "ic-brand-primary" => { "variable_name" => "ic-brand-primary", "type" => "exotic" }
          )
        )
        post "create", params: {
          account_id: @account.id,
          brand_config: { variables: { "ic-brand-primary" => "anything" } }
        }
        expect(response).to have_http_status(:bad_request)
      end
    end
  end

  describe "#destroy" do
    it "allows authorized admin to create" do
      admin = account_admin_user(account: @account)
      user_session(admin)
      session[:brand_config] = { md5: @bc.md5, type: :base }
      delete "destroy", params: { account_id: @account.id }
      assert_status(302)
      expect(session[:brand_config]).to be_nil
      expect { @bc.reload }.to raise_error(ActiveRecord::RecordNotFound)
    end

    it "does not allow non admin access" do
      user = user_with_pseudonym(active_all: true)
      user_session(user)
      delete "destroy", params: { account_id: @account.id }
      assert_status(401)
    end
  end

  describe "#save_to_account" do
    it "allows authorized admin to create" do
      admin = account_admin_user(account: @account)
      user_session(admin)
      post "save_to_account", params: { account_id: @account.id }
      assert_status(200)
    end

    it "regenerates sub accounts" do
      subbc = BrandConfig.create(variables: { "ic-brand-primary" => "#111" })
      @account.sub_accounts.create!(name: "Sub", brand_config_md5: subbc.md5)

      admin = account_admin_user(account: @account)
      user_session(admin)
      session[:brand_config] = { md5: @bc.md5, type: :base }
      post "save_to_account", params: { account_id: @account.id }
      assert_status(200)
      json = response.parsed_body
      expect(json["subAccountProgresses"]).to be_present
    end

    it "does not allow non admin access" do
      user = user_with_pseudonym(active_all: true)
      user_session(user)
      post "save_to_account", params: { account_id: @account.id }
      assert_status(401)
    end
  end

  describe "#save_to_user_session" do
    it "allows authorized admin to create" do
      admin = account_admin_user(account: @account)
      user_session(admin)
      post "save_to_user_session", params: { account_id: @account.id, brand_config_md5: @bc.md5 }
      assert_status(302)
      expect(session[:brand_config]).to eq({ md5: @bc.md5, type: :base })
    end

    it "allows authorized admin to remove" do
      admin = account_admin_user(account: @account)
      user_session(admin)
      session[:brand_config] = { md5: @bc.md5, type: :base }
      post "save_to_user_session", params: { account_id: @account.id, brand_config_md5: "" }
      assert_status(302)
      expect(session[:brand_config]).to eq({ md5: nil, type: :default })
      expect { @bc.reload }.to raise_error(ActiveRecord::RecordNotFound)
    end

    it "does not allow non admin access" do
      user = user_with_pseudonym(active_all: true)
      user_session(user)
      post "save_to_user_session", params: { account_id: @account.id, brand_config_md5: @bc.md5 }
      assert_status(401)
      expect(session[:brand_config]).to be_nil
    end
  end

  describe "elevated auth provider enforcement" do
    let!(:elevated_provider) { @account.authentication_providers.create!(auth_type: "saml") }
    let(:log_flag_enabled) { false }
    let(:enforce_flag_enabled) { false }
    let(:brand_configs_flag_enabled) { true }

    before do
      admin = account_admin_user(account: @account)
      admin_pseudonym = pseudonym(admin, account: @account)
      user_session(admin, admin_pseudonym)

      AuthenticationMethods::PseudonymAttributes.reset

      allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?).and_return(false)
      allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?)
        .with("log_violations").and_return(log_flag_enabled)
      allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?)
        .with("enforce_violations").and_return(enforce_flag_enabled)
      allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?)
        .with("require_for_brand_configs").and_return(brand_configs_flag_enabled)
    end

    context "when no elevated provider is configured" do
      let(:enforce_flag_enabled) { true }

      it "allows the request" do
        get :index, params: { account_id: @account.id }
        expect(response).to be_successful
      end
    end

    context "when an elevated provider is configured" do
      before do
        @account.settings[:elevated_auth_provider_global_id] = elevated_provider.global_id
        @account.save(validate: false)
      end

      context "and the session uses the elevated provider" do
        let(:enforce_flag_enabled) { true }

        before { AuthenticationMethods::PseudonymAttributes.auth_provider_id = elevated_provider.id }

        it "allows index" do
          get :index, params: { account_id: @account.id }
          expect(response).to be_successful
        end

        it "allows create" do
          post :create, params: { account_id: @account.id }, format: :json
          expect(response).to have_http_status(:ok)
        end
      end

      context "and the session does not use the elevated provider" do
        context "with both flags off" do
          it "allows the request" do
            get :index, params: { account_id: @account.id }
            expect(response).to be_successful
          end
        end

        context "with only the log flag on" do
          let(:log_flag_enabled) { true }

          it "allows the request" do
            get :index, params: { account_id: @account.id }
            expect(response).to be_successful
          end
        end

        context "with the enforce flag on" do
          let(:enforce_flag_enabled) { true }

          it "blocks json requests with 403 unauthorized" do
            post :create, params: { account_id: @account.id }, format: :json
            expect(response).to have_http_status(:forbidden)
            expect(response.parsed_body["status"]).to eq "unauthorized"
          end

          it "redirects html requests with a flash error" do
            get :index, params: { account_id: @account.id }
            expect(response).to be_redirect
            expect(flash[:error][:html]).to include("requires using an elevated authentication provider")
          end

          context "but the brand_configs flag is off" do
            let(:brand_configs_flag_enabled) { false }

            it "bypasses the elevated auth provider check" do
              get :index, params: { account_id: @account.id }
              expect(response).to be_successful
            end
          end
        end
      end
    end
  end
end
