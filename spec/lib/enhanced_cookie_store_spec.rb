# frozen_string_literal: true

#
# Copyright (C) 2020 - present Instructure, Inc.
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

describe "EnhancedCookieStore" do
  let(:app) { instance_double(Rails::Application) }
  let(:options) { { secret: "fakesekretwith16bytesforlengthreq" } }
  let(:store) { EnhancedCookieStore.new(app, options) }
  let(:sid) { Rack::Session::SessionId.new("abc123") }
  let(:root_account_key) { EnhancedCookieStore::ROOT_ACCOUNT_KEY }
  let(:root_account_id) { "10000000000001" }
  let(:other_root_account_id) { "20000000000001" }

  def request_for(account_global_id, host_account_global_id: nil)
    account = account_global_id && instance_double(Account, global_id: account_global_id)
    env = Rack::MockRequest.env_for("/", "HTTP_HOST" => "school-a.instructure.com")
    env["canvas.domain_root_account"] = account
    if host_account_global_id
      host_account = instance_double(Account, global_id: host_account_global_id)
      env["canvas.account_domain"] = instance_double(AccountDomain, account: host_account)
    end
    ActionDispatch::Request.new(env)
  end

  describe "#unmarshal" do
    it "doesn't explode with malformed data" do
      expect(Canvas::Errors).to receive(:capture_exception) do |type, e, level|
        expect(level).to eq(:info)
        expect(e.class).to be(ArgumentError)
        expect(type).to eq(:cookie_store)
      end
      output = store.unmarshal("asdfasdfasdfasdf.asdfasdfasdfasdf.asdfasdfasdfasdf.asdfasdfasdfasdf")
      expect(output).to be_nil
    end
  end

  describe "#load_session" do
    before do
      Account.site_admin.enable_feature!(:block_cross_domain_session_cookies)
    end

    it "passes the session through when the issuing root account matches the request" do
      req = request_for(root_account_id)
      allow_any_instance_of(ActionDispatch::Session::EncryptedCookieStore)
        .to receive(:load_session)
        .and_return([sid, { root_account_key => root_account_id, "user_id" => 42 }])

      _, session = store.load_session(req)
      expect(session["user_id"]).to eq(42)
      expect(session[root_account_key]).to eq(root_account_id)
    end

    it "blanks the session and flags cookie deletion when the issuing root account differs" do
      req = request_for(other_root_account_id)
      allow_any_instance_of(ActionDispatch::Session::EncryptedCookieStore)
        .to receive(:load_session)
        .and_return([sid, { root_account_key => root_account_id, "user_id" => 42 }])
      expect(Canvas::Errors).to receive(:capture_exception).with(:cookie_store, "session root_account mismatch", :warn)

      returned_sid, session = store.load_session(req)
      expect(session).to eq({})
      expect(returned_sid).to eq(sid)
      expect(req.env["enhanced_cookie_store.drop_session"]).to be(true)
    end

    it "grandfathers in sessions that predate the root-account stamp" do
      req = request_for(root_account_id)
      allow_any_instance_of(ActionDispatch::Session::EncryptedCookieStore)
        .to receive(:load_session)
        .and_return([sid, { "user_id" => 42 }])

      _, session = store.load_session(req)
      expect(session["user_id"]).to eq(42)
    end

    it "passes through when the request has no root account resolved" do
      req = request_for(nil)
      allow_any_instance_of(ActionDispatch::Session::EncryptedCookieStore)
        .to receive(:load_session)
        .and_return([sid, { root_account_key => root_account_id, "user_id" => 42 }])

      _, session = store.load_session(req)
      expect(session["user_id"]).to eq(42)
    end

    it "passes an empty session through unchanged" do
      req = request_for(root_account_id)
      allow_any_instance_of(ActionDispatch::Session::EncryptedCookieStore)
        .to receive(:load_session)
        .and_return([sid, {}])

      _, session = store.load_session(req)
      expect(session).to eq({})
    end

    it "uses the hostname-resolved root account when canvas.domain_root_account has been overridden by URL context" do
      # Mirrors visiting /accounts/site_admin from other root account
      req = request_for(other_root_account_id, host_account_global_id: root_account_id)
      allow_any_instance_of(ActionDispatch::Session::EncryptedCookieStore)
        .to receive(:load_session)
        .and_return([sid, { root_account_key => root_account_id, "user_id" => 42 }])

      _, session = store.load_session(req)
      expect(session["user_id"]).to eq(42)
    end

    it "returns the session unchanged when FF is disabled" do
      Account.site_admin.disable_feature!(:block_cross_domain_session_cookies)
      req = request_for(other_root_account_id)
      allow_any_instance_of(ActionDispatch::Session::EncryptedCookieStore)
        .to receive(:load_session)
        .and_return([sid, { root_account_key => root_account_id, "user_id" => 42 }])
      expect(Canvas::Errors).to receive(:capture_exception).with(:cookie_store, "session would be rejected due to root_account mismatch", :warn)

      _, session = store.load_session(req)
      expect(session["user_id"]).to be(42)
    end
  end

  describe "#commit_session" do
    it "deletes the session cookie and returns early when the drop flag is set" do
      req = request_for(root_account_id)
      req.env["enhanced_cookie_store.drop_session"] = true
      expect(req.cookie_jar).to receive(:delete).with(store.key, { path: "/" })

      store.commit_session(req, double)

      expect(req.env).not_to have_key("enhanced_cookie_store.drop_session")
    end

    it "forwards domain and path from store options when deleting" do
      store_with_domain = EnhancedCookieStore.new(app, options.merge(domain: ".instructure.com", path: "/"))
      req = request_for(root_account_id)
      req.env["enhanced_cookie_store.drop_session"] = true
      expect(req.cookie_jar).to receive(:delete).with(store_with_domain.key, { domain: ".instructure.com", path: "/" })

      store_with_domain.commit_session(req, double)
    end

    it "delegates to super when the flag is absent" do
      req = request_for(root_account_id)
      allow_any_instance_of(ActionDispatch::Session::EncryptedCookieStore)
        .to receive(:commit_session)
      expect(req.cookie_jar).not_to receive(:delete)

      store.commit_session(req, double)
    end
  end

  describe "#write_session" do
    it "stamps the current root account global id on a fresh session" do
      req = request_for(root_account_id)
      captured = nil
      allow_any_instance_of(ActionDispatch::Session::EncryptedCookieStore)
        .to receive(:write_session) { |_, _req, _sid, data, _opts| captured = data }

      store.write_session(req, sid, { "user_id" => 42 }, {})

      expect(captured[root_account_key]).to eq(root_account_id)
      expect(captured["user_id"]).to eq(42)
    end

    it "does not overwrite an existing stamp on the session" do
      req = request_for(other_root_account_id) # request is for a different account than the stamp
      captured = nil
      allow_any_instance_of(ActionDispatch::Session::EncryptedCookieStore)
        .to receive(:write_session) { |_, _req, _sid, data, _opts| captured = data }

      store.write_session(req, sid, { root_account_key => root_account_id, "user_id" => 42 }, {})

      expect(captured[root_account_key]).to eq(root_account_id)
    end

    it "does not stamp when the request has no root account resolved" do
      req = request_for(nil)
      captured = nil
      allow_any_instance_of(ActionDispatch::Session::EncryptedCookieStore)
        .to receive(:write_session) { |_, _req, _sid, data, _opts| captured = data }

      store.write_session(req, sid, { "user_id" => 42 }, {})

      expect(captured).not_to have_key(root_account_key)
    end

    it "leaves a blank session alone" do
      req = request_for(root_account_id)
      captured = nil
      allow_any_instance_of(ActionDispatch::Session::EncryptedCookieStore)
        .to receive(:write_session) { |_, _req, _sid, data, _opts| captured = data }

      store.write_session(req, sid, {}, {})

      expect(captured).to eq({})
    end

    it "stamps with the hostname account, not a URL-overridden domain root account" do
      req = request_for(other_root_account_id, host_account_global_id: root_account_id)
      captured = nil
      allow_any_instance_of(ActionDispatch::Session::EncryptedCookieStore)
        .to receive(:write_session) { |_, _req, _sid, data, _opts| captured = data }

      store.write_session(req, sid, { "user_id" => 42 }, {})

      expect(captured[root_account_key]).to eq(root_account_id)
    end
  end
end
