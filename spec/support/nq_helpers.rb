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

# Builders shared by every New Quizzes request-spec cluster (anonymous/survey,
# availability/timing, grade-passback). Each cluster's own *_helpers.rb includes
# this module and layers its cluster-specific configuration on top of these
# common fixtures, so the shape of "an NQ tool", "an NQ external-tool
# assignment", and "the basic_lti_launch submission a student records" lives in
# one place.
module NQHelpers
  # The canonical "Quizzes 2" tool registration, matched by domain. Clusters that
  # need a tool registered differently (e.g. availability/timing, which adds
  # date-expanding custom fields) override this with their own registration.
  def create_nq_tool(course)
    course.context_external_tools.create!(
      name: "Quizzes 2",
      consumer_key: "test_key",
      shared_secret: "test_secret",
      tool_id: "Quizzes 2",
      domain: "quizzes.example.com"
    )
  end

  # A published external-tool assignment whose tag points back at the NQ tool —
  # the Canvas-side stand-in for a New Quizzes quiz. Extra assignment attributes
  # (date constraints, etc.) pass straight through via **attrs.
  def create_nq_external_tool_assignment(course, tool, title:, points_possible: 100, launch_url: "https://quizzes.example.com/launch", **attrs)
    course.assignments.create!(
      {
        title:,
        submission_types: "external_tool",
        points_possible:,
        grading_type: "points",
        workflow_state: "published",
        external_tool_tag_attributes: {
          url: launch_url,
          content_type: "ContextExternalTool",
          content_id: tool.id
        }
      }.merge(attrs)
    )
  end

  # The submission a student produces by taking the quiz/survey through New
  # Quizzes: a basic_lti_launch submission against the external-tool assignment.
  # When a score is supplied the grade is attributed to the tool (negative
  # grader_id), the same way a New Quizzes passback records an auto-graded score.
  # The launch url defaults to a per-student NQ session url; pass +url+ to pin
  # an exact launch url, +posted+/+grade_matches+ to mark a posted, current grade.
  def seed_nq_submission(assignment:, user:, tool:, score: nil, url: nil, submitted_at: 1.hour.ago, workflow_state: nil, posted: false, grade_matches: false)
    submission = Submission.find_or_initialize_by(assignment:, user:)
    submission.submission_type = "basic_lti_launch"
    submission.submitted_at = submitted_at
    submission.url = url || "https://quizzes.example.com/session/#{user.id}"
    submission.workflow_state = workflow_state || (score ? "graded" : "submitted")
    if score
      submission.score = score
      submission.grade = score.to_s
      submission.grader_id = -tool.id
    end
    submission.posted_at = submitted_at if posted
    submission.grade_matches_current_submission = true if grade_matches
    submission.with_versioning(explicit: true) { submission.save! }
    submission
  end
end
