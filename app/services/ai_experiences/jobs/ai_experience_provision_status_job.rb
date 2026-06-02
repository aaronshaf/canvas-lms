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
    class AiExperienceProvisionStatusJob
      class << self
        def check_provision_status(root_account, provision_attempt, provision_status_attempt, backoff_delay)
          status = ProvisionService.new.fetch_provision_status(root_account)

          case status
          when "COMPLETED"
            provision_complete(root_account)
          when "FAILED", "DELETED"
            provision_failed(root_account, provision_attempt)
          when "NOT_STARTED", "PENDING", "PROVISIONING_IN_PROGRESS"
            provision_in_progress(root_account, provision_attempt, provision_status_attempt, backoff_delay)
          end
        end

        private

        def provision_complete(root_account)
          root_account.settings[:llm_conversation_service][:provision_complete] = true
          root_account.save!
        end

        def provision_failed(root_account, provision_attempt)
          if provision_attempt < MAX_PROVISION_ATTEMPTS
            relaunch_llm_conversation_provision(root_account, provision_attempt)
          else
            raise AiExperienceProvisionError,
                  "Maximum provision attempts (#{MAX_PROVISION_ATTEMPTS}) reached for root account (#{root_account.uuid})"
          end
        end

        def provision_in_progress(root_account, provision_attempt, provision_status_attempt, backoff_delay)
          if provision_status_attempt < MAX_STATUS_ATTEMPTS
            relaunch_provision_status_check(root_account, provision_attempt, provision_status_attempt, backoff_delay)
          else
            clear_llm_conversation_settings(root_account)

            # Schedule another provision attempt (if allowed)
            if provision_attempt < MAX_PROVISION_ATTEMPTS
              relaunch_llm_conversation_provision(root_account, provision_attempt)
            end

            raise AiExperienceProvisionError, "Provision timed out for root account (#{root_account.uuid})"
          end
        end

        def relaunch_llm_conversation_provision(root_account, provision_attempt)
          provision_attempt += 1

          Jobs::AiExperienceProvisionJob.delay(
            singleton: "ai_experience_provision:#{root_account.uuid}",
            max_attempts: MAX_PROVISION_ATTEMPTS
          ).provision_root_account_for_ai_experiences(root_account, provision_attempt)
        end

        def relaunch_provision_status_check(root_account, provision_attempt, provision_status_attempt, backoff_delay)
          delay = next_backoff_delay(backoff_delay)
          provision_status_attempt += 1

          # Since we cannot sleep in delayed jobs, we will launch another background job to check for provision status
          Jobs::AiExperienceProvisionStatusJob.delay(
            run_at: delay.seconds.from_now,
            singleton: "ai_experience_provision_status:#{root_account.uuid}"
          ).check_provision_status(root_account, provision_attempt, provision_status_attempt, delay)
        end

        def next_backoff_delay(backoff_delay)
          [backoff_delay * 2, MAX_STATUS_FETCH_INTERVAL].min
        end

        def clear_llm_conversation_settings(root_account)
          root_account.settings.delete(:llm_conversation_service)
          root_account.save!
        end
      end
    end
  end
end
