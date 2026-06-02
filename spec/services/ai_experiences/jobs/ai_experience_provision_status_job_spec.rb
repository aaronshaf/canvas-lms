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

describe AiExperiences::Jobs::AiExperienceProvisionStatusJob do
  let_once(:root_account) { account_model }
  let(:provision_service) { instance_double(AiExperiences::ProvisionService) }

  before do
    allow(AiExperiences::ProvisionService).to receive(:new).and_return(provision_service)
  end

  describe ".check_provision_status" do
    context "when provision status is COMPLETED" do
      before { allow(provision_service).to receive(:fetch_provision_status).and_return("COMPLETED") }

      it "marks provision as complete in account settings" do
        root_account.settings[:llm_conversation_service] = {}
        described_class.check_provision_status(root_account, 0, 0, 60)

        expect(root_account.settings[:llm_conversation_service][:provision_complete]).to be true
      end

      it "persists the account settings update" do
        root_account.settings[:llm_conversation_service] = {}
        described_class.check_provision_status(root_account, 0, 0, 60)
        root_account.reload

        expect(root_account.settings[:llm_conversation_service][:provision_complete]).to be true
      end

      it "does not schedule any follow-up jobs" do
        root_account.settings[:llm_conversation_service] = {}
        expect(described_class).not_to receive(:delay)
        expect(AiExperiences::Jobs::AiExperienceProvisionJob).not_to receive(:delay)

        described_class.check_provision_status(root_account, 0, 0, 60)
      end
    end

    shared_examples "a failed provision status" do
      it "relaunches the provision job when under the attempt limit" do
        expect(AiExperiences::Jobs::AiExperienceProvisionJob).to receive(:delay).with(
          hash_including(singleton: "ai_experience_provision:#{root_account.uuid}")
        ).and_call_original

        described_class.check_provision_status(root_account, 0, 0, 60)
      end

      it "increments the provision attempt when relaunching" do
        allow(AiExperiences::Jobs::AiExperienceProvisionJob).to receive(:delay).and_call_original
        expect(AiExperiences::Jobs::AiExperienceProvisionJob).to receive(:delay).with(
          hash_including(max_attempts: AiExperiences::MAX_PROVISION_ATTEMPTS)
        ).and_call_original

        described_class.check_provision_status(root_account, 0, 0, 60)
      end

      it "raises AiExperienceProvisionError when max provision attempts are reached" do
        expect do
          described_class.check_provision_status(root_account, AiExperiences::MAX_PROVISION_ATTEMPTS, 0, 60)
        end.to raise_error(AiExperiences::AiExperienceProvisionError, /Maximum provision attempts/)
      end

      it "includes the account uuid in the error message" do
        expect do
          described_class.check_provision_status(root_account, AiExperiences::MAX_PROVISION_ATTEMPTS, 0, 60)
        end.to raise_error(AiExperiences::AiExperienceProvisionError, /#{root_account.uuid}/)
      end

      it "does not schedule any jobs when max provision attempts are reached" do
        expect(AiExperiences::Jobs::AiExperienceProvisionJob).not_to receive(:delay)

        expect do
          described_class.check_provision_status(root_account, AiExperiences::MAX_PROVISION_ATTEMPTS, 0, 60)
        end.to raise_error(AiExperiences::AiExperienceProvisionError)
      end
    end

    shared_examples "an in-progress provision status" do
      it "relaunches the status check job when under the attempt limit" do
        expect(described_class).to receive(:delay).with(
          hash_including(singleton: "ai_experience_provision_status:#{root_account.uuid}")
        ).and_call_original

        described_class.check_provision_status(root_account, 0, 0, 60)
      end

      it "doubles the backoff delay on relaunch" do
        expect(described_class).to receive(:delay).with(
          hash_including(run_at: be_within(2.seconds).of(120.seconds.from_now))
        ).and_call_original

        described_class.check_provision_status(root_account, 0, 0, 60)
      end

      it "caps the backoff delay at MAX_STATUS_FETCH_INTERVAL" do
        max_interval = AiExperiences::MAX_STATUS_FETCH_INTERVAL
        expect(described_class).to receive(:delay).with(
          hash_including(run_at: be_within(2.seconds).of(max_interval.seconds.from_now))
        ).and_call_original

        described_class.check_provision_status(root_account, 0, 0, max_interval)
      end

      context "when max status attempts are reached" do
        before do
          root_account.settings[:llm_conversation_service] = { encrypted_api_jwt_token: "test" }
          root_account.save!
        end

        it "clears the llm_conversation_service account settings" do
          expect do
            described_class.check_provision_status(root_account, 0, AiExperiences::MAX_STATUS_ATTEMPTS, 60)
          end.to raise_error(AiExperiences::AiExperienceProvisionError)

          root_account.reload
          expect(root_account.settings[:llm_conversation_service]).to be_nil
        end

        it "raises AiExperienceProvisionError with a timed out message" do
          expect do
            described_class.check_provision_status(root_account, 0, AiExperiences::MAX_STATUS_ATTEMPTS, 60)
          end.to raise_error(AiExperiences::AiExperienceProvisionError, /timed out/)
        end

        it "relaunches the provision job when under the provision attempt limit" do
          expect(AiExperiences::Jobs::AiExperienceProvisionJob).to receive(:delay).and_call_original

          expect do
            described_class.check_provision_status(root_account, 0, AiExperiences::MAX_STATUS_ATTEMPTS, 60)
          end.to raise_error(AiExperiences::AiExperienceProvisionError)
        end

        it "does not relaunch provision when at the provision attempt limit" do
          expect(AiExperiences::Jobs::AiExperienceProvisionJob).not_to receive(:delay)

          expect do
            described_class.check_provision_status(
              root_account,
              AiExperiences::MAX_PROVISION_ATTEMPTS,
              AiExperiences::MAX_STATUS_ATTEMPTS,
              60
            )
          end.to raise_error(AiExperiences::AiExperienceProvisionError)
        end

        it "does not relaunch the status check job" do
          expect(described_class).not_to receive(:delay)

          expect do
            described_class.check_provision_status(root_account, 0, AiExperiences::MAX_STATUS_ATTEMPTS, 60)
          end.to raise_error(AiExperiences::AiExperienceProvisionError)
        end
      end
    end

    context "when provision status is FAILED" do
      before { allow(provision_service).to receive(:fetch_provision_status).and_return("FAILED") }

      it_behaves_like "a failed provision status"
    end

    context "when provision status is DELETED" do
      before { allow(provision_service).to receive(:fetch_provision_status).and_return("DELETED") }

      it_behaves_like "a failed provision status"
    end

    context "when provision status is NOT_STARTED" do
      before { allow(provision_service).to receive(:fetch_provision_status).and_return("NOT_STARTED") }

      it_behaves_like "an in-progress provision status"
    end

    context "when provision status is PENDING" do
      before { allow(provision_service).to receive(:fetch_provision_status).and_return("PENDING") }

      it_behaves_like "an in-progress provision status"
    end

    context "when provision status is PROVISIONING_IN_PROGRESS" do
      before { allow(provision_service).to receive(:fetch_provision_status).and_return("PROVISIONING_IN_PROGRESS") }

      it_behaves_like "an in-progress provision status"
    end
  end
end
