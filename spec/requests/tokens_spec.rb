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

describe TokensController do
  describe "developer keys" do
    context "not logged in" do
      it "requires being logged in to create an access token" do
        post "/api/v1/users/self/tokens", params: { token: { purpose: "test" } }
        expect(response).to have_http_status(:unauthorized)
      end

      it "requires being logged in to delete an access token" do
        delete "/api/v1/users/self/tokens/5"
        expect(response).to have_http_status(:unauthorized)
      end

      it "requires being logged in to retrieve an access token" do
        get "/api/v1/users/self/tokens/5"
        expect(response).to have_http_status(:unauthorized)
      end

      it "requires being logged in to list manually generated access tokens" do
        get "/api/v1/users/self/user_generated_tokens"
        expect(response).to have_http_status(:unauthorized)
      end
    end

    describe "#user_generated_tokens" do
      let(:admin_user) { account_admin_user }
      let(:target_user) { user_factory(active_user: true) }
      let(:other_user) { user_factory(active_user: true) }

      context "with admin privileges" do
        before do
          user_session(admin_user)
        end

        it "returns manually generated tokens for the specified user" do
          token1 = target_user.access_tokens.create!(purpose: "test token 1", developer_key: DeveloperKey.default)
          token2 = target_user.access_tokens.create!(purpose: "test token 2", developer_key: DeveloperKey.default)

          get "/api/v1/users/#{target_user.id}/user_generated_tokens"

          expect(response).to have_http_status(:ok)
          json = response.parsed_body
          expect(json.length).to eq 2
          expect(json.pluck("id")).to contain_exactly(token1.id, token2.id)
          expect(json.pluck("purpose")).to contain_exactly("test token 1", "test token 2")
        end

        it "excludes non-manually generated tokens" do
          manual_token = target_user.access_tokens.create!(purpose: "manual token", developer_key: DeveloperKey.default)
          external_key = DeveloperKey.create!(name: "external_app")
          target_user.access_tokens.create!(developer_key: external_key)

          get "/api/v1/users/#{target_user.id}/user_generated_tokens"

          expect(response).to have_http_status(:ok)
          json = response.parsed_body
          expect(json.length).to eq 1
          expect(json.first["id"]).to eq manual_token.id
        end

        it "supports pagination" do
          (1..15).map do |i|
            target_user.access_tokens.create!(purpose: "token #{i}", developer_key: DeveloperKey.default)
          end

          get "/api/v1/users/#{target_user.id}/user_generated_tokens", params: { per_page: 10 }

          expect(response).to have_http_status(:ok)
          json = response.parsed_body
          expect(json.length).to eq 10

          expect(response.headers["Link"]).to be_present
          expect(response.headers["Link"]).to include("next")
        end

        it "orders tokens by created_at and id" do
          Timecop.freeze(1.hour.ago) do
            @token1 = target_user.access_tokens.create!(purpose: "older token", developer_key: DeveloperKey.default)
          end
          @token2 = target_user.access_tokens.create!(purpose: "newer token", developer_key: DeveloperKey.default)

          get "/api/v1/users/#{target_user.id}/user_generated_tokens"

          expect(response).to have_http_status(:ok)
          json = response.parsed_body
          expect(json.length).to eq 2
          expect(json.first["id"]).to eq @token1.id
          expect(json.second["id"]).to eq @token2.id
        end

        it "includes proper token attributes in response" do
          token = target_user.access_tokens.create!(
            purpose: "test token",
            developer_key: DeveloperKey.default,
            permanent_expires_at: 1.week.from_now
          )

          get "/api/v1/users/#{target_user.id}/user_generated_tokens"

          expect(response).to have_http_status(:ok)
          json = response.parsed_body
          token_json = json.first

          expect(token_json).to include(
            "id" => token.id,
            "purpose" => "test token",
            "user_id" => target_user.id,
            "created_at" => token.created_at.iso8601,
            "expires_at" => token.permanent_expires_at.iso8601,
            "workflow_state" => token.workflow_state,
            "scopes" => token.scopes
          )
        end

        context "with cross-shard tokens" do
          specs_require_sharding

          it "returns tokens from all shards" do
            target_user.associate_with_shard(@shard1)
            target_user.associate_with_shard(@shard2)
            @shard1.activate do
              AccessToken.create!(user: target_user, developer_key: DeveloperKey.default, purpose: "shard 1 token")
            end

            @shard2.activate do
              AccessToken.create!(user: target_user, developer_key: DeveloperKey.default, purpose: "shard 2 token")
            end

            get "/api/v1/users/#{target_user.id}/user_generated_tokens"

            expect(response).to have_http_status(:ok)
            json = response.parsed_body
            expect(json.length).to eq 2
            expect(json.pluck("purpose").sort).to contain_exactly("shard 1 token",
                                                                  "shard 2 token")
          end
        end
      end

      context "without admin privileges" do
        before do
          user_session(other_user)
        end

        it "returns unauthorized when user lacks permission" do
          get "/api/v1/users/#{target_user.id}/user_generated_tokens"

          expect(response).to have_http_status(:forbidden)
        end

        it "allows users to view their own tokens when they have appropriate permissions" do
          user_session(target_user)

          get "/api/v1/users/#{target_user.id}/user_generated_tokens"

          expect(response).to have_http_status(:ok)
        end
      end

      context "with teacher privileges" do
        let(:course) { course_model }
        let(:teacher) { teacher_in_course(course:, active_all: true).user }
        let(:student) { student_in_course(course:, active_all: true).user }

        before do
          user_session(teacher)
        end

        it "returns unauthorized when teacher tries to view student tokens" do
          student.access_tokens.create!(purpose: "student token", developer_key: DeveloperKey.default)

          get "/api/v1/users/#{student.id}/user_generated_tokens"

          expect(response).to have_http_status(:forbidden)
        end
      end

      context "with student privileges" do
        let(:course) { course_model }
        let(:student1) { student_in_course(course:, active_all: true).user }
        let(:student2) { student_in_course(course:, active_all: true).user }

        before do
          user_session(student1)
        end

        it "returns unauthorized when student tries to view other student tokens" do
          student2.access_tokens.create!(purpose: "other student token", developer_key: DeveloperKey.default)

          get "/api/v1/users/#{student2.id}/user_generated_tokens"

          expect(response).to have_http_status(:forbidden)
        end
      end
    end

    context "logged in" do
      let(:user) do
        user_factory(active_user: true)
        @user
      end

      before do
        user_session(user)
      end

      it "allows creating an access token" do
        post "/api/v1/users/self/tokens", params: { token: { purpose: "test", expires_at: "jun 1 2011" } }
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        token_record = user.access_tokens.find(json["id"])
        expect(token_record.developer_key).to eq DeveloperKey.default
        expect(json["purpose"]).to eq "test"
        expect(token_record.permanent_expires_at.to_date).to eq Time.zone.parse("jun 1 2011").to_date
        expect(token_record.workflow_state).to eq("active")
      end

      it "does not allow explicitly setting the token value" do
        post "/api/v1/users/self/tokens", params: { token: { purpose: "test", expires_at: "jun 1 2011", token: "mytoken" } }
        expect(response).to have_http_status(:ok)
        expect(response.body).not_to match(/mytoken/)
        json = response.parsed_body
        token_record = user.access_tokens.find(json["id"])
        expect(token_record.full_token).not_to match(/mytoken/)
        expect(token_record.developer_key).to eq DeveloperKey.default
        expect(json["purpose"]).to eq "test"
        expect(token_record.permanent_expires_at.to_date).to eq Time.zone.parse("jun 1 2011").to_date
      end

      it "does not allow creating a token without a purpose param" do
        post "/api/v1/users/self/tokens", params: { token: { expires_at: "jun 1 2011" } }
        expect(response).to have_http_status(:bad_request)
        expect(response.parsed_body.first["message"]).to eq("token[purpose] is missing")
      end

      context "when the user is a site admin" do
        before do
          @sa_user = site_admin_user(user:)
        end

        let(:private_settings) { instance_double(DynamicSettings::FallbackProxy) }

        around { |example| Timecop.freeze(Time.zone.now.change(usec: 0)) { example.run } }

        before do
          allow(private_settings).to receive(:[]).and_return(nil)
          allow(private_settings).to receive(:[])
            .with("site_admin_access_token_expires_in", failsafe: 604_800)
            .and_return(3600)
          allow(DynamicSettings).to receive(:find).and_call_original
          allow(DynamicSettings).to receive(:find).with(tree: :private).and_return(private_settings)
        end

        it "applies the site admin expiration restriction" do
          post "/api/v1/users/self/tokens", params: { token: { purpose: "test" } }
          expect(response).to have_http_status(:ok)
          json = response.parsed_body
          token_record = user.access_tokens.find(json["id"])
          expect(token_record.permanent_expires_at).to eql(1.hour.from_now)
        end

        it "respects a user-provided expiration when it is shorter" do
          post "/api/v1/users/self/tokens", params: { token: { purpose: "test", expires_at: 30.minutes.from_now.iso8601 } }
          expect(response).to have_http_status(:ok)
          json = response.parsed_body
          token_record = user.access_tokens.find(json["id"])
          expect(token_record.permanent_expires_at).to eql(30.minutes.from_now)
        end

        it "restricts a user-provided expiration that exceeds the site admin limit" do
          post "/api/v1/users/self/tokens", params: { token: { purpose: "test", expires_at: 2.hours.from_now.iso8601 } }
          expect(response).to have_http_status(:ok)
          json = response.parsed_body
          token_record = user.access_tokens.find(json["id"])
          expect(token_record.permanent_expires_at).to eql(1.hour.from_now)
        end
      end

      it "allows deleting an access token" do
        token = user.access_tokens.create!(purpose: "test")
        expect(token.user_id).to eq user.id
        delete "/api/v1/users/self/tokens/#{token.id}"
        expect(response).to have_http_status(:ok)
        expect(token.reload.workflow_state).to eq("deleted")
      end

      it "allows an admin to delete an access token while masquerading" do
        Account.site_admin.account_users.create!(user:)
        other_user = user_with_pseudonym(active_all: true)
        token = other_user.access_tokens.create!(purpose: "test")

        post "/users/#{other_user.id}/masquerade"
        delete "/api/v1/users/self/tokens/#{token.id}"
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json["id"]).to eq token.id
        expect(token.reload.workflow_state).to eq("deleted")
      end

      it "does not allow deleting someone else's access token" do
        user2 = User.create!
        token = user2.access_tokens.create!(purpose: "test")
        expect(token.user_id).to eq user2.id
        delete "/api/v1/users/self/tokens/#{token.id}"
        assert_status(404)
      end

      it "allows retrieving an access token, but not give the full token string" do
        token = user.access_tokens.new
        token.developer_key = DeveloperKey.default
        token.purpose = "test"
        token.save!
        expect(token.user_id).to eq user.id
        expect(token.manually_created?).to be true
        get "/api/v1/users/self/tokens/#{token.id}"
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json["id"]).to eql(token.id)
        expect(json["visible_token"]).to eq("#{token.token_hint}...")
      end

      it "does not include token for non-manually-generated tokens" do
        key = DeveloperKey.create!(name: "test_key_#{SecureRandom.hex(4)}")
        token = user.access_tokens.create!(developer_key: key)
        expect(token.user_id).to eq user.id
        expect(token.manually_created?).to be false
        get "/api/v1/users/self/tokens/#{token.id}"
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json["id"]).to eq token.id
        expect(response.body).not_to match(/#{token.token_hint}/)
      end

      it "does not allow retrieving someone else's access token" do
        user2 = User.create!
        token = user2.access_tokens.create!(purpose: "test")
        expect(token.user_id).to eq user2.id
        get "/api/v1/users/self/tokens/#{token.id}"
        expect(response).to have_http_status(:not_found)
      end

      it "allows updating a token" do
        token = user.access_tokens.new
        token.developer_key = DeveloperKey.default
        token.purpose = "test"
        token.save!
        expect(token.user_id).to eq user.id
        expect(token.manually_created?).to be true
        put "/api/v1/users/self/tokens/#{token.id}", params: { token: { purpose: "new purpose" } }
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json["id"]).to eq token.id
        expect(json["purpose"]).to eq "new purpose"
        expect(json["visible_token"]).to eq("#{token.token_hint}...")
        token.reload
        expect(token.workflow_state).to eq("active")
      end

      it "does not overwrite the token's permanent_expires_at on update if expires_at not provided" do
        token = user.access_tokens.create!(permanent_expires_at: 1.day.from_now, purpose: "test")
        original_expires_at = token.permanent_expires_at
        put "/api/v1/users/self/tokens/#{token.id}", params: { token: { purpose: "test" } }
        token.reload
        expect(token.purpose).to eq "test"
        expect(token.permanent_expires_at).to eq original_expires_at
      end

      it "allows regenerating a manually generated token" do
        token = user.access_tokens.new
        token.developer_key = DeveloperKey.default
        token.purpose = "test"
        token.save!
        expect(token.user_id).to eq user.id
        expect(token.manually_created?).to be true
        original_crypted = token.crypted_token
        put "/api/v1/users/self/tokens/#{token.id}", params: { token: { regenerate: "1" } }
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json["id"]).to eql(token.id)
        token.reload
        expect(token.crypted_token).not_to eq original_crypted
        expect(json["visible_token"]).to match(/\A[a-zA-Z0-9~_]+\z/)
        expect(token.workflow_state).to eq("active")
      end

      it "does not allow regenerating a non-manually-generated token" do
        key = DeveloperKey.create!(name: "test_key_#{SecureRandom.hex(4)}")
        token = user.access_tokens.create!(developer_key: key)
        expect(token.user_id).to eq user.id
        expect(token.manually_created?).to be false
        original_crypted = token.crypted_token
        put "/api/v1/users/self/tokens/#{token.id}", params: { token: { regenerate: "1" } }
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json["id"]).to eq token.id
        token.reload
        expect(token.crypted_token).to eq original_crypted
        expect(response.body).not_to match(/#{token.token_hint}/)
      end

      it "does not allow regenerating an expired token without a new expiration date" do
        token = user.access_tokens.create!(permanent_expires_at: 1.day.ago, purpose: "test")
        put "/api/v1/users/self/tokens/#{token.id}", params: { token: { regenerate: "1" } }
        assert_status(400)
      end

      it "allows regenerating an expired token with a new expiration date" do
        token = user.access_tokens.create!(permanent_expires_at: 1.day.ago, purpose: "test")
        put "/api/v1/users/self/tokens/#{token.id}", params: { token: { regenerate: "1", expires_at: 1.day.from_now } }
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json["id"]).to eql(token.id)
        expect(json["purpose"]).to eq "test"
      end

      it "does not allow updating someone else's token" do
        user2 = User.create!
        token = user2.access_tokens.create!(purpose: "test")
        expect(token.user_id).to eq user2.id
        put "/api/v1/users/#{user2.id}/tokens/#{token.id}", params: { token: { regenerate: "1" } }
        assert_status(404)
      end

      it "allows activating a pending token" do
        token = user.access_tokens.new(workflow_state: "pending")
        token.developer_key = DeveloperKey.default
        token.purpose = "test"
        token.save!
        expect(token.user_id).to eq user.id
        expect(token.manually_created?).to be true
        post "/profile/tokens/#{token.id}/activate", params: { token: { purpose: "new purpose" } }
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json["id"]).to eq token.id
        token.reload
        expect(token.workflow_state).to eq("active")
      end

      it "does not allow activating an active token" do
        token = user.access_tokens.new
        token.developer_key = DeveloperKey.default
        token.purpose = "test"
        token.save!
        expect(token.user_id).to eq user.id
        expect(token.manually_created?).to be true
        post "/profile/tokens/#{token.id}/activate", params: { token: { purpose: "new purpose" } }
        expect(response).to have_http_status(:bad_request)
      end

      context "with limit_personal_access_tokens setting on" do
        before do
          Account.default.change_root_account_setting!(:limit_personal_access_tokens, true)
        end

        context "as non-admin" do
          it "does not allow creating an access token" do
            post "/api/v1/users/self/tokens", params: { token: { purpose: "test", expires_at: "" } }
            expect(response).to have_http_status(:forbidden)
          end

          it "does not allow updating an access token" do
            token = user.access_tokens.create!(purpose: "test")
            put "/api/v1/users/self/tokens/#{token.id}", params: { token: { regenerate: "1" } }
            assert_status(403)
          end
        end

        context "as admin" do
          let(:admin) { account_admin_user }

          before do
            user_session(admin)
          end

          it "allows creating an access token" do
            post "/api/v1/users/self/tokens", params: { token: { purpose: "test", expires_at: "" } }
            expect(response).to have_http_status(:ok)
            json = response.parsed_body
            token_record = admin.access_tokens.find(json["id"])
            expect(json["purpose"]).to eq "test"
            expect(token_record.workflow_state).to eq("active")
          end

          it "allows updating an access token" do
            token = admin.access_tokens.create!(purpose: "test")
            put "/api/v1/users/self/tokens/#{token.id}", params: { token: { regenerate: "1" } }
            expect(response).to have_http_status(:ok)
            json = response.parsed_body
            expect(json["id"]).to eql(token.id)
            token.reload
            expect(token.workflow_state).to eq("active")
          end

          context "for another user" do
            let(:other_user) { user_with_pseudonym(active_all: true) }

            it "allows creating an access token" do
              post "/api/v1/users/#{other_user.id}/tokens", params: { token: { purpose: "test", expires_at: "jun 1 2011" } }
              expect(response).to have_http_status(:ok)
              json = response.parsed_body
              token_record = AccessToken.find(json["id"])
              expect(token_record.developer_key).to eq DeveloperKey.default
              expect(json["purpose"]).to eq "test"
              expect(token_record.permanent_expires_at.to_date).to eq Time.zone.parse("jun 1 2011").to_date
              expect(json["user_id"]).to eq other_user.id
              expect(token_record.workflow_state).to eq("pending")
            end

            it "does not allow creating an access token without proper permissions" do
              account_with_role_changes(role_changes: { create_access_tokens: false })
              become_user = user_with_pseudonym(active_all: true)
              post "/users/#{become_user.id}/masquerade"

              post "/api/v1/users/#{other_user.id}/tokens",
                   params: { token: { purpose: "test", expires_at: "jun 1 2011" } }
              assert_status(403)
            end

            it "allows updating an access token" do
              token = other_user.access_tokens.create!(purpose: "test", workflow_state: "active")
              put "/api/v1/users/#{other_user.id}/tokens/#{token.id}", params: { token: { regenerate: "1" } }

              expect(response).to have_http_status(:ok)
              json = response.parsed_body
              expect(json["id"]).to eq token.id
              token.reload
              expect(token.workflow_state).to eq("pending")
            end

            context "while masquerading" do
              before do
                post "/users/#{other_user.id}/masquerade"
              end

              it "allows creating an access token" do
                post "/api/v1/users/self/tokens",
                     params: { token: { purpose: "test", expires_at: "jun 1 2011" } }
                expect(response).to have_http_status(:ok)
                json = response.parsed_body
                token_record = AccessToken.find(json["id"])
                expect(token_record.developer_key).to eq DeveloperKey.default
                expect(json["purpose"]).to eq "test"
                expect(token_record.permanent_expires_at.to_date).to eq Time.zone.parse("jun 1 2011").to_date
                expect(json["user_id"]).to eq other_user.id
                expect(token_record.workflow_state).to eq("pending")
              end

              it "does not allow creating an access token without proper permissions" do
                account_with_role_changes(role_changes: { create_access_tokens: false })

                post "/api/v1/users/self/tokens",
                     params: { token: { purpose: "test", expires_at: "jun 1 2011" } }
                assert_status(403)
              end

              it "allows updating an access token" do
                token = other_user.access_tokens.create!(purpose: "test")
                expect(token.workflow_state).to eq("active")
                put "/api/v1/users/self/tokens/#{token.id}",
                    params: { token: { regenerate: "1" } }

                expect(response).to have_http_status(:ok)
                json = response.parsed_body
                expect(json["id"]).to eq token.id
                token.reload
                expect(token.workflow_state).to eq("pending")
              end
            end
          end
        end
      end

      context "with restrict_personal_access_tokens_from_students setting on" do
        before do
          Account.default.change_root_account_setting!(:restrict_personal_access_tokens_from_students, true)
        end

        shared_examples_for "access token creation and update denied" do
          it "does not allow creating an access token" do
            post "/api/v1/users/self/tokens", params: { token: { purpose: "test", expires_at: "" } }
            expect(response).to have_http_status(:forbidden)
          end

          it "does not allow updating an access token" do
            token = user.access_tokens.create!(purpose: "test")
            put "/api/v1/users/self/tokens/#{token.id}", params: { token: { regenerate: "1" } }
            assert_status(403)
          end
        end

        context "as a 'nobody'" do
          it_behaves_like "access token creation and update denied"
        end

        context "as a student" do
          before do
            course_with_student(active_all: true, user:)
          end

          it_behaves_like "access token creation and update denied"
        end

        context "as an observer" do
          before do
            course_with_observer(active_all: true, user:)
          end

          it_behaves_like "access token creation and update denied"
        end

        context "as both a student and an observer" do
          before do
            course_with_student(active_all: true, user:)
            course_with_observer(active_all: true, user:)
          end

          it_behaves_like "access token creation and update denied"
        end

        context "as a teacher" do
          before do
            course_with_teacher(active_all: true, user:)
          end

          it "does allow creating an access token" do
            post "/api/v1/users/self/tokens", params: { token: { purpose: "test", expires_at: 1.day.from_now.iso8601 } }
            expect(response).to have_http_status(:ok)
            json = response.parsed_body
            expect(json["purpose"]).to eq "test"
          end

          it "does allow updating an access token" do
            token = user.access_tokens.create!(purpose: "test")
            put "/api/v1/users/self/tokens/#{token.id}", params: { token: { regenerate: "1" } }
            expect(response).to have_http_status(:ok)
            json = response.parsed_body
            expect(json["id"]).to eq token.id
          end
        end

        context "as both a student and a teacher" do
          before do
            course_with_student(active_all: true, user:)
            course_with_teacher(active_all: true, user:)
          end

          it "does allow creating an access token" do
            post "/api/v1/users/self/tokens", params: { token: { purpose: "test", expires_at: 1.day.from_now.iso8601 } }
            expect(response).to have_http_status(:ok)
            json = response.parsed_body
            expect(json["purpose"]).to eq "test"
          end

          it "does allow updating an access token" do
            token = user.access_tokens.create!(purpose: "test")
            put "/api/v1/users/self/tokens/#{token.id}", params: { token: { regenerate: "1" } }
            expect(response).to have_http_status(:ok)
            json = response.parsed_body
            expect(json["id"]).to eq token.id
          end
        end
      end

      context "with both limit_personal_access_tokens and restrict_personal_access_tokens_from_students setting off" do
        before { Account.default.change_root_account_setting!(:limit_personal_access_tokens, false) }

        context "as non-admin" do
          it "allows creating an access token" do
            post "/api/v1/users/self/tokens", params: { token: { purpose: "test", expires_at: 1.day.from_now.iso8601 } }
            expect(response).to have_http_status(:ok)
            json = response.parsed_body
            expect(json["purpose"]).to eq "test"
          end

          it "allows updating an access token" do
            token = user.access_tokens.create!(purpose: "test")
            put "/api/v1/users/self/tokens/#{token.id}", params: { token: { regenerate: "1" } }
            expect(response).to have_http_status(:ok)
            json = response.parsed_body
            expect(json["id"]).to eq token.id
          end
        end
      end

      context "with an elevated auth provider required by the account" do
        let(:account) { Account.default }
        let!(:elevated_auth_provider) { account.authentication_providers.create!(auth_type: "saml") }
        let!(:other_auth_provider) { account.authentication_providers.create!(auth_type: "cas", auth_base: "http://example.com") }
        let(:elevated_user) { user_with_pseudonym(active_all: true, account:) }
        let(:elevated_pseudonym) { elevated_user.pseudonyms.first }

        before do
          account.settings[:elevated_auth_provider_global_id] = elevated_auth_provider.global_id
          account.save(validate: false)
          user_session(elevated_user, elevated_pseudonym)

          AuthenticationMethods::PseudonymAttributes.reset

          allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?).and_return(false)
          allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?)
            .with("enforce_violations").and_return(true)
        end

        describe "POST create" do
          context "when the session uses the elevated auth provider" do
            before do
              allow_any_instance_of(AuthenticationMethods::PseudonymAttributes).to receive(:load_auth_provider).and_return(elevated_auth_provider)
            end

            it "allows creating an access token" do
              post "/api/v1/users/self/tokens", params: { token: { purpose: "test", expires_at: "jun 1 2011" } }
              expect(response).to have_http_status(:ok)
              json = response.parsed_body
              token_record = elevated_user.access_tokens.find(json["id"])
              expect(token_record.user).to eql elevated_user
              expect(json["purpose"]).to eql "test"
            end
          end

          context "when the session uses a non-elevated auth provider" do
            before do
              allow_any_instance_of(AuthenticationMethods::PseudonymAttributes).to receive(:load_auth_provider).and_return(other_auth_provider)
            end

            it "denies creating an access token" do
              expect do
                post "/api/v1/users/self/tokens", params: { token: { purpose: "test", expires_at: "jun 1 2011" } }
              end.not_to change { elevated_user.access_tokens.count }
              expect(response).to have_http_status(:forbidden)
            end
          end
        end
      end

      context "student expiration enforcement" do
        context "as an admin" do
          let(:admin) { account_admin_user }

          before do
            user_session(admin)
          end

          it "doesn't enforce expiry for an admin" do
            post "/api/v1/users/self/tokens", params: { token: { purpose: "test", expires_at: "" } }
            expect(response).to have_http_status(:ok)
            json = response.parsed_body
            token_record = admin.access_tokens.find(json["id"])
            expect(token_record.permanent_expires_at).to be_nil
          end
        end

        context "as a teacher" do
          before do
            Account.site_admin.disable_feature!(:non_admin_access_token_expiration)
            course_with_teacher(active_all: true, user:)
          end

          it "doesn't enforce expiry for a teacher" do
            post "/api/v1/users/self/tokens", params: { token: { purpose: "test", expires_at: "" } }
            expect(response).to have_http_status(:ok)
            json = response.parsed_body
            token_record = user.access_tokens.find(json["id"])
            expect(token_record.permanent_expires_at).to be_nil
          end
        end

        context "as a teacher with student enrollments" do
          before do
            Account.site_admin.disable_feature!(:non_admin_access_token_expiration)
            course_with_teacher(active_all: true, user:)
            course_with_student(active_all: true, user:)
          end

          it "doesn't enforce expiry for a teacher with some student enrollments" do
            post "/api/v1/users/self/tokens", params: { token: { purpose: "test", expires_at: "" } }
            expect(response).to have_http_status(:ok)
            json = response.parsed_body
            token_record = user.access_tokens.find(json["id"])
            expect(token_record.permanent_expires_at).to be_nil
          end
        end

        context "as a user with only student enrollments" do
          before do
            course_with_student(active_all: true, user:)
          end

          it "rejects tokens without expiry" do
            post "/api/v1/users/self/tokens", params: { token: { purpose: "test", expires_at: "" } }
            expect(response).to have_http_status(:bad_request)
          end

          it "rejects tokens with an expiry past the maximum" do
            expires_at = (TokensController::MAXIMUM_EXPIRATION_DURATION + 1.day).from_now
            post "/api/v1/users/self/tokens", params: { token: { purpose: "test", expires_at: } }
            expect(response).to have_http_status(:bad_request)
          end

          it "allows tokens with an expiry" do
            expires_at = 1.day.from_now
            post "/api/v1/users/self/tokens", params: { token: { purpose: "test", expires_at: } }
            expect(response).to have_http_status(:ok)
          end
        end
      end
    end
  end
end
