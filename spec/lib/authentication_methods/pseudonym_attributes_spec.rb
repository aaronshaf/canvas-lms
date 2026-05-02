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

describe AuthenticationMethods::PseudonymAttributes do
  describe "#load_from" do
    let(:session) { {} }

    before do
      described_class.reset
    end

    context "when login_aac is present" do
      before do
        session["login_aac"] = 10_000_000_000_001
      end

      it "loads auth_provider_id" do
        described_class.load_from(session)
        expect(described_class.auth_provider_id).to be 10_000_000_000_001
      end

      it "logs the loaded attributes" do
        expect(Rails.logger).to receive(:info).with("[AUTH] Loaded pseudonym attributes: auth_provider_id")
        described_class.load_from(session)
      end
    end

    context "when login_aac is missing" do
      it "leaves auth_provider_id nil" do
        described_class.load_from(session)
        expect(described_class.auth_provider_id).to be_nil
      end

      it "does not log" do
        expect(Rails.logger).not_to receive(:info)
        described_class.load_from(session)
      end
    end

    context "when login_aac is blank" do
      it "leaves auth_provider_id nil for empty string" do
        session["login_aac"] = ""
        described_class.load_from(session)
        expect(described_class.auth_provider_id).to be_nil
      end

      it "leaves auth_provider_id nil for explicit nil" do
        session["login_aac"] = nil
        described_class.load_from(session)
        expect(described_class.auth_provider_id).to be_nil
      end

      it "does not log when blank" do
        session["login_aac"] = ""
        expect(Rails.logger).not_to receive(:info)
        described_class.load_from(session)
      end
    end
  end
end
