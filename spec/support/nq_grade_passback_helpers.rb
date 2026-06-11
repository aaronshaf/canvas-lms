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

# Builders for the New Quizzes LTI 1.1 grade-passback request specs
# (nq_grade_passback_spec.rb, nq_grade_passback_controls_spec.rb). On top of the
# tool, assignment, and submission fixtures shared with the other NQ clusters in
# NQHelpers, this adds the signed POX replaceResult request and the
# passback-response assertion.
require_relative "nq_helpers"

module NQGradePassbackHelpers
  include NQHelpers

  def create_nq_assignment(course, tool, title:, points_possible: 100)
    create_nq_external_tool_assignment(course, tool, title:, points_possible:)
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

  # A pre-existing graded passback submission to replace: the shared seeder pins
  # the launch url, marks it posted with a grade matching the current submission,
  # and back-dates it so a later passback reads as the newer attempt.
  def seed_existing_submission(assignment:, user:, tool:, launch_url:, score:, workflow_state: "graded")
    seed_nq_submission(
      assignment:,
      user:,
      tool:,
      score:,
      url: launch_url,
      submitted_at: 2.hours.ago,
      workflow_state:,
      posted: true,
      grade_matches: true
    )
  end
end
