# frozen_string_literal: true

#
# Copyright (C) 2018 - present Instructure, Inc.
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

require_relative "concerns/advantage_services_shared_context"
require_relative "concerns/advantage_services_shared_examples"
require_relative "concerns/lti_services_shared_examples"

describe Lti::IMS::ResultsController, type: :request do
  include_context "advantage services context"
  include AccountDomainSpecHelper

  def send_request
    course_id = params_overrides[:course_id]
    line_item_id = params_overrides[:line_item_id]
    result_id = params_overrides[:id]
    query_params = params_overrides.except(:course_id, :line_item_id, :id)
    url = if result_id
            "/api/lti/courses/#{course_id}/line_items/#{line_item_id}/results/#{result_id}"
          else
            "/api/lti/courses/#{course_id}/line_items/#{line_item_id}/results"
          end
    auth_headers = access_token_jwt ? { "Authorization" => "Bearer #{access_token_jwt}" } : {}
    get(url, params: query_params, headers: auth_headers)
    run_jobs
  end

  let(:test_request_host) { "www.example.com" }
  let(:assignment) do
    opts = { course:, points_possible: 5 }
    if tool.present?
      opts[:submission_types] = "external_tool"
      opts[:external_tool_tag_attributes] = {
        url: tool.url,
        content_type: "context_external_tool",
        content_id: tool.id
      }
    end
    assignment_model(opts)
  end
  let(:context) { course }
  let(:unknown_context_id) { (Course.maximum(:id) || 0) + 1 }
  let(:json) { response.parsed_body }
  let(:params_overrides) do
    {
      course_id: context_id,
      line_item_id: result.lti_line_item_id
    }
  end
  let(:scope_to_remove) { "https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly" }

  let(:result) do
    lti_result_model(
      assignment:,
      line_item: assignment.line_items.first,
      result_score: 0.5,
      result_maximum: 1
    )
  end

  describe "#index action" do
    let(:action) { :index }

    before do
      3.times do
        lti_result_model(
          line_item: result.line_item,
          assignment:,
          result_score: 0.5,
          result_maximum: 1
        )
      end
    end

    it_behaves_like "advantage services"
    it_behaves_like "lti services"

    it "returns a collection of results" do
      send_request
      expect(json.size).to eq 4
      expect(json.pluck("userId")).to include(result.user.lti_id)
    end

    it "formats the results correctly" do
      send_request
      expect(json.first["id"]).to include("/api/lti/courses/#{course.id}/line_items/#{result.lti_line_item_id}/results/")
    end

    it "uses the Account#domain in the line item id" do
      send_request
      expect(json.first["id"]).to start_with(
        "http://#{HostUrl.context_host}/api/lti/courses/#{course.id}/line_items/"
      )
    end

    context "with user_id in params" do
      let(:params_overrides) { super().merge(user_id: result.user_id) }

      it "returns a single result" do
        send_request
        expect(json.size).to eq 1
      end

      it "returns the user result" do
        send_request
        expect(json.first["userId"]).to eq result.user.lti_id
      end

      context "with user_id being the user's lti_id" do
        let(:params_overrides) { super().merge(user_id: result.user.lti_id) }

        it "returns the user result" do
          send_request
          expect(json.pluck("userId")).to eq [result.user.lti_id]
        end
      end

      context "with non-existent user" do
        let(:params_overrides) { super().merge(user_id: User.maximum(:id) + 1) }

        it "returns an empty array" do
          send_request
          expect(json).to be_empty
        end
      end

      context "with no result for user" do
        let(:params_overrides) { super().merge(user_id: create_users_in_course(course, 1, return_type: :record).first.id) }

        it "returns an empty array" do
          send_request
          expect(json).to be_empty
        end
      end

      context "with user not in course" do
        let(:params_overrides) { super().merge(user_id: student_in_course(course:, active_all: true).user.id) }

        it "returns empty array" do
          send_request
          expect(json).to be_empty
        end
      end

      context "with user not a student" do
        let(:params_overrides) { super().merge(user_id: ta_in_course(course:, active_all: true).user.id) }

        it "returns empty array" do
          send_request
          expect(json).to be_empty
        end
      end
    end

    context "with limit in params" do
      let(:params_overrides) { super().merge(limit: 2) }

      it "honors the limit" do
        send_request
        expect(json.size).to eq 2
      end

      it "provides the pagination headers" do
        send_request
        expect(response.headers["Link"]).to include 'rel="next"'
      end
    end

    context "when the score was manually updated" do
      before do
        submission_ids = Lti::Result.where(line_item: result.line_item).pluck(:submission_id)
        Submission.find(submission_ids).each { |s| s.update!(grader_id: 1) }
      end

      it "scales the resultScore to the resultMaximum" do
        expected_score = result[:result_score] * result.result_maximum / assignment.points_possible.to_f
        send_request
        scaled_result = json.find { |r| r["resultMaximum"] == result.result_maximum }
        expect(scaled_result["resultScore"]).to eql(expected_score)
      end
    end
  end

  describe "#show" do
    let(:params_overrides) { super().merge(id: result.id) }
    let(:action) { :show }

    it_behaves_like "advantage services"
    it_behaves_like "lti services"

    it "returns the result" do
      send_request
      expect(response).to have_http_status :ok
      expect(json["id"]).to end_with("/results/#{result.id}")
    end

    it "includes the scoreMaximum" do
      send_request
      expect(json["resultScore"]).to eql(0.5) # rubocop:disable RSpec/BeEql
    end

    it "formats the result correctly" do
      send_request
      expect(json["id"]).to end_with("/results/#{result.id}")
      expect(json["userId"]).to eq(result.user.lti_id)
    end

    context "when the score was manually updated" do
      before { result.submission.update!(grader_id: 1) }

      it "scales the resultScore to the resultMaximum" do
        expected_score = result[:result_score] * result.result_maximum / assignment.points_possible.to_f
        send_request
        expect(json["resultScore"]).to eql(expected_score)
      end
    end

    context "when result requested not in line_item" do
      let(:params_overrides) { super().merge(id: result.id, line_item_id: line_item_model(assignment:, with_resource_link: true).id) }

      it "returns a 404" do
        send_request
        expect(response).to have_http_status :not_found
      end
    end

    context "when result does not exist" do
      let(:params_overrides) { super().merge(id: result.id + 1) }

      it "returns a 404" do
        send_request
        expect(response).to have_http_status :not_found
      end
    end
  end
end
