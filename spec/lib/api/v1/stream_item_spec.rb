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

describe "Api::V1::StreamItem" do
  include Api::V1::StreamItem

  describe "#api_render_stream paginate_url guard (CWE-94)" do
    before(:once) do
      course_with_student(active_all: true)
    end

    before do
      @context = @course
    end

    def render_stream_with(paginate_url)
      api_render_stream(contexts: [@course], paginate_url:, current_principal: @student.principal)
    end

    it "raises ArgumentError for an unknown method name" do
      expect { render_stream_with(:not_a_real_url_helper) }
        .to raise_error(ArgumentError, /Invalid paginate_url/)
    end

    it "raises ArgumentError for a real but non-allowlisted method like :system" do
      expect { render_stream_with(:system) }
        .to raise_error(ArgumentError, /Invalid paginate_url/)
    end

    it "raises ArgumentError when paginate_url is nil" do
      expect { render_stream_with(nil) }
        .to raise_error(ArgumentError, /Invalid paginate_url/)
    end
  end

  describe "ALLOWED_PAGINATE_URLS allowlist (regression guard)" do
    # Hard-coded rather than derived from the constant: removing or renaming a
    # symbol in the source allowlist must make a test fail, and any widening of
    # the allowlist must be a deliberate, reviewed change to this expectation.
    let(:known_paginate_urls) do
      %i[
        api_v1_course_activity_stream_url
        api_v1_group_activity_stream_url
        api_v1_user_activity_stream_url
      ]
    end

    it "allowlists exactly the three known activity stream route helpers" do
      expect(Api::V1::StreamItem::ALLOWED_PAGINATE_URLS).to contain_exactly(*known_paginate_urls)
    end

    it "allowlists only real, dispatchable route helpers" do
      known_paginate_urls.each do |helper|
        expect(Rails.application.routes.url_helpers).to respond_to(helper)
      end
    end
  end
end
