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
#

describe "AnalyticsDashboardController" do
  let(:launch_url) { "https://assets.instructure.com/insights-analytics/analytics-dashboard/staging/remoteEntry.js" }

  before :once do
    @account = Account.default
    # view_analytics_dashboard is only grantable when this feature is enabled (account_allows).
    @account.enable_feature!(:intelligent_insights_analytics_dashboard)
    @admin = account_admin_user(account: @account)
    @student = user_factory(active_all: true)
  end

  before do
    allow(Services::AnalyticsDashboard).to receive(:launch_url).and_return(launch_url)
  end

  describe "GET show" do
    it "requires a logged-in user" do
      get "/accounts/#{@account.id}/analytics_dashboard"
      assert_unauthorized
    end

    context "when the user lacks the view_analytics_dashboard permission" do
      before { user_session(@student) }

      it "returns unauthorized" do
        get "/accounts/#{@account.id}/analytics_dashboard"
        assert_unauthorized
      end
    end

    context "when the user has the view_analytics_dashboard permission" do
      before { user_session(@admin) }

      it "renders successfully" do
        get "/accounts/#{@account.id}/analytics_dashboard"
        expect(response).to have_http_status(:ok)
      end

      it "sets the launch url in remote env from canvas-consul-config" do
        get "/accounts/#{@account.id}/analytics_dashboard"
        expect(remotes_from_response(response)).to include(
          "analytics_dashboard" => { "launch_url" => launch_url }
        )
      end

      it "loads the analytics_dashboard js bundle" do
        expect_any_instance_of(AnalyticsDashboardController).to receive(:deferred_js_bundle).with(:analytics_dashboard)
        get "/accounts/#{@account.id}/analytics_dashboard"
      end

      it "prefers a session release-tag override over the configured launch url" do
        Setting.set("allow_microfrontend_release_tag_override", "true")
        override_url = "https://assets.instructure.com/insights-analytics/analytics-dashboard/my-branch/remoteEntry.js"
        get api_v1_microfrontends_release_tag_override_path, params: { override: { analytics_dashboard: override_url } }

        get "/accounts/#{@account.id}/analytics_dashboard"
        expect(remotes_from_response(response)).to include(
          "analytics_dashboard" => { "launch_url" => override_url }
        )
      end
    end
  end
end
