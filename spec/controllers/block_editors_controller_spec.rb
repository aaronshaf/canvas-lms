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

describe BlockEditorsController do
  let_once(:account) { Account.default }
  let_once(:course1) { course_factory(active_all: true, account:) }
  let_once(:teacher) do
    user_factory(active_all: true).tap do |t|
      course1.enroll_teacher(t, enrollment_state: "active")
    end
  end
  let_once(:wiki_page) { course1.wiki_pages.create!(title: "p") }
  let_once(:block_editor) do
    BlockEditor.create!(
      context: wiki_page,
      editor_version: "0.2",
      blocks: { "ROOT" => {} }
    )
  end

  before { user_session(teacher) }

  describe "GET #show" do
    render_views
    it "sets a Content-Security-Policy that restricts framing to same-origin" do
      get :show, params: { id: block_editor.id }
      expect(response).to be_successful
      csp = response.headers["Content-Security-Policy"].to_s
      directive = csp[/frame-ancestors[^;]*/]
      expect(directive).to be_present
      expect(directive).to include("'self'")
      expect(directive).not_to include("*")
      expect(directive).not_to match(/\bhttps?:/)
    end

    it "sets Cross-Origin-Opener-Policy and Cross-Origin-Resource-Policy" do
      get :show, params: { id: block_editor.id }
      expect(response.headers["Cross-Origin-Opener-Policy"]).to eq("same-origin")
      expect(response.headers["Cross-Origin-Resource-Policy"]).to eq("same-origin")
    end

    it "escapes the Loading placeholder rather than emitting html_safe" do
      allow(I18n).to receive(:t).and_call_original
      allow(I18n).to receive(:t).with("Loading...").and_return("<script>x</script>")
      get :show, params: { id: block_editor.id }
      expect(response.body).not_to include("<script>x</script>")
      expect(response.body).to include("&lt;script&gt;x&lt;/script&gt;")
    end

    it "renders unauthorized when user cannot read context" do
      other = user_factory(active_all: true)
      user_session(other)
      get :show, params: { id: block_editor.id }
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
