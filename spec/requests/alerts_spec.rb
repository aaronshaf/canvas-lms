# frozen_string_literal: true

#
# Copyright (C) 2025 - present Instructure, Inc.
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

describe "AlertsController" do
  describe "POST /accounts/:account_id/alerts" do
    it "creates an alert with the submitted recipients, repetition, and criteria" do
      # Arrange
      account = Account.default
      admin = account_admin_user(account:)
      user_session(admin)

      # Act
      post "/accounts/#{account.id}/alerts",
           params: {
             alert: {
               recipients: [":student", ":teachers"],
               repetition: 1,
               criteria: [
                 { criterion_type: "Interaction", threshold: 7 },
                 { criterion_type: "UngradedCount", threshold: 3 },
                 { criterion_type: "UngradedTimespan", threshold: 7 }
               ]
             }
           }

      # Assert
      expect(response).to have_http_status(:ok)
      alert = account.alerts.last.reload
      expect(alert.recipients).to eq [:student, :teachers]
      expect(alert.repetition).to eql(1) # rubocop:disable RSpec/BeEql -- pin Integer type, not Float
      expect(alert.criteria.find { |c| c.criterion_type == "Interaction" }.threshold).to eql(7.0) # rubocop:disable RSpec/BeEql -- pin Float type, not Integer
      expect(alert.criteria.find { |c| c.criterion_type == "UngradedCount" }.threshold).to eql(3.0) # rubocop:disable RSpec/BeEql -- pin Float type, not Integer
      expect(alert.criteria.find { |c| c.criterion_type == "UngradedTimespan" }.threshold).to eql(7.0) # rubocop:disable RSpec/BeEql -- pin Float type, not Integer
    end
  end

  describe "DELETE /accounts/:account_id/alerts/:id" do
    it "destroys the alert and leaves the account alerts collection empty" do
      # Arrange
      account = Account.default
      admin = account_admin_user(account:)
      alert = account.alerts.create!(
        recipients: [:student, :teachers],
        repetition: 1,
        criteria: [
          { criterion_type: "Interaction", threshold: 1 },
          { criterion_type: "UngradedCount", threshold: 2 },
          { criterion_type: "UngradedTimespan", threshold: 3 }
        ]
      )
      user_session(admin)

      # Act
      delete "/accounts/#{account.id}/alerts/#{alert.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["id"]).to eq(alert.id)
      expect(account.alerts.reload).to be_empty
    end
  end

  describe "PUT /accounts/:account_id/alerts/:id" do
    it "updates the alert thresholds, recipients, and repetition" do
      # Arrange
      account = Account.default
      admin = account_admin_user(account:)
      alert = account.alerts.create!(
        recipients: [:student, :teachers],
        repetition: 1,
        criteria: [
          { criterion_type: "Interaction", threshold: 1 },
          { criterion_type: "UngradedCount", threshold: 2 },
          { criterion_type: "UngradedTimespan", threshold: 3 }
        ]
      )
      user_session(admin)

      # Act
      put "/accounts/#{account.id}/alerts/#{alert.id}",
          params: {
            alert: {
              recipients: [":student"],
              repetition: nil,
              criteria: [
                { criterion_type: "Interaction", threshold: 4 },
                { criterion_type: "UngradedCount", threshold: 5 },
                { criterion_type: "UngradedTimespan", threshold: 6 }
              ]
            }
          }

      # Assert
      expect(response).to have_http_status(:ok)
      alert.reload
      expect(alert.recipients).to eq [:student]
      expect(alert.repetition).to be_nil
      expect(alert.criteria.find { |c| c.criterion_type == "Interaction" }.threshold).to eql(4.0) # rubocop:disable RSpec/BeEql -- pin Float type, not Integer
      expect(alert.criteria.find { |c| c.criterion_type == "UngradedCount" }.threshold).to eql(5.0) # rubocop:disable RSpec/BeEql -- pin Float type, not Integer
      expect(alert.criteria.find { |c| c.criterion_type == "UngradedTimespan" }.threshold).to eql(6.0) # rubocop:disable RSpec/BeEql -- pin Float type, not Integer
    end

    it "removes a custom role recipient when it is omitted from the update" do
      # Arrange
      account = Account.default
      admin = account_admin_user(account:)
      custom_role = custom_account_role("Custom role", account:)
      alert = account.alerts.create!(
        recipients: [{ role_id: custom_role.id }, :student],
        criteria: [{ criterion_type: "Interaction", threshold: 7 }]
      )
      user_session(admin)

      # Act
      put "/accounts/#{account.id}/alerts/#{alert.id}",
          params: { alert: { recipients: [":student"] } }

      # Assert
      expect(response).to have_http_status(:ok)
      alert.reload
      expect(alert.recipients).to eq [:student]
      expect(alert.recipients).not_to include(role_id: custom_role.id)
      expect(alert.recipients).not_to include(custom_role.id)
    end
  end
end
