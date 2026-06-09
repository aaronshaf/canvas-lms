# frozen_string_literal: true

#
# Copyright (C) 2025 - present Instructure, Inc.
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

RSpec.describe Accessibility::CourseScanController, type: :request do
  describe "#show" do
    context "when no scan exists" do
      it "returns not found" do
        course_with_teacher(active_all: true)
        user_session(@teacher)
        @course.root_account.enable_feature!(:a11y_checker_ga1)

        get "/courses/#{@course.id}/accessibility/course_scan"

        expect(response).to have_http_status(:not_found)
      end
    end

    context "when a scan exists" do
      it "returns the progress information" do
        course_with_teacher(active_all: true)
        user_session(@teacher)
        @course.root_account.enable_feature!(:a11y_checker_ga1)
        progress = Progress.create!(tag: "course_accessibility_scan", context: @course, workflow_state: "queued")

        get "/courses/#{@course.id}/accessibility/course_scan"

        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json["id"]).to eql(progress.id)
        expect(json["workflow_state"]).to eq("queued")
        expect(json["created_at"]).to eq(progress.created_at.iso8601)
      end
    end
  end

  describe "#create" do
    it "queues a scan and returns the progress" do
      course_with_teacher(active_all: true)
      user_session(@teacher)
      @course.root_account.enable_feature!(:a11y_checker_ga1)

      post "/courses/#{@course.id}/accessibility/course_scan"

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json["id"]).to be_present
      expect(json["workflow_state"]).to eq("queued")
      expect(json["created_at"]).to eq(Progress.find(json["id"]).created_at.iso8601)

      progress = Progress.find(json["id"])
      expect(progress.tag).to eq("course_accessibility_scan")
      expect(progress.context).to eq(@course)
    end

    it "returns existing progress if scan is already queued" do
      course_with_teacher(active_all: true)
      user_session(@teacher)
      @course.root_account.enable_feature!(:a11y_checker_ga1)
      existing_progress = Accessibility::CourseScanService.queue_course_scan(@course)

      post "/courses/#{@course.id}/accessibility/course_scan"

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json["id"]).to eql(existing_progress.id)
    end

    context "when the course does not exist" do
      it "returns a not found error" do
        user = User.create!
        user_session(user)

        post "/courses/-1/accessibility/course_scan"

        expect(response).to have_http_status(:not_found)
      end
    end

    context "when the course exceeds scan limit" do
      it "returns a bad request error" do # flaky-fix: QE-147
        course_with_teacher(active_all: true)
        user_session(@teacher)
        @course.root_account.enable_feature!(:a11y_checker_ga1)

        stub_const("Course::MAX_ACCESSIBILITY_SCAN_RESOURCES", 2)
        3.times { |i| @course.wiki_pages.create!(title: "Page #{i}") }

        post "/courses/#{@course.id}/accessibility/course_scan"

        expect(response).to have_http_status(:bad_request)
        json = response.parsed_body
        expect(json["error"]).to eq("Course exceeds accessibility scan limit")
      end
    end
  end
end

# Controller spec tests for private methods
RSpec.describe Accessibility::CourseScanController do
  let(:course) { Course.create! }

  context "check_authorized_action" do
    context "when a11y_checker feature flag disabled" do
      it "renders forbidden" do
        allow(course).to receive(:a11y_checker_enabled?).and_return(false)

        expect(controller).to receive(:render).with(status: :forbidden)
        controller.instance_variable_set(:@context, course)
        controller.send(:check_authorized_action)
      end
    end
  end
end
