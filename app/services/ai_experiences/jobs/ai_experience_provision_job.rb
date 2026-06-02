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

module AiExperiences
  module Jobs
    class AiExperienceProvisionJob
      class << self
        def provision_root_account_for_ai_experiences(root_account, provision_attempt)
          ProvisionService.new.initiate_provisioning(root_account)

          launch_pine_status_job(root_account, provision_attempt)
        rescue LlmConversation::Errors::ConflictError => e
          Rails.logger.info("AiExperienceProvisionJob: root_account #{root_account.uuid} already provisioned: #{e.message}")
        end

        private

        def launch_pine_status_job(root_account, provision_attempt)
          pine_status_attempt = 1

          AiExperienceProvisionStatusJob.delay(
            run_at: INITIAL_STATUS_FETCH_INTERVAL.seconds.from_now,
            singleton: "ai_experience_provision_status:#{root_account.uuid}"
          ).check_provision_status(root_account, provision_attempt, pine_status_attempt, INITIAL_STATUS_FETCH_INTERVAL)
        end
      end
    end
  end
end
