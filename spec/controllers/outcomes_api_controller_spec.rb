# frozen_string_literal: true

#
# Copyright (C) 2015 - present Instructure, Inc.
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

describe OutcomesApiController do
  describe "#process_params" do
    let(:params) { ActionController::Parameters.new(description: "original_content", outlier_field: "pampam") }
    let(:controller) { OutcomesApiController.new }

    before do
      allow(controller).to receive_messages(process_incoming_html_content: "processed_content", params:)
    end

    it "processes description field" do
      processed_params = controller.send(:process_params)
      expect(processed_params[:description]).to eq("processed_content")
    end

    it "removes outlier fields" do
      processed_params = controller.send(:process_params)
      expect(processed_params).not_to have_key(:outlier_field)
    end
  end
end
