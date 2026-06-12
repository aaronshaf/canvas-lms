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

require "spec_helper"

# When a Mastery Connect assessment is added to a linked tracker, mc-mothership
# creates the corresponding Canvas assignment by calling the Canvas REST
# Assignments API — POST /api/v1/courses/:cid/assignments — authenticated as the
# teacher's Bearer token. The assessment is launched through MC, so the Canvas
# assignment is created as an external_tool submission pointing at the MC tool
# (see mc-mothership Lms::Canvas::AssignmentSerializer; same tool wiring the
# passback tests in mc_grade_passback_spec.rb exercise).
#
# These tests cover only the Canvas-side creation contract: the same plain
# Assignments API POST mc-mothership makes. The assessment-type -> publish-state
# mapping (raw score published, item-based/benchmark unpublished) is mc-mothership
# logic and is not observable here; what Canvas guarantees is that it honors the
# published flag and points_possible the caller sends.
describe "Mastery Connect Assignment Creation" do
  def create_mc_tool(course)
    course.context_external_tools.create!(
      name: "Mastery Connect",
      consumer_key: "mc_key",
      shared_secret: "mc_secret",
      url: "https://masteryconnect.example.com/launch",
      domain: "masteryconnect.example.com"
    )
  end

  # The world every MC creation test shares: a course with a linked Mastery
  # Connect tool and a teacher who creates assignments through a Bearer token
  # (mc-mothership acts as the teacher). Returns [course, tool, token].
  def setup_mc_creation_course
    teacher_enrollment = course_with_teacher(active_all: true)
    teacher = teacher_enrollment.user
    pseudonym(teacher) # bearer-token auth requires an active pseudonym
    course = teacher_enrollment.course
    token = teacher.access_tokens.create!(purpose: "test")
    [course, create_mc_tool(course), token]
  end

  it "MC assessment added to the tracker creates a Canvas assignment", guid: "4d8e1f5a" do
    # Arrange
    course, tool, token = setup_mc_creation_course

    # Act — mc-mothership creates the Canvas assignment for the new MC assessment.
    post "/api/v1/courses/#{course.id}/assignments",
         params: {
           assignment: {
             name: "MC Assessment",
             submission_types: ["external_tool"],
             external_tool_tag_attributes: {
               url: tool.url,
               content_type: "ContextExternalTool",
               content_id: tool.id
             }
           }
         },
         headers: { "Authorization" => "Bearer #{token.full_token}" }

    # Assert — Canvas creates the assignment and returns it.
    expect(response).to have_http_status(:created)

    body = response.parsed_body
    expect(body["name"]).to eq("MC Assessment")
    expect(body["submission_types"]).to eq(["external_tool"])
    expect(body["external_tool_tag_attributes"]["url"]).to eq(tool.url)

    assignment = course.assignments.find_by(id: body["id"])
    expect(course.assignments.reload).to include(assignment)
    expect(assignment.external_tool_tag.content).to eq(tool)
  end

  it "raw score assessment is created as a published Canvas assignment", guid: "2c5b9e73" do
    # Arrange
    course, tool, token = setup_mc_creation_course

    # Act — a raw-score MC assessment: mc-mothership sends published:true so the
    # assignment is immediately visible to students.
    post "/api/v1/courses/#{course.id}/assignments",
         params: {
           assignment: {
             name: "MC Raw Score Assessment",
             published: true,
             submission_types: ["external_tool"],
             external_tool_tag_attributes: {
               url: tool.url,
               content_type: "ContextExternalTool",
               content_id: tool.id
             }
           }
         },
         headers: { "Authorization" => "Bearer #{token.full_token}" }

    # Assert — Canvas honors published:true and persists the assignment published.
    expect(response).to have_http_status(:created)

    body = response.parsed_body
    expect(body["published"]).to be(true)

    assignment = course.assignments.find_by(id: body["id"])
    expect(assignment.reload.workflow_state).to eq("published")
  end

  it "item-based or benchmark assessment is created as an unpublished Canvas assignment", guid: "a6f34d82" do
    # Arrange
    course, tool, token = setup_mc_creation_course

    # Act — an item-based/benchmark MC assessment: mc-mothership sends
    # published:false so the teacher controls when it is released to students.
    post "/api/v1/courses/#{course.id}/assignments",
         params: {
           assignment: {
             name: "MC Item-Based Assessment",
             published: false,
             submission_types: ["external_tool"],
             external_tool_tag_attributes: {
               url: tool.url,
               content_type: "ContextExternalTool",
               content_id: tool.id
             }
           }
         },
         headers: { "Authorization" => "Bearer #{token.full_token}" }

    # Assert — Canvas honors published:false and persists the assignment unpublished.
    expect(response).to have_http_status(:created)

    body = response.parsed_body
    expect(body["published"]).to be(false)

    assignment = course.assignments.find_by(id: body["id"])
    expect(assignment.reload.workflow_state).to eq("unpublished")
  end

  it "MC assessment points_possible is inherited by the Canvas assignment", guid: "1b7e4c09" do
    # Arrange
    course, tool, token = setup_mc_creation_course
    mc_points = 25

    # Act — mc-mothership sends the MC assessment's points value so the Canvas
    # assignment matches it; mismatched values break gradebook math.
    post "/api/v1/courses/#{course.id}/assignments",
         params: {
           assignment: {
             name: "MC Points Assessment",
             points_possible: mc_points,
             submission_types: ["external_tool"],
             external_tool_tag_attributes: {
               url: tool.url,
               content_type: "ContextExternalTool",
               content_id: tool.id
             }
           }
         },
         headers: { "Authorization" => "Bearer #{token.full_token}" }

    # Assert — Canvas stores the points_possible the caller sent (as a Float).
    expect(response).to have_http_status(:created)

    body = response.parsed_body
    expect(body["points_possible"]).to eql(mc_points.to_f)

    assignment = course.assignments.find_by(id: body["id"])
    expect(assignment.reload.points_possible).to eql(mc_points.to_f)
  end
end
