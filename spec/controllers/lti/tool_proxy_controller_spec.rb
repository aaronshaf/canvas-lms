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

describe Lti::ToolProxyController, type: :request do
  let(:account) { Account.default }
  let(:teacher_a) { user_with_pseudonym(active_all: true) }
  let(:course_a) do
    c = Course.create!(name: "course-a", account:, workflow_state: "available")
    c.enroll_user(teacher_a, "TeacherEnrollment", enrollment_state: "active")
    c
  end
  let(:course_b) do
    c = Course.create!(name: "course-b", account:, workflow_state: "available")
    c.enroll_user(user_with_pseudonym(active_all: true), "TeacherEnrollment", enrollment_state: "active")
    c
  end

  let(:product_family) do
    Lti::ProductFamily.create!(
      vendor_code: "vendor-#{SecureRandom.hex(4)}",
      product_code: "product-#{SecureRandom.hex(4)}",
      vendor_name: "Vendor",
      root_account: account
    )
  end

  def make_tool_proxy(context)
    Lti::ToolProxy.create!(
      shared_secret: "secret",
      guid: SecureRandom.uuid,
      product_version: "1.0",
      lti_version: "LTI-2p0",
      product_family:,
      context:,
      workflow_state: "active",
      raw_data: { "tool_proxy" => {} },
      name: "Tool Proxy"
    )
  end

  describe "cross-context scoping (Pattern β regression)" do
    before { user_session(teacher_a) }

    context "with a tool proxy in a course that the user doesn't belong to" do
      let(:tp_b) { make_tool_proxy(course_b) }

      it "doesn't allow user to update" do
        put "/api/v1/courses/#{course_a.id}/tool_proxies/#{tp_b.id}.json",
            params: { workflow_state: "deleted" }
        expect(response).to have_http_status(:not_found)
        tp_b.reload
        expect(tp_b.workflow_state).to eq("active")
      end

      it "doesn't allow user to delete" do
        delete "/api/v1/courses/#{course_a.id}/tool_proxies/#{tp_b.id}.json"

        expect(response).to have_http_status(:not_found)
        tp_b.reload
        expect(tp_b.workflow_state).to eq("active")
      end
    end

    context "with a tool proxy in a course that the user does belong to" do
      let(:tp_a) { make_tool_proxy(course_a) }

      it "allows the user to update" do
        put "/api/v1/courses/#{course_a.id}/tool_proxies/#{tp_a.id}.json",
            params: { workflow_state: "disabled" }

        expect(response).to be_successful
        expect(tp_a.reload.workflow_state).to eq("disabled")
      end
    end
  end
end
