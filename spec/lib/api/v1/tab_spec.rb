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

describe Api::V1::Tab do
  let(:harness) do
    Class.new do
      include Api::V1::Tab

      def request
        nil
      end

      def valid_route_path(_context, _opts = {})
        "/valid-route"
      end

      def valid_route_url(_context, opts = {})
        "https://#{opts[:host]}/valid-route"
      end

      def not_a_route_helper_method(_context, _opts = {})
        "leaked"
      end

      private

      def private_route_path(_context, _opts = {})
        "leaked"
      end
    end.new
  end

  describe "#html_url" do
    it "dispatches to a public route helper named by tab[:href]" do
      expect(harness.html_url({ href: :valid_route_path }, :context)).to eq "/valid-route"
    end

    it "raises ArgumentError when tab[:href] is not a known method" do
      expect { harness.html_url({ href: :not_a_route_helper }, :context) }
        .to raise_error(ArgumentError, /Invalid tab href/)
    end

    it "raises ArgumentError when tab[:href] is a private method" do
      expect { harness.html_url({ href: :private_route_path }, :context) }
        .to raise_error(ArgumentError, /Invalid tab href/)
    end

    it "raises ArgumentError when tab[:href] is a public method whose name is not a _path or _url helper" do
      expect { harness.html_url({ href: :not_a_route_helper_method }, :context) }
        .to raise_error(ArgumentError, /Invalid tab href/)
    end

    it "raises ArgumentError when tab[:href] is nil" do
      expect { harness.html_url({ href: nil }, :context) }
        .to raise_error(ArgumentError, /Invalid tab href/)
    end

    it "dispatches to a _url helper when tab[:href] already ends with _url" do
      expect(harness.html_url({ href: :valid_route_url }, :context)).to eq "https:///valid-route"
    end

    context "when full_url: true" do
      before do
        allow(HostUrl).to receive(:context_host).and_return("example.test")
      end

      it "dispatches to the _url variant of the route helper" do
        result = harness.html_url({ href: :valid_route_path }, :context, full_url: true)
        expect(result).to eq "https://example.test/valid-route"
      end

      it "raises ArgumentError when the _url variant does not exist" do
        expect { harness.html_url({ href: :nonexistent_path }, :context, full_url: true) }
          .to raise_error(ArgumentError, /Invalid tab href/)
      end

      it "raises ArgumentError when tab[:href] is nil" do
        expect { harness.html_url({ href: nil }, :context, full_url: true) }
          .to raise_error(ArgumentError, /Invalid tab href/)
      end

      it "dispatches correctly when tab[:href] already ends with _url" do
        result = harness.html_url({ href: :valid_route_url }, :context, full_url: true)
        expect(result).to eq "https://example.test/valid-route"
      end
    end
  end
end
