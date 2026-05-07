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

module SqlQueryCounter
  def count_sql_queries(matcher: nil, &)
    count = 0
    counter = lambda do |_name, _start, _finish, _id, payload|
      next if %w[SCHEMA CACHE].include?(payload[:name])
      next if matcher && !payload[:sql].to_s.match?(matcher)

      count += 1
    end
    ActiveSupport::Notifications.subscribed(counter, "sql.active_record", &)
    count
  end
end

RSpec.configure do |config|
  config.include SqlQueryCounter
end
