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

# Shared builders for New Quizzes LTI 1.1 grade-passback request specs
# (spec/requests/integration/nq_*_spec.rb). These construct the NQ external
# tool, an external-tool assignment, the signed POX replaceResult request, and
# assert on the passback response.
module NQGradePassbackHelpers
  def create_nq_tool(course)
    course.context_external_tools.create!(
      name: "Quizzes 2",
      consumer_key: "test_key",
      shared_secret: "test_secret",
      tool_id: "Quizzes 2",
      domain: "quizzes.example.com"
    )
  end

  def create_nq_assignment(course, tool, title:, points_possible: 100)
    course.assignments.create!(
      title:,
      submission_types: "external_tool",
      points_possible:,
      grading_type: "points",
      workflow_state: "published",
      external_tool_tag_attributes: {
        url: "https://quizzes.example.com/launch",
        content_type: "ContextExternalTool",
        content_id: tool.id
      }
    )
  end

  def nq_source_id(tool, course, assignment, user)
    payload = [tool.id, course.id, assignment.id, user.id].join("-")
    "#{payload}-#{Canvas::Security.hmac_sha1(payload, tool.shard.settings[:encryption_key])}"
  end

  def nq_replace_result_xml(source_id:, score:, launch_url:, submitted_at:, prioritize_non_tool_grade: false)
    prioritize_element = prioritize_non_tool_grade ? "<prioritizeNonToolGrade/>" : ""
    <<~XML
      <?xml version="1.0" encoding="UTF-8"?>
      <imsx_POXEnvelopeRequest xmlns="http://www.imsglobal.org/services/ltiv1p1/xsd/imsoms_v1p0">
        <imsx_POXHeader>
          <imsx_POXRequestHeaderInfo>
            <imsx_version>V1.0</imsx_version>
            <imsx_messageIdentifier>#{SecureRandom.uuid}</imsx_messageIdentifier>
          </imsx_POXRequestHeaderInfo>
        </imsx_POXHeader>
        <imsx_POXBody>
          <replaceResultRequest>
            <resultRecord>
              <sourcedGUID>
                <sourcedId>#{source_id}</sourcedId>
              </sourcedGUID>
              <result>
                <resultScore>
                  <language>en</language>
                  <textString>#{score}</textString>
                </resultScore>
                <resultData>
                  <url>#{launch_url}</url>
                </resultData>
              </result>
            </resultRecord>
            <submissionDetails>
              <submittedAt>#{submitted_at}</submittedAt>
              #{prioritize_element}
            </submissionDetails>
          </replaceResultRequest>
        </imsx_POXBody>
      </imsx_POXEnvelopeRequest>
    XML
  end

  def nq_grade_passback(tool, xml_body)
    path = "/api/lti/v1/tools/#{tool.id}/grade_passback"
    consumer = OAuth::Consumer.new(
      tool.consumer_key,
      tool.shared_secret,
      site: "https://www.example.com",
      signature_method: "HMAC-SHA1"
    )
    signed = consumer.create_signed_request(:post, path, nil, scheme: "header")
    post "https://www.example.com#{path}",
         params: xml_body,
         headers: {
           "CONTENT_TYPE" => "application/xml",
           "HTTP_AUTHORIZATION" => signed["Authorization"]
         }
  end

  def assert_successful_passback
    expect(response).to have_http_status(:ok)
    response_xml = Nokogiri::XML.parse(response.body)
    expect(response_xml.at_css("imsx_codeMajor").content).to eq("success")
  end

  def seed_existing_submission(assignment:, user:, tool:, launch_url:, score:, workflow_state: "graded")
    submission = Submission.find_or_initialize_by(assignment:, user:)
    submission.submission_type = "basic_lti_launch"
    submission.submitted_at = 2.hours.ago
    submission.url = launch_url
    submission.grade = score.to_s
    submission.score = score
    submission.grader_id = -tool.id
    submission.workflow_state = workflow_state
    submission.posted_at = submission.submitted_at
    submission.grade_matches_current_submission = true
    submission.with_versioning(explicit: true) { submission.save! }
    submission
  end
end
