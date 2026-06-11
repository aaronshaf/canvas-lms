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

# Builders for the New Quizzes anonymous/survey request specs
# (nq_anonymous_survey_spec.rb). On top of the tool, external-tool assignment,
# and submission fixtures shared with the other NQ clusters in NQHelpers, this
# adds create_nq_survey, which configures the assignment as a New Quizzes survey.
#
# Cross-service contract: New Quizzes marks a survey anonymous by setting
# settings["new_quizzes"]["anonymous_participants"] on the Canvas assignment
# (anonymous_participants? / new_quizzes_anonymous_participants?). This is
# DISTINCT from the generic anonymous_grading column. Canvas must honor that
# NQ-specific flag everywhere it would otherwise reveal who submitted — here,
# the submissions API.
#
# The tool, external-tool assignment, and submission shapes are shared with the
# other NQ clusters in NQHelpers; this module only adds the survey-specific
# anonymity configuration.
require_relative "nq_helpers"

module NQAnonymousSurveyHelpers
  include NQHelpers

  def create_nq_survey(course, tool, title: "NQ Survey", points_possible: 10, anonymous: false)
    assignment = create_nq_external_tool_assignment(course, tool, title:, points_possible:)
    # Makes the fixture a genuine NQ graded survey rather than the default
    # graded quiz. Not asserted on — the anonymity behavior under test is driven
    # solely by anonymous_participants below — but keeps the survey cluster's
    # fixtures faithful to what they represent.
    assignment.new_quizzes_type = "graded_survey"
    assignment.anonymous_participants = anonymous
    assignment.save!
    assignment
  end
end
