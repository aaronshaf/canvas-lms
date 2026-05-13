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

require_relative "../apis/api_spec_helper"

describe OutcomeGroupsApiController do
  describe "#outcome_groups_incoming_params XSS sanitization (SEC-21938)" do
    let(:controller) { OutcomeGroupsApiController.new }
    let(:xss_payload) { %(</script><script>alert('xss')</script>Group) }
    let(:entity_payload) { "&lt;script&gt;alert(1)&lt;/script&gt;x" }
    let(:double_entity_payload) { "&amp;lt;script&amp;gt;alert(1)&amp;lt;/script&amp;gt;x" }

    def params_with(**fields)
      p = ActionController::Parameters.new({ description: "" }.merge(fields))
      allow(controller).to receive_messages(process_incoming_html_content: "", params: p)
    end

    %i[title vendor_guid].each do |field|
      context field.to_s do
        it "strips raw HTML tags" do
          params_with(field => xss_payload)
          result = controller.send(:outcome_groups_incoming_params)
          expect(result[field]).not_to include("<script")
          expect(result[field]).not_to include("</script>")
        end

        it "strips single-entity-encoded tags" do
          params_with(field => entity_payload)
          result = controller.send(:outcome_groups_incoming_params)
          expect(result[field]).not_to include("<script")
          expect(result[field]).not_to include("</script>")
        end

        it "strips double-entity-encoded tags" do
          params_with(field => double_entity_payload)
          result = controller.send(:outcome_groups_incoming_params)
          expect(result[field]).not_to include("<script")
          expect(result[field]).not_to include("</script>")
        end

        it "preserves plain text including bare < and > characters" do
          params_with(field => "if x > y & z < w, then Plain Title")
          result = controller.send(:outcome_groups_incoming_params)
          expect(result[field]).to eq("if x > y & z < w, then Plain Title")
        end
      end
    end

    it "returns non-string field values unchanged" do
      expect(controller.send(:strip_plain_text, nil)).to be_nil
    end
  end
end
