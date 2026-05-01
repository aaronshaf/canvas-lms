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

require_relative "../../../views_helper"

describe "lti/ims/dynamic_registration/dr_iframe" do
  # Pull just the first <script>...</script> block from the rendered output.
  def script_content
    rendered[%r{<script>(.*?)</script>}m, 1]
  end

  describe "JavaScript escaping of @dr_url in the inline script block" do
    context "when the URL contains a double-quote character" do
      before { assign(:dr_url, 'http://attacker.example.com?x="injected"') }

      it "uses backslash escaping (\") rather than HTML entity escaping (&quot;)" do
        render
        expect(script_content).to include('\\"injected\\"')
      end

      it "does not emit HTML entity-encoded quotes inside the script block" do
        render
        expect(script_content).not_to include("&quot;")
      end
    end

    context "when the URL contains a </script> sequence" do
      before { assign(:dr_url, "http://attacker.example.com?x=</script><script>alert(1)") }

      it "uses the <\\/ escape sequence rather than HTML entity encoding" do
        render

        expect(script_content).to include("\\u003c/script\\u003e")
      end
    end
  end
end
