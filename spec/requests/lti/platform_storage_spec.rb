# frozen_string_literal: true

#
# Copyright (C) 2022 - present Instructure, Inc.
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

describe Lti::PlatformStorageController do
  describe "#post_message_forwarding" do
    subject { get "/post_message_forwarding" }

    let(:forwarding_domain) { "localhost" }

    before do
      Setting.set("lti_iss", forwarding_domain)
      Setting.set("lti_platform_storage_signing_secret", "test_signing_secret_for_jwt")
    end

    context "when rendering the view" do
      def expected_script_tag_regex(domain)
        parent_origin = HostUrl.protocol + "://" + domain
        %r[<script>\s+window\.ENV = { PARENT_ORIGIN: #{Regexp.escape parent_origin.to_json} }\s+</script>]
      end

      it "includes the lti_post_message_forwarding.js script" do
        subject
        expect(response.body).to include("javascripts/lti_post_message_forwarding")
      end

      it "sets parent origin in js env to the current domain by default" do
        subject
        expect(response.body).to match(expected_script_tag_regex(forwarding_domain))
      end

      it "sets the parent origin based on the token jwt" do
        get "/post_message_forwarding", params: {
          token: described_class.parent_domain_jwt("example.instructure.com")
        }
        expect(response.body).to match(expected_script_tag_regex("example.instructure.com"))
      end

      it "returns a 403 if the token is invalid" do
        get "/post_message_forwarding", params: { token: "invalid" }
        expect(response).to have_http_status(:forbidden)
        expect(response.body).to eq("Invalid token")
      end
    end

    it "returns a successful response" do
      subject
      expect(response).to have_http_status(:ok)
    end

    it "modifies the frame-ancestors in the CSP header" do
      subject
      expect(response.headers["Content-Security-Policy"])
        .to match(/frame-ancestors [^;]*self[^;]*#{Regexp.escape(forwarding_domain)}/)
    end

    it "caches the response" do
      ttl = 1.year.seconds
      Setting.set("post_message_forwarding_html_ttl", ttl.to_s)
      subject
      expect(response.headers["Cache-Control"]).to match(/max-age=#{ttl}/)
    end
  end

  describe ".rev_fingerprint" do
    it "includes a fingerprint of the controller and view files" do
      files = [
        described_class.instance_method(:post_message_forwarding).source_location.first,
        Rails.root.join("app/views/lti/platform_storage/post_message_forwarding.html.erb")
      ]
      files_contents = files.map { |f| File.read(f) }.join
      rb_rev = Digest::SHA256.hexdigest(files_contents)[0...16]
      expect(described_class.rev_fingerprint).to end_with("-#{rb_rev}")
    end
  end

  describe ".parent_domain_jwt" do
    it "creates a jwt with the given domain" do
      %w[example.com example2.com].each do |domain|
        jwt = described_class.parent_domain_jwt(domain)
        decoded = CanvasSecurity.decode_jwt(jwt, [described_class.signing_secret])
        expect(decoded["parent_domain"]).to eq(domain)
      end
    end

    it "is cached in Thread.current" do
      Thread.current[:lti_platform_storage_jwt_cache] = nil
      jwt1 = described_class.parent_domain_jwt("example.com")
      jwt2 = described_class.parent_domain_jwt("example.com")
      expect(jwt1).to eq(jwt2)
    end

    it "limits the size of the cache in Thread.current" do
      max_size = described_class::MAX_THREAD_JWT_CACHE_SIZE
      (max_size + 1).times { |i| described_class.parent_domain_jwt("example#{i}.com") }
      expect(Thread.current[:lti_platform_storage_jwt_cache].size).to eq(max_size)
    end
  end
end
