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

# Shared builders for Rollcall (Attendance) grade-passback request specs
# (spec/requests/integration/rc_*_spec.rb). Rollcall posts attendance grades
# back through the Canvas REST submissions API as a `basic_lti_launch`
# submission, so these construct the external tool and the external-tool
# attendance assignment that passback targets.
module RollcallPassbackHelpers
  def create_rollcall_tool(course)
    course.context_external_tools.create!(
      name: "Attendance",
      consumer_key: "rollcall_key",
      shared_secret: "rollcall_secret",
      url: "https://rollcall.example.com/launch",
      domain: "rollcall.example.com"
    )
  end

  def create_attendance_assignment(course, tool)
    course.assignments.create!(
      title: "Roll Call Attendance",
      grading_type: "percent",
      points_possible: 100,
      submission_types: "external_tool",
      external_tool_tag_attributes: {
        url: tool.url,
        content_type: "ContextExternalTool",
        content_id: tool.id
      }
    )
  end
end
