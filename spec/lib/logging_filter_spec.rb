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

describe "LoggingFilter" do
  describe "filter_uri" do
    it "filters sensitive information from the url query string" do
      url = "https://www.instructure.example.com?access_token=abcdef"
      filtered_url = LoggingFilter.filter_uri(url)
      expect(filtered_url).to eq "https://www.instructure.example.com?access_token=[FILTERED]"
    end

    it "filters sensitive information from the url query string case insensitively" do
      url = "https://www.instructure.example.com?ACCESS_TOKEN=abcdef"
      filtered_url = LoggingFilter.filter_uri(url)
      expect(filtered_url).to eq "https://www.instructure.example.com?ACCESS_TOKEN=[FILTERED]"
    end

    it "filters all query params" do
      url = "https://www.instructure.example.com?access_token=abcdef&api_key=123"
      filtered_url = LoggingFilter.filter_uri(url)
      expect(filtered_url).to eq "https://www.instructure.example.com?access_token=[FILTERED]&api_key=[FILTERED]"
    end

    it "does not filter close matches" do
      url = "https://www.instructure.example.com?x_access_token=abcdef&api_key_x=123"
      filtered_url = LoggingFilter.filter_uri(url)
      expect(filtered_url).to eq url
    end

    context "AWS pre-signed S3 URLs" do
      # A pre-signed S3 URL is bearer-equivalent for its TTL: anyone who reads it can download
      # the object until the signature expires. These tests lock in the H4 mitigation — the
      # signing params must never appear unredacted in logs even when the URL flows through
      # CanvasHttp's INFO logging.

      it "filters X-Amz-Signature" do
        url = "https://bucket.s3.amazonaws.com/key?X-Amz-Signature=DEADBEEFCAFE0123"
        expect(LoggingFilter.filter_uri(url))
          .to eq "https://bucket.s3.amazonaws.com/key?X-Amz-Signature=[FILTERED]"
      end

      it "filters X-Amz-Credential" do
        url = "https://bucket.s3.amazonaws.com/key?X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20260507%2Fus-east-1%2Fs3%2Faws4_request"
        expect(LoggingFilter.filter_uri(url))
          .to eq "https://bucket.s3.amazonaws.com/key?X-Amz-Credential=[FILTERED]"
      end

      it "filters X-Amz-Security-Token" do
        url = "https://bucket.s3.amazonaws.com/key?X-Amz-Security-Token=FwoGZXIvYXdzEJr...example"
        expect(LoggingFilter.filter_uri(url))
          .to eq "https://bucket.s3.amazonaws.com/key?X-Amz-Security-Token=[FILTERED]"
      end

      it "filters X-Amz-SignedHeaders" do
        url = "https://bucket.s3.amazonaws.com/key?X-Amz-SignedHeaders=host"
        expect(LoggingFilter.filter_uri(url))
          .to eq "https://bucket.s3.amazonaws.com/key?X-Amz-SignedHeaders=[FILTERED]"
      end

      it "filters signing params regardless of case" do
        url = "https://bucket.s3.amazonaws.com/key?x-amz-signature=DEADBEEF&X-AMZ-CREDENTIAL=AKIA"
        expect(LoggingFilter.filter_uri(url))
          .to eq "https://bucket.s3.amazonaws.com/key?x-amz-signature=[FILTERED]&X-AMZ-CREDENTIAL=[FILTERED]"
      end

      it "filters only the sensitive params on a realistic pre-signed URL, preserving operational params" do
        url = "https://bucket.s3.amazonaws.com/query-results/abc123.csv.gz" \
              "?X-Amz-Algorithm=AWS4-HMAC-SHA256" \
              "&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20260507%2Fus-east-1%2Fs3%2Faws4_request" \
              "&X-Amz-Date=20260507T120000Z" \
              "&X-Amz-Expires=60" \
              "&X-Amz-SignedHeaders=host" \
              "&X-Amz-Signature=fe5f80f77d5fa3beca038a248ff027d0445342fe2855ddc963176630326b1024"
        filtered = LoggingFilter.filter_uri(url)

        # Sensitive params redacted
        expect(filtered).to include("X-Amz-Credential=[FILTERED]")
        expect(filtered).to include("X-Amz-SignedHeaders=[FILTERED]")
        expect(filtered).to include("X-Amz-Signature=[FILTERED]")

        # Operational params preserved (no secret value, useful for log correlation)
        expect(filtered).to include("X-Amz-Algorithm=AWS4-HMAC-SHA256")
        expect(filtered).to include("X-Amz-Date=20260507T120000Z")
        expect(filtered).to include("X-Amz-Expires=60")

        # Raw signature/credential values must not appear anywhere in the output
        expect(filtered).not_to include("fe5f80f77d5fa3beca038a248ff027d0445342fe2855ddc963176630326b1024")
        expect(filtered).not_to include("AKIAIOSFODNN7EXAMPLE")
      end
    end
  end

  describe "filter_params" do
    it "filters sensitive keys" do
      params = {
        access_token: "abcdef",
        api_key: 123
      }
      filtered_params = LoggingFilter.filter_params(params)
      expect(filtered_params).to eq({
                                      access_token: "[FILTERED]",
                                      api_key: "[FILTERED]"
                                    })
    end

    it "filters string or symbol keys" do
      params = {
        :access_token => "abcdef",
        "api_key" => 123
      }
      filtered_params = LoggingFilter.filter_params(params)
      expect(filtered_params).to eq({
                                      :access_token => "[FILTERED]",
                                      "api_key" => "[FILTERED]"
                                    })
    end

    it "filters keys of any case" do
      params = {
        "ApI_KeY" => 123
      }
      filtered_params = LoggingFilter.filter_params(params)
      expect(filtered_params).to eq({
                                      "ApI_KeY" => "[FILTERED]"
                                    })
    end

    it "filters nested keys in string format" do
      params = {
        "pseudonym_session[password]" => 123
      }
      filtered_params = LoggingFilter.filter_params(params)
      expect(filtered_params).to eq({
                                      "pseudonym_session[password]" => "[FILTERED]"
                                    })
    end

    it "filters ested keys in hash format" do
      params = {
        pseudonym_session: {
          password: 123
        }
      }
      filtered_params = LoggingFilter.filter_params(params)
      expect(filtered_params).to eq({
                                      pseudonym_session: {
                                        password: "[FILTERED]"
                                      }
                                    })
    end
  end
end
