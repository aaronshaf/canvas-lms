# frozen_string_literal: true

#
# Copyright (C) 2016 - present Instructure, Inc.
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

# gergich capture custom:./build/gergich/xsslint:Gergich::XSSLint "yarn lint:xss"
class Gergich::XSSLint
  def run(output)
    # file:line[:col]: [severity:] message
    pattern = /^([^:\n]+):(\d+)(?::\d+)?:\s+(?:\w+:\s+)?(.*)$/

    output.scan(pattern).filter_map do |file, line, error|
      { path: file, message: "[xsslint] #{error}", position: line.to_i, severity: "error" }
    end
  end
end
