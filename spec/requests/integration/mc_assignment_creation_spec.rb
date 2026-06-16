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
  include NQHelpers

  def create_mc_tool(course)
    course.context_external_tools.create!(
      name: "Mastery Connect",
      consumer_key: "mc_key",
      shared_secret: "mc_secret",
      url: "https://masteryconnect.example.com/launch",
      domain: "masteryconnect.example.com"
    )
  end

  def setup_mc_teacher_course
    teacher_enrollment = course_with_teacher(active_all: true)
    teacher = teacher_enrollment.user
    pseudonym(teacher) # bearer-token auth requires an active pseudonym
    [teacher_enrollment.course, teacher.access_tokens.create!(purpose: "test")]
  end

  def setup_mc_creation_course
    course, token = setup_mc_teacher_course
    [course, create_mc_tool(course), token]
  end

  it "MC assessment added to the tracker creates a Canvas assignment", guid: "4d8e1f5a" do
    # Arrange
    course, tool, token = setup_mc_creation_course

    # Act
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

    # Assert
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

    # Act
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

    # Assert
    expect(response).to have_http_status(:created)

    body = response.parsed_body
    expect(body["published"]).to be(true)

    assignment = course.assignments.find_by(id: body["id"])
    expect(assignment.reload.workflow_state).to eq("published")
  end

  it "item-based or benchmark assessment is created as an unpublished Canvas assignment", guid: "a6f34d82" do
    # Arrange
    course, tool, token = setup_mc_creation_course

    # Act
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

    # Assert
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

    # Act
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

    # Assert
    expect(response).to have_http_status(:created)

    body = response.parsed_body
    expect(body["points_possible"]).to eql(mc_points.to_f)

    assignment = course.assignments.find_by(id: body["id"])
    expect(assignment.reload.points_possible).to eql(mc_points.to_f)
  end

  describe "quiz conversion" do
    it "creates a new Canvas assignment and leaves the original Classic Quiz unchanged", guid: "8d3f2a67" do
      # Arrange
      course, tool, token = setup_mc_creation_course
      classic_quiz = quiz_model(course:, quiz_type: "assignment", title: "Unit 1 Classic Quiz")
      quiz_assignment = classic_quiz.assignment
      original_quiz_state = classic_quiz.workflow_state
      original_assignment_state = quiz_assignment.workflow_state
      original_submission_types = quiz_assignment.submission_types

      # Act
      post "/api/v1/courses/#{course.id}/assignments",
           params: {
             assignment: {
               name: "Unit 1 (Mastery Connect)",
               submission_types: ["external_tool"],
               external_tool_tag_attributes: {
                 url: tool.url,
                 content_type: "ContextExternalTool",
                 content_id: tool.id
               }
             }
           },
           headers: { "Authorization" => "Bearer #{token.full_token}" }

      # Assert
      expect(response).to have_http_status(:created)
      body = response.parsed_body
      expect(body["name"]).to eq("Unit 1 (Mastery Connect)")
      expect(body["submission_types"]).to eq(["external_tool"])
      expect(body["external_tool_tag_attributes"]["url"]).to eq(tool.url)

      mc_assignment = course.assignments.find_by(id: body["id"])
      expect(mc_assignment.id).not_to eq(quiz_assignment.id)
      expect(mc_assignment.external_tool_tag.content).to eq(tool)

      # Assert
      classic_quiz.reload
      quiz_assignment.reload
      expect(classic_quiz.workflow_state).to eq(original_quiz_state)
      expect(quiz_assignment.workflow_state).to eq(original_assignment_state)
      expect(quiz_assignment.submission_types).to eq(original_submission_types)
      expect(quiz_assignment.quiz).to eq(classic_quiz)
      expect(course.assignments.reload).to include(quiz_assignment, mc_assignment)
    end

    it "creates a new Canvas assignment and leaves the original New Quiz unchanged", guid: "f4c91e5b" do
      # Arrange
      course, mc_tool, token = setup_mc_creation_course
      nq_tool = create_nq_tool(course)
      new_quiz = create_nq_external_tool_assignment(course, nq_tool, title: "Unit 2 New Quiz", workflow_state: "published")
      original_quiz_state = new_quiz.workflow_state
      original_submission_types = new_quiz.submission_types

      # Act
      post "/api/v1/courses/#{course.id}/assignments",
           params: {
             assignment: {
               name: "Unit 2 (Mastery Connect)",
               submission_types: ["external_tool"],
               external_tool_tag_attributes: {
                 url: mc_tool.url,
                 content_type: "ContextExternalTool",
                 content_id: mc_tool.id
               }
             }
           },
           headers: { "Authorization" => "Bearer #{token.full_token}" }

      # Assert
      expect(response).to have_http_status(:created)
      body = response.parsed_body
      expect(body["name"]).to eq("Unit 2 (Mastery Connect)")
      expect(body["submission_types"]).to eq(["external_tool"])
      expect(body["external_tool_tag_attributes"]["url"]).to eq(mc_tool.url)

      mc_assignment = course.assignments.find_by(id: body["id"])
      expect(mc_assignment.id).not_to eq(new_quiz.id)
      expect(mc_assignment.external_tool_tag.content).to eq(mc_tool)

      # Assert
      new_quiz.reload
      expect(new_quiz.workflow_state).to eq(original_quiz_state)
      expect(new_quiz.submission_types).to eq(original_submission_types)
      expect(new_quiz.external_tool_tag.content).to eq(nq_tool)
      expect(course.assignments.reload).to include(new_quiz, mc_assignment)
    end

    it "binds a pre-existing assessment's assignment to the MC tool resolved from its launch URL", guid: "c3d56a92" do
      # Arrange
      course, token = setup_mc_teacher_course
      course.context_external_tools.create!(
        name: "Unrelated Tool",
        consumer_key: "other_key",
        shared_secret: "other_secret",
        url: "https://other-tool.example.com/launch",
        domain: "other-tool.example.com"
      )
      mc_tool = create_mc_tool(course)
      assessment_launch_url = "https://masteryconnect.example.com/assessments/pre-existing-9281"

      # Act
      post "/api/v1/courses/#{course.id}/assignments",
           params: {
             assignment: {
               name: "Pre-existing MC Assessment",
               submission_types: ["external_tool"],
               external_tool_tag_attributes: { url: assessment_launch_url }
             }
           },
           headers: { "Authorization" => "Bearer #{token.full_token}" }

      # Assert
      expect(response).to have_http_status(:created)
      body = response.parsed_body
      expect(body["name"]).to eq("Pre-existing MC Assessment")
      expect(body["submission_types"]).to eq(["external_tool"])

      assignment = course.assignments.find_by(id: body["id"])
      expect(assignment.external_tool_tag.url).to eq(assessment_launch_url)
      expect(assignment.external_tool_tag.content).to eq(mc_tool)
    end
  end
end
