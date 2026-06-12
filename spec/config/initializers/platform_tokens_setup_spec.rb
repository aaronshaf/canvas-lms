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

describe PlatformTokensSetup do
  # Pre-computed 512-bit RSA JWK — avoids key generation cost, sufficient for wiring tests
  let(:present_key) do
    JSON::JWK.new(
      "kty" => "RSA",
      "e" => "AQAB",
      "n" => "uX1MpfEMQCBUMcj0sBYI-iFaG5Nodp3C6OlN8uY60fa5zSBd83-iIL3n_qzZ8VCluuTLfB7rrV_tiX727XIEqQ",
      "kid" => "2018-07-18T22:33:20Z_c",
      "d" => "pYwR64x-LYFtA13iHIIeEvfPTws50ZutyGfpHN-kIZz3k-xVpun2Hgu0hVKZMxcZJ9DkG8UZPqD-zTDbCmCyLQ",
      "p" => "6OQ2bi_oY5fE9KfQOcxkmNhxDnIKObKb6TVYqOOz2JM",
      "q" => "y-UBef95njOrqMAxJH1QPds3ltYWr8QgGgccmcATH1M",
      "dp" => "Ol_xkL7rZgNFt_lURRiJYpJmDDPjgkDVuafIeFTS4Ic",
      "dq" => "RtzDY5wXr5TzrwWEztLCpYzfyAuF_PZj1cfs976apsM",
      "qi" => "XA5wnwIrwe5MwXpaBijZsGhKJoypZProt47aVCtWtPE"
    )
  end

  before do
    PlatformTokens.send(:configuration_data=, nil)
    allow(Canvas).to receive(:region).and_return("us-east-1")
    allow(CanvasSecurity::ServicesJwt::KeyStorage).to receive(:present_key).and_return(present_key)
  end

  after { PlatformTokens.send(:configuration_data=, nil) }

  describe ".configure!" do
    it "configures PlatformTokens with values from Canvas and CanvasSecurity" do
      described_class.configure!

      config = PlatformTokens.configuration
      expect(config.env).to eql(Canvas.environment)
      expect(config.iss).to eql(CanvasSecurity.services_issuer)
      expect(config.region).to eql(Canvas.region)
      expect(config.signing_key).to be(present_key)
    end

    context "when Canvas.region is nil" do
      before do
        allow(Canvas).to receive_messages(region: nil, environment: "beta")
      end

      it "falls back to Canvas.environment for the region" do
        described_class.configure!

        expect(PlatformTokens.configuration.region).to eql("beta")
      end
    end
  end
end
