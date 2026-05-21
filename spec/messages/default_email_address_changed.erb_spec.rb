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

require_relative "messages_helper"

describe "default_email_address_changed" do
  before :once do
    user_factory
    @object = communication_channel(@user, { username: "previous@example.com", active_cc: true })
  end

  let(:asset) { @object }
  let(:notification_name) { :default_email_address_changed }
  let(:message_data) { { data: { new_default_path: "newdefault@example.com" } } }

  it_behaves_like "a message"
end
