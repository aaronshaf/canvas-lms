# frozen_string_literal: true

#
# Copyright (C) 2014 - present Instructure, Inc.
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

require_relative "../../lti2_spec_helper"

module Lti
  describe MessageController do
    include_context "lti2_spec_helper"
    let(:enabled_capability) do
      %w[ToolConsumerInstance.guid
         Message.documentTarget
         Message.locale
         Membership.role
         Context.id]
    end

    let(:default_resource_handler) do
      ResourceHandler.create!(
        resource_type_code: "instructure.com:default",
        name: "resource name",
        tool_proxy:
      )
    end

    describe "GET #registration" do
      context "course" do
        it "initiates a tool proxy registration request" do
          course_with_teacher_logged_in(active_all: true)
          course = @course
          post "/courses/#{course.id}/lti/tool_proxy_registration", params: { tool_consumer_url: "http://tool.consumer.url" }
          expect(response).to have_http_status(:ok)
          expect(response.body).to include("http://tool.consumer.url")
          expect(response.body).to include("LTI-2p0")
          expect(response.body).to include("iframe")
          expect(response.body).to include("reg_key")
          expect(response.body).to include("reg_password")
          expect(response.body).to include("courses/#{course.id}/lti/registration_return")
          expect(response.body).to include(@course.root_account.lti_guid)
          expect(response.body).to include("/api/lti/courses/#{course.id}/authorize")
        end

        it "doesn't allow student to register an app" do
          course_with_student_logged_in(active_all: true)
          post "/courses/#{@course.id}/lti/tool_proxy_registration", params: { tool_consumer_url: "http://tool.consumer.url" }
          expect(response).to have_http_status :unauthorized
        end

        it "includes the authorization URL when feature flag enabled" do
          course_with_teacher_logged_in(active_all: true)
          post "/courses/#{@course.id}/lti/tool_proxy_registration", params: { tool_consumer_url: "http://tool.consumer.url" }
          expect(response).to have_http_status(:ok)
          expect(response.body).to include("oauth2_access_token_url")
        end

        it 'only allows http and https protocols in the "tool_consumer_url"' do
          course_with_teacher_logged_in(active_all: true)
          post "/courses/#{@course.id}/lti/tool_proxy_registration", params: { tool_consumer_url: "javascript://tool.consumer.url" }
          expect(response).to have_http_status(:bad_request)
        end
      end

      context "account" do
        it "initiates a tool proxy registration request" do
          user_session(account_admin_user)
          post "/accounts/#{Account.default.id}/lti/tool_proxy_registration", params: { tool_consumer_url: "http://tool.consumer.url" }
          expect(response).to have_http_status(:ok)
          expect(response.body).to include("http://tool.consumer.url")
          expect(response.body).to include("LTI-2p0")
          expect(response.body).to include("iframe")
          expect(response.body).to include("reg_key")
          expect(response.body).to include("reg_password")
        end

        it "doesn't allow non admin to register an app" do
          post "/accounts/#{Account.default.id}/lti/tool_proxy_registration", params: { tool_consumer_url: "http://tool.consumer.url" }
          assert_unauthorized
        end
      end
    end

    describe "GET #registration_return" do
      before { user_session(account_admin_user) }

      it "does not 500 if tool registration fails" do
        get "/courses/#{course.id}/lti/registration_return", params: { status: "failure" }
        expect(response).to have_http_status(:ok)
      end
    end

    describe "GET #reregistration" do
      let(:rereg_launch_path) { "https://samplelaunch/rereg" }

      before do
        MessageHandler.create!(
          message_type: ::IMS::LTI::Models::Messages::ToolProxyUpdateRequest::MESSAGE_TYPE,
          launch_path: rereg_launch_path,
          resource_handler: default_resource_handler
        )
      end

      context "course" do
        it "initiates a tool proxy reregistration request" do
          course_with_teacher_logged_in(active_all: true)
          course = @course
          get "/courses/#{course.id}/lti/tool_proxy_reregistration/#{tool_proxy.id}"
          expect(response).to have_http_status :ok
          expect(response.body).to include("ToolProxyUpdateRequest")
        end

        it "sends the correct version" do
          course_with_teacher_logged_in(active_all: true)
          course = @course
          get "/courses/#{course.id}/lti/tool_proxy_reregistration/#{tool_proxy.id}"
          expect(response).to have_http_status :ok
          expect(response.body).to include("LTI-2p0")
        end

        it "sends the correct resource_url" do
          course_with_teacher_logged_in(active_all: true)
          course = @course
          get "/courses/#{course.id}/lti/tool_proxy_reregistration/#{tool_proxy.id}"
          lti_launch = assigns[:lti_launch]
          expect(lti_launch.resource_url).to eq rereg_launch_path
        end

        it "sends the correct oauth_consumer_key" do
          course_with_teacher_logged_in(active_all: true)
          course = @course
          get "/courses/#{course.id}/lti/tool_proxy_reregistration/#{tool_proxy.id}"
          expect(response).to have_http_status :ok
          expect(response.body).to include(tool_proxy.guid)
        end

        it "sends the correct tc_profile_url" do
          course_with_teacher_logged_in(active_all: true)
          course = @course
          get "/courses/#{course.id}/lti/tool_proxy_reregistration/#{tool_proxy.id}"
          expect(response).to have_http_status :ok
          expect(response.body).to include("/tool_consumer_profile")
        end

        it "sends the correct launch_presentation_return_url" do
          course_with_teacher_logged_in(active_all: true)
          course = @course
          get "/courses/#{course.id}/lti/tool_proxy_reregistration/#{tool_proxy.id}"
          expected_launch = "courses/#{course.id}/lti/registration_return"
          expect(response.body).to include(expected_launch)
        end

        it "returns an error if there is not a reregistration handler" do
          course_with_teacher_logged_in(active_alll: true)
          course = @course
          default_resource_handler.message_handlers.first.destroy
          get "/courses/#{course.id}/lti/tool_proxy_reregistration/#{tool_proxy.id}"
          expect(response).to have_http_status :not_found
        end

        it "doesn't allow a student to reregister an app" do
          course_with_student_logged_in(active_all: true)
          get "/courses/#{course_factory.id}/lti/tool_proxy_reregistration/#{tool_proxy.id}"
          expect(response).to have_http_status :not_found
        end
      end
    end

    describe "GET #resource_link_id" do
      include_context "lti2_spec_helper"

      let(:link_id) { SecureRandom.uuid }

      let(:lti_link) do
        Link.new(resource_link_id: link_id,
                 vendor_code: product_family.vendor_code,
                 product_code: product_family.product_code,
                 resource_type_code: resource_handler.resource_type_code)
      end

      before do
        message_handler.update(message_type: MessageHandler::BASIC_LTI_LAUNCH_REQUEST)
        resource_handler.message_handlers = [message_handler]
        resource_handler.save!
        lti_link.save!
        user_session(account_admin_user)
      end

      it "succeeds if tool is installed in the current account" do
        get "/accounts/#{account.id}/lti/resource/#{link_id}"
        expect(response).to have_http_status(:ok)
      end

      it "succeeds if the tool is installed in the current course" do
        tool_proxy.update(context: course)
        get "/courses/#{course.id}/lti/resource/#{link_id}"
        expect(response).to have_http_status(:ok)
      end

      it "succeeds if the tool is installed in the current course's account" do
        tool_proxy.update(context: account)
        get "/courses/#{course.id}/lti/resource/#{link_id}"
        expect(response).to have_http_status(:ok)
      end

      context "resource_url" do
        let(:custom_url) { "http://www.samplelaunch.com/custom-resource-url" }
        let(:link_id) { SecureRandom.uuid }
        let(:lti_link) do
          Link.create!(resource_link_id: link_id,
                       vendor_code: product_family.vendor_code,
                       product_code: product_family.product_code,
                       resource_type_code: resource_handler.resource_type_code,
                       resource_url: custom_url)
        end

        it "uses the 'resource_url' if provided in the 'link_id'" do
          get "/accounts/#{account.id}/lti/resource/#{link_id}"
          expect(response).to have_http_status(:ok)
          expect(response.body).to include(custom_url)
        end

        it "responds with 400 if host name does not match" do
          message_handler.update(launch_path: "http://www.different.com")
          get "/accounts/#{account.id}/lti/resource/#{link_id}"
          expect(response).to have_http_status(:bad_request)
        end
      end

      context "assignment" do
        let(:assignment) { course.assignments.create!(name: "test") }

        before { tool_proxy.update(context: course) }

        it "finds the specified assignment" do
          get "/courses/#{course.id}/lti/resource/#{link_id}", params: { assignment_id: assignment.id }
          expect(response).to have_http_status(:ok)
        end

        it "renders not found if assignment does not exist" do
          get "/courses/#{course.id}/lti/resource/#{link_id}", params: { assignment_id: assignment.id + 1 }
          expect(response).to have_http_status(:not_found)
        end

        it "adds assignment substitutions" do
          assignment.update!(anonymous_grading: true)
          message_handler.update!(parameters: [{ "name" => "anonymous_grading", "variable" => "com.instructure.Assignment.anonymous_grading" }])
          get "/courses/#{course.id}/lti/basic_lti_launch_request/#{message_handler.id}", params: { assignment_id: assignment.id }
          expect(response).to have_http_status(:ok)
        end

        context "when secure params are given" do
          subject { get "/courses/#{course.id}/lti/basic_lti_launch_request/#{message_handler.id}", params: }

          let(:due_at) { Time.zone.now }

          let(:secure_params) do
            Canvas::Security.create_jwt({ lti_assignment_id: assignment.lti_context_id })
          end

          let(:params) do
            {
              secure_params:
            }
          end

          before do
            assignment.update!(due_at:)

            message_handler.update!(
              parameters: [
                { "name" => "due_date", "variable" => "Canvas.assignment.dueAt.iso8601" }
              ]
            )

            subject
          end

          it "expands assignment variables" do
            expect(response).to have_http_status(:ok)
            expect(response.body).to include("custom_due_date")
            expect(response.body).to include(due_at.utc.iso8601)
          end
        end
      end

      context "search account chain" do
        let(:root_account) { account.root_account }

        it "succeeds if the tool is installed in the current account's root account" do
          tool_proxy.update(context: root_account)
          get "/accounts/#{account.id}/lti/resource/#{link_id}"
          expect(response).to have_http_status(:ok)
        end

        it "succeeds if the tool is installed in the current course's root account" do
          tool_proxy.update(context: root_account)
          get "/courses/#{course.id}/lti/resource/#{link_id}"
          expect(response).to have_http_status(:ok)
        end
      end

      it "renders 'not found' no message handler is found" do
        resource_handler.message_handlers = []
        resource_handler.save!
        get "/accounts/#{account.id}/lti/resource/#{link_id}"
        expect(response).to have_http_status(:not_found)
      end
    end

    describe "GET #basic_lti_launch_request" do
      before do
        course_with_student(account:, active_all: true)
        user_session(@student)
      end

      context "jwt" do
        let(:tool_profile) do
          {
            "security_profile" => { "security_profile_name" => "lti_jwt_message_security" }
          }
        end

        before do
          tool_proxy.raw_data["tool_profile"] = tool_profile
          tool_proxy.save!
        end

        it "does a jwt launch" do
          get "/accounts/#{account.id}/lti/basic_lti_launch_request/#{message_handler.id}", params: { params: { tool_launch_context: "my_custom_context" } }
          expect(response).to have_http_status(:ok)
          doc = Nokogiri::HTML(response.body)
          jwt_value = doc.css('input[name="jwt"]').first&.[]("value")
          expect(jwt_value).to be_present
          expect(jwt_value).to match(/\A[\w-]+\.[\w-]+\.[\w-]+\z/)
        end

        it "signs the jwt with the shared secret" do
          get "/accounts/#{account.id}/lti/basic_lti_launch_request/#{message_handler.id}", params: { params: { tool_launch_context: "my_custom_context" } }
          expect(response).to have_http_status(:ok)
          doc = Nokogiri::HTML(response.body)
          jwt_value = doc.css('input[name="jwt"]').first&.[]("value")
          expect(jwt_value).to be_present
          decoded = JSON::JWT.decode(jwt_value, tool_proxy.shared_secret)
          expect(decoded).to be_a(Hash)
        end

        it "returns the roles as an array" do
          tool_proxy.raw_data["enabled_capability"] += enabled_capability
          tool_proxy.save!
          get "/accounts/#{account.id}/lti/basic_lti_launch_request/#{message_handler.id}", params: { params: { tool_launch_context: "my_custom_context" } }
          expect(response).to have_http_status(:ok)
          doc = Nokogiri::HTML(response.body)
          jwt_value = doc.css('input[name="jwt"]').first&.[]("value")
          decoded = JSON::JWT.decode(jwt_value, tool_proxy.shared_secret)
          expect(decoded["roles"]).to be_a(Array) if decoded["roles"].present?
        end

        it "url encodes the aud" do
          message_handler.launch_path = "http://example.com/test?query with space=true"
          message_handler.save!
          get "/accounts/#{account.id}/lti/basic_lti_launch_request/#{message_handler.id}", params: { params: { tool_launch_context: "my_custom_context" } }
          expect(response).to have_http_status(:ok)
          expect(response.body).to include("example.com")
        end
      end

      context "account" do
        context "content tags" do
          subject do
            get "/courses/#{course.id}/lti/basic_lti_launch_request/#{message_handler.id}", params: { module_item_id: tag.id }
            response
          end

          let_once(:course) { course_model }
          let_once(:assignment) { assignment_model(course:) }

          before { message_handler.update!(capabilities: ["com.instructure.Assignment.anonymous_grading"]) }

          context "when the tag context is an assignment" do
            let(:tag) { ContentTag.create!(context: assignment, content: message_handler) }

            it "finds the specified assignment from content tag" do
              expect(subject).to have_http_status(:ok)
              doc = Nokogiri::HTML(subject.body)
              inputs = doc.css("form input")
              param_names = inputs.pluck("name")
              expect(param_names).to include("oauth_signature")
              expect(param_names).to include("oauth_consumer_key")
            end
          end

          context "when the tag context is a course" do
            let(:tag) { ContentTag.create!(context: course, content: message_handler) }

            it "does not find an specified assignment" do
              expect(subject).to have_http_status(:ok)
              doc = Nokogiri::HTML(subject.body)
              inputs = doc.css("form input")
              param_names = inputs.pluck("name")
              expect(param_names).to include("oauth_signature")
              expect(param_names).to include("oauth_consumer_key")
            end
          end

          context "when the tag context is an assignment from another course" do
            let(:course_two) { course_model }
            let(:tag) { ContentTag.create!(context: course_two, content: message_handler) }

            it "does not find the specified assignment" do
              expect(subject).to have_http_status(:ok)
              doc = Nokogiri::HTML(subject.body)
              inputs = doc.css("form input")
              param_names = inputs.pluck("name")
              expect(param_names).to include("oauth_signature")
              expect(param_names).to include("oauth_consumer_key")
            end
          end
        end

        context "oauth signing" do
          let(:launch_url) { "https://www.samplelaunch.com/blti" }
          let(:get_params) do
            {
              params: { tool_launch_context: "my_custom_context" }
            }
          end

          before do
            tool_proxy.raw_data["enabled_capability"] += enabled_capability
            tool_proxy.save!
          end

          it "returns the signed params" do
            get "/accounts/#{account.id}/lti/basic_lti_launch_request/#{message_handler.id}", params: get_params
            expect(response).to have_http_status :ok
            expect(response.body).to include(launch_url)
            expect(response.body).to include(%(name="oauth_consumer_key"))
            expect(response.body).to include(tool_proxy.guid)
            expect(response.body).to include("iframe")
            expect(response.body).to include("oauth_signature")
          end

          it "converts to CRLF endpoints in params for oauth base string generation" do
            ToolSetting.create(tool_proxy:,
                               context_id: nil,
                               context_type: nil,
                               resource_link_id: nil,
                               custom: { "somenewlines" => "abc\nxyz" })

            get "/accounts/#{account.id}/lti/basic_lti_launch_request/#{message_handler.id}", params: get_params
            expect(response).to have_http_status(:ok)
            doc = Nokogiri::HTML(response.body)

            custom_field = doc.css('input[name="custom_somenewlines"]').first
            expect(custom_field).to be_present
            expect(custom_field["value"]).to eq("abc\r\nxyz")

            oauth_sig = doc.css('input[name="oauth_signature"]').first
            expect(oauth_sig).to be_present
            expect(oauth_sig["value"]).not_to be_empty
          end
        end

        it "launches gracefully if it can not find the content_tag for the given module_item_id" do
          course = Course.create!
          tag = course.context_module_tags.create!(context: account, tag_type: "context_module")
          tag.context_module = ContextModule.create!(context: course)
          tag.save!
          tag.delete
          get "/courses/#{course.id}/lti/basic_lti_launch_request/#{message_handler.id}", params: { module_item_id: tag.id, params: { tool_launch_context: "my_custom_context" } }
          expect(response).to have_http_status :ok
        end

        it "sets the active tab" do
          get "/accounts/#{account.id}/lti/basic_lti_launch_request/#{message_handler.id}"
          expect(response).to have_http_status :ok
          doc = Nokogiri::HTML(response.body)
          expect(doc.css("form").first).to be_present
          expect(response.body).to include(message_handler.asset_string)
        end

        it "returns a 404 when when no handler is found" do
          get "/accounts/#{account.id}/lti/basic_lti_launch_request/0"
          expect(response).to have_http_status :not_found
        end

        it "redirects to login page if there is no session" do
          tool_proxy.raw_data["enabled_capability"] += enabled_capability
          tool_proxy.save!
          allow(PseudonymSession).to receive(:find_with_validation).and_return(nil)
          get "/accounts/#{account.id}/lti/basic_lti_launch_request/#{message_handler.id}"
          expect(response).to redirect_to(login_url)
        end

        it "does custom variable expansion for tool settings" do
          parameters = %w[LtiLink.custom.url ToolProxyBinding.custom.url ToolProxy.custom.url].map do |key|
            ::IMS::LTI::Models::Parameter.new(name: key.underscore, variable: key)
          end
          message_handler.parameters = parameters.as_json
          message_handler.save

          get "/accounts/#{account.id}/lti/basic_lti_launch_request/#{message_handler.id}"
          expect(response).to have_http_status :ok

          doc = Nokogiri::HTML(response.body)
          lti_link_url = doc.css('input[name="custom_lti_link.custom.url"]').first&.[]("value")
          proxy_binding_url = doc.css('input[name="custom_tool_proxy_binding.custom.url"]').first&.[]("value")
          proxy_url = doc.css('input[name="custom_tool_proxy.custom.url"]').first&.[]("value")

          expect(lti_link_url).to include("api/lti/tool_settings/")
          expect(proxy_binding_url).to include("api/lti/tool_settings/")
          expect(proxy_url).to include("api/lti/tool_settings/")
        end

        it "returns the roles" do
          tool_proxy.raw_data["enabled_capability"] += enabled_capability
          tool_proxy.save!
          get "/accounts/#{account.id}/lti/basic_lti_launch_request/#{message_handler.id}", params: { params: { tool_launch_context: "my_custom_context" } }
          expect(response).to have_http_status(:ok)
          expect(response.body).to include("roles")
          expect(response.body).to include("http://purl.imsglobal.org/vocab/lis/v2/system/person#User")
        end

        it "returns the oauth_callback" do
          tool_proxy.raw_data["enabled_capability"] += enabled_capability
          tool_proxy.save!
          get "/accounts/#{account.id}/lti/basic_lti_launch_request/#{message_handler.id}", params: { params: { tool_launch_context: "my_custom_context" } }
          expect(response).to have_http_status(:ok)
          expect(response.body).to include("about:blank")
        end

        it "adds module item substitutions" do
          parameters = %w[Canvas.module.id Canvas.moduleItem.id].map do |key|
            ::IMS::LTI::Models::Parameter.new(name: key.underscore, variable: key)
          end
          message_handler.parameters = parameters.as_json
          message_handler.save

          tag = message_handler.context_module_tags.create!(context: @course, tag_type: "context_module")
          tag.context_module = ContextModule.create!(context: @course)
          tag.save!

          get "/courses/#{@course.id}/lti/basic_lti_launch_request/#{message_handler.id}", params: { module_item_id: tag.id, params: { tool_launch_context: "my_custom_context" } }
          expect(response).to have_http_status :ok

          doc = Nokogiri::HTML(response.body)
          module_id_param = doc.css('input[name="custom_canvas.module.id"]').first&.[]("value")
          module_item_id_param = doc.css('input[name="custom_canvas.module_item.id"]').first&.[]("value")

          expect(module_id_param).to eq(tag.context_module_id.to_s)
          expect(module_item_id_param).to eq(tag.id.to_s)
        end

        it "sets the launch to window" do
          tag = message_handler.context_module_tags.create!(context: @course, tag_type: "context_module", new_tab: true)
          tag.context_module = ContextModule.create!(context: @course)
          tag.save!
          get "/courses/#{@course.id}/lti/basic_lti_launch_request/#{message_handler.id}", params: { module_item_id: tag.id, params: { tool_launch_context: "my_custom_context" } }
          expect(response).to have_http_status :ok
          expect(response.body).to include('data-tool-launch-type="window"')
        end

        it "returns the locale" do
          tool_proxy.raw_data["enabled_capability"] += enabled_capability
          tool_proxy.save!
          get "/accounts/#{account.id}/lti/basic_lti_launch_request/#{message_handler.id}", params: { params: { tool_launch_context: "my_custom_context" } }
          expect(response).to have_http_status(:ok)
          expect(response.body).to include("launch_presentation_locale")
        end

        it "returns tool settings in the launch" do
          ToolSetting.create(tool_proxy:,
                             context_id: nil,
                             context_type: nil,
                             resource_link_id: nil,
                             custom: { "default" => 42 })
          get "/accounts/#{account.id}/lti/basic_lti_launch_request/#{message_handler.id}", params: { params: { tool_launch_context: "my_custom_context" } }
          expect(response).to have_http_status(:ok)
          expect(response.body).to include("custom_default") and expect(response.body).to include("42")
        end

        it "does not do variable substitutions for tool settings" do
          ToolSetting.create(tool_proxy:,
                             context_id: nil,
                             context_type: nil,
                             resource_link_id: nil,
                             custom: { "default" => "Canvas.api.baseUrl" })
          get "/accounts/#{account.id}/lti/basic_lti_launch_request/#{message_handler.id}", params: { params: { tool_launch_context: "my_custom_context" } }
          expect(response).to have_http_status(:ok)
          expect(response.body).to include("Canvas.api.baseUrl")
        end

        it "adds params from secure_params" do
          lti_assignment_id = SecureRandom.uuid
          jwt = Canvas::Security.create_jwt({ lti_assignment_id: })
          get "/accounts/#{account.id}/lti/basic_lti_launch_request/#{message_handler.id}", params: { secure_params: jwt }
          expect(response).to have_http_status(:ok)
        end

        it "uses the lti_assignment_id as the resource_link_id" do
          lti_assignment_id = SecureRandom.uuid
          jwt = Canvas::Security.create_jwt({ lti_assignment_id: })
          get "/accounts/#{account.id}/lti/basic_lti_launch_request/#{message_handler.id}", params: { secure_params: jwt }
          expect(response).to have_http_status(:ok)
          expect(response.body).to include("resource_link_id") and expect(response.body).to include(lti_assignment_id)
        end

        it "does only adds non-required params if they are present in enabled_capability" do
          allow_any_instance_of(::IMS::LTI::Models::ToolProxy).to receive(:enabled_capability).and_return({})

          get "/accounts/#{account.id}/lti/basic_lti_launch_request/#{message_handler.id}", params: { params: { tool_launch_context: "my_custom_context" } }
          expect(response).to have_http_status :ok
          expect(response.body).not_to include("launch_locale")
        end

        it "calls LogService" do
          course_with_teacher_logged_in(active_all: true)
          message_handler.launch_path = "http://test.turnitin.com/launch"
          message_handler.save!

          WebMock.stub_request(:post, /.*/).to_return(status: 200, body: "")

          get "/courses/#{@course.id}/lti/basic_lti_launch_request/#{message_handler.id}"
          expect(response).to have_http_status(:ok)
        end
      end

      describe "resource link" do
        it "creates resource_links without a resource_link_fragment" do
          get "/accounts/#{account.id}/lti/basic_lti_launch_request/#{message_handler.id}", params: { params: { tool_launch_context: "my_custom_context" } }
          expect(response).to have_http_status :ok
          expect(response.body).to match(/name="resource_link_id"[^>]*value="[^"]+/)
        end

        it "creates with a resource_link_fragment" do
          get "/accounts/#{account.id}/lti/basic_lti_launch_request/#{message_handler.id}", params: { resource_link_fragment: "my_custom_postfix" }
          expect(response).to have_http_status :ok
          expect(response.body).to match(/name="resource_link_id"[^>]*value="[^"]+/)
        end
      end

      context "tool settings" do
        it "creates the tool proxy setting object" do
          message_handler.parameters = [{ "name" => "tool_settings", "variable" => "ToolProxy.custom.url" }]
          message_handler.save!
          expect(ToolSetting.where(tool_proxy_id: tool_proxy.id, context_id: nil, resource_link_id: nil).size).to eq 0
          get "/accounts/#{account.id}/lti/basic_lti_launch_request/#{message_handler.id}", params: { params: { tool_launch_context: "my_custom_context" } }
          expect(ToolSetting.where(tool_proxy_id: tool_proxy.id, context_id: nil, resource_link_id: nil).size).to eq 1
        end
      end
    end
  end
end
