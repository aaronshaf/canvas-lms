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
module CanvasOperations
  def self.registered_operations
    []
  end

  def self.find(id)
    id = id.to_s if id.is_a? Symbol

    unless id.is_a? String
      raise ArgumentError, "Could not lookup operation by identifier `#{id}`. Provide a string or symbol"
    end

    registered_operations.find { it.operation_name == id }
  end
end
