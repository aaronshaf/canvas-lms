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

# Shared builders for Mastery Connect grade-passback request specs
# (spec/requests/integration/mc_*_spec.rb). mc-mothership posts scores back
# through the Canvas REST submissions API as a `basic_lti_launch` submission and
# manages assignments through the Assignments API, all as the teacher's Bearer
# token. These construct the external tool, the external-tool assessment
# assignment passback targets, and the teacher/token world every MC spec shares.
module MCPassbackHelpers
  def create_mc_tool(course)
    course.context_external_tools.create!(
      name: "Mastery Connect",
      consumer_key: "mc_key",
      shared_secret: "mc_secret",
      url: "https://masteryconnect.example.com/launch",
      domain: "masteryconnect.example.com"
    )
  end

  def create_mc_assignment(course, tool, workflow_state: "published", due_at: nil, title: "MC Assessment")
    course.assignments.create!(
      title:,
      grading_type: "points",
      points_possible: 100,
      due_at:,
      submission_types: "external_tool",
      workflow_state:,
      external_tool_tag_attributes: {
        url: tool.url,
        content_type: "ContextExternalTool",
        content_id: tool.id
      }
    )
  end

  # The world every MC passback test shares: a course with a linked Mastery
  # Connect tool and a teacher who acts through a Bearer token (mc-mothership
  # acts as the teacher). Returns [course, tool, token, teacher].
  def setup_mc_passback_course
    teacher_enrollment = course_with_teacher(active_all: true)
    teacher = teacher_enrollment.user
    pseudonym(teacher) # bearer-token auth requires an active pseudonym
    course = teacher_enrollment.course
    token = teacher.access_tokens.create!(purpose: "test")
    [course, create_mc_tool(course), token, teacher]
  end
end
