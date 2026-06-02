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

describe AiExperiences::Jobs::AiExperienceProvisionJob do
  let_once(:root_account) { account_model }
  let(:provision_service) { instance_double(AiExperiences::ProvisionService) }

  before do
    allow(AiExperiences::ProvisionService).to receive(:new).and_return(provision_service)
    allow(provision_service).to receive(:initiate_provisioning)
  end

  describe ".provision_root_account_for_ai_experiences" do
    it "initiates provisioning for the root account" do
      described_class.provision_root_account_for_ai_experiences(root_account, 1)

      expect(provision_service).to have_received(:initiate_provisioning).with(root_account)
    end

    it "schedules check_provision_status with a 60 second delay" do
      expect(AiExperiences::Jobs::AiExperienceProvisionStatusJob).to receive(:delay).with(
        hash_including(run_at: be_within(2.seconds).of(60.seconds.from_now))
      ).and_call_original

      described_class.provision_root_account_for_ai_experiences(root_account, 1)
    end

    it "does not raise when the root account is already provisioned" do
      allow(provision_service).to receive(:initiate_provisioning)
        .and_raise(LlmConversation::Errors::ConflictError, "already provisioned")

      expect { described_class.provision_root_account_for_ai_experiences(root_account, 1) }.not_to raise_error
    end
  end
end
