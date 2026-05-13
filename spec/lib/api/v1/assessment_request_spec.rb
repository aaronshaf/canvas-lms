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
#

describe "Api::V1::AssessmentRequest" do
  include Api::V1::AssessmentRequest

  before(:once) do
    course_with_teacher(active_all: true)
    @assessee = User.create!(name: "Assessee")
    @assessor = User.create!(name: "Assessor")
    @course.enroll_student(@assessee, enrollment_state: "active")
    @course.enroll_student(@assessor, enrollment_state: "active")
    @assignment = @course.assignments.create!(
      name: "Peer Review Assignment",
      peer_reviews: true,
      points_possible: 10
    )
    @submission = @assignment.grade_student(@assessee, score: 8, grader: @teacher).first
    @assessment_request = @assignment.assign_peer_review(@assessor, @assessee)
    @context = @course
  end

  before do
    allow(self).to receive(:user_display_json) { |u, _ctx| { "id" => u.id } }
  end

  def session
    {}
  end

  describe "#assessment_request_json" do
    context "when anonymous peer reviews are disabled" do
      it "includes user_id for any caller" do
        json = assessment_request_json(@assessment_request, @assessor, session)
        expect(json["user_id"]).to eq @assessee.id
      end

      it "includes user hash when requested by assessor" do
        json = assessment_request_json(@assessment_request, @assessor, session, Set.new(["user"]))
        expect(json["user"]).to be_present
        expect(json["user"]["id"]).to eq @assessee.id
      end

      it "includes user hash when requested by teacher" do
        json = assessment_request_json(@assessment_request, @teacher, session, Set.new(["user"]))
        expect(json["user"]).to be_present
        expect(json["user"]["id"]).to eq @assessee.id
      end
    end

    context "when anonymous peer reviews are enabled" do
      before(:once) { @assignment.update_attribute(:anonymous_peer_reviews, true) }

      it "omits user_id for the assessor (reviewer)" do
        json = assessment_request_json(@assessment_request, @assessor, session)
        expect(json.key?("user_id")).to be false
      end

      it "omits user hash for the assessor when user include requested" do
        json = assessment_request_json(@assessment_request, @assessor, session, Set.new(["user"]))
        expect(json.key?("user")).to be false
      end

      it "includes user_id for the assessee (self-exemption)" do
        json = assessment_request_json(@assessment_request, @assessee, session)
        expect(json["user_id"]).to eq @assessee.id
      end

      it "includes user hash for the assessee when user include requested (self-exemption)" do
        json = assessment_request_json(@assessment_request, @assessee, session, Set.new(["user"]))
        expect(json["user"]).to be_present
        expect(json["user"]["id"]).to eq @assessee.id
      end

      it "includes user_id for a teacher" do
        json = assessment_request_json(@assessment_request, @teacher, session)
        expect(json["user_id"]).to eq @assessee.id
      end

      it "includes user hash for a teacher when user include requested" do
        json = assessment_request_json(@assessment_request, @teacher, session, Set.new(["user"]))
        expect(json["user"]).to be_present
        expect(json["user"]["id"]).to eq @assessee.id
      end

      it "still omits assessor_id for the assessee (reviewer anonymity preserved)" do
        json = assessment_request_json(@assessment_request, @assessee, session)
        expect(json.key?("assessor_id")).to be false
      end
    end
  end
end
