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

class AddEmailChangeAlertNotifications < ActiveRecord::Migration[8.0]
  tag :predeploy

  NOTIFICATION_NAMES = [
    "Default Email Address Changed",
    "New Email Address Added",
    "Email Address Removed",
  ].freeze

  def up
    return unless Shard.current.default? && !::Rails.env.test?

    NOTIFICATION_NAMES.each do |name|
      Canvas::MessageHelper.create_notification({
                                                  name:,
                                                  delay_for: 0,
                                                  category: "Registration",
                                                  priority: true
                                                })
    end
  end

  def down
    return unless Shard.current.default?

    Notification.where(name: NOTIFICATION_NAMES).delete_all
  end
end
