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

describe Services::NewQuizzes::Routes::LaunchHelper do
  let(:course) { course_model }
  let(:account) { Account.default }
  let(:user) { user_model }
  let(:tool) do
    course.context_external_tools.create!(
      name: "New Quizzes",
      url: "http://example.com/launch",
      consumer_key: "key",
      shared_secret: "secret",
      tool_id: "Quizzes 2"
    )
  end
  let(:assignment) do
    assignment = assignment_model(context: course, submission_types: "external_tool")
    assignment.external_tool_tag = ContentTag.create!(
      context: assignment,
      content: tool,
      url: tool.url,
      content_type: "ContextExternalTool"
    )
    assignment.save!
    assignment
  end
  let(:controller) do
    # Trigger lazy definition of route helper methods on ApplicationController
    # so that instance_double can verify against them
    ApplicationController.new.respond_to?(:lti_grade_passback_api_url)
    instance_double(ApplicationController,
                    request: instance_double(ActionDispatch::Request),
                    set_return_url: nil,
                    lti_grade_passback_api_url: nil,
                    blti_legacy_grade_passback_api_url: nil,
                    lti_turnitin_outcomes_placement_url: nil,
                    params: {})
  end
  let(:request) { controller.request }
  let(:pseudonym) { Pseudonym.create!(user:, account:, unique_id: "test@example.com") }

  describe ".default_launch_data" do
    let(:basename) { "/courses/#{course.id}/assignments/#{assignment.id}" }

    context "when assignment has a quiz_lti tool" do
      it "returns signed launch data with basename" do
        result = described_class.default_launch_data(
          tool:,
          assignment:,
          context: course,
          user:,
          controller:,
          request:,
          basename:,
          current_pseudonym: pseudonym,
          domain_root_account: account
        )

        expect(result).to be_a(Hash)
        expect(result[:basename]).to eq(basename)
      end

      it "creates a variable expander with correct parameters" do
        expect(Lti::VariableExpander).to receive(:new).with(
          account,
          course,
          controller,
          hash_including(
            current_user: user,
            current_pseudonym: pseudonym,
            assignment:,
            tool:
          )
        ).and_call_original

        described_class.default_launch_data(
          tool:,
          assignment:,
          context: course,
          user:,
          controller:,
          request:,
          basename:,
          current_pseudonym: pseudonym,
          domain_root_account: account
        )
      end

      it "calls LaunchDataBuilder with correct parameters" do
        expect(NewQuizzes::LaunchDataBuilder).to receive(:new).with(
          hash_including(
            context: course,
            assignment:,
            tool:,
            tag: assignment.external_tool_tag,
            current_user: user,
            controller:,
            request:,
            placement: nil
          )
        ).and_call_original

        described_class.default_launch_data(
          tool:,
          assignment:,
          context: course,
          user:,
          controller:,
          request:,
          basename:
        )
      end

      it "uses context.root_account when domain_root_account is not provided" do
        expect(Lti::VariableExpander).to receive(:new).with(
          course.root_account,
          anything,
          anything,
          anything
        ).and_call_original

        described_class.default_launch_data(
          tool:,
          assignment:,
          context: course,
          user:,
          controller:,
          request:,
          basename:
        )
      end

      context "when the assignment has user-specific date overrides" do
        let(:base_lock_at) { 1.day.ago }
        let(:override_lock_at) { 1.week.from_now }

        before do
          assignment.update!(lock_at: base_lock_at, due_at: nil, unlock_at: nil)
          course.enroll_student(user, enrollment_state: "active")
          create_adhoc_override_for_assignment(assignment, user, lock_at: override_lock_at)
        end

        it "passes the assignment with overrides applied to LaunchDataBuilder" do
          expect(NewQuizzes::LaunchDataBuilder).to receive(:new) do |opts|
            expect(opts[:assignment].lock_at).to be_within(1.second).of(override_lock_at)
            instance_double(NewQuizzes::LaunchDataBuilder, build_with_signature: {})
          end

          described_class.default_launch_data(
            tool:,
            assignment:,
            context: course,
            user:,
            controller:,
            request:,
            basename:
          )
        end

        it "passes the assignment with overrides applied to the variable expander" do
          expect(Lti::VariableExpander).to receive(:new) do |_root, _ctx, _ctrl, opts|
            expect(opts[:assignment].lock_at).to be_within(1.second).of(override_lock_at)
            instance_double(Lti::VariableExpander, expand_variables!: {}, enabled_capability_params: {})
          end

          described_class.default_launch_data(
            tool:,
            assignment:,
            context: course,
            user:,
            controller:,
            request:,
            basename:
          )
        end
      end
    end
  end

  describe ".item_bank_launch_data" do
    let(:placement) { "course_navigation" }
    let(:basename) { "/courses/#{course.id}" }

    before do
      allow(tool).to receive(:quiz_lti?).and_return(true)
    end

    it "returns signed launch data with basename" do
      result = described_class.item_bank_launch_data(
        tool:,
        context: course,
        user:,
        controller:,
        request:,
        basename:,
        placement:,
        current_pseudonym: pseudonym,
        domain_root_account: account
      )

      expect(result).to be_a(Hash)
      expect(result[:basename]).to eq(basename)
    end

    it "creates a variable expander without assignment" do
      expect(Lti::VariableExpander).to receive(:new).with(
        account,
        course,
        controller,
        hash_including(
          current_user: user,
          current_pseudonym: pseudonym,
          tool:
        )
      ).and_call_original

      described_class.item_bank_launch_data(
        tool:,
        context: course,
        user:,
        controller:,
        request:,
        basename:,
        placement:,
        current_pseudonym: pseudonym,
        domain_root_account: account
      )
    end

    it "calls LaunchDataBuilder with placement" do
      expect(NewQuizzes::LaunchDataBuilder).to receive(:new).with(
        hash_including(
          context: course,
          assignment: nil,
          tool:,
          tag: nil,
          current_user: user,
          controller:,
          request:,
          placement:
        )
      ).and_call_original

      described_class.item_bank_launch_data(
        tool:,
        context: course,
        user:,
        controller:,
        request:,
        basename:,
        placement:
      )
    end

    it "uses context.root_account when domain_root_account is not provided" do
      expect(Lti::VariableExpander).to receive(:new).with(
        course.root_account,
        anything,
        anything,
        anything
      ).and_call_original

      described_class.item_bank_launch_data(
        tool:,
        context: course,
        user:,
        controller:,
        request:,
        basename:,
        placement:
      )
    end

    context "with account context" do
      let(:account_tool) do
        account.context_external_tools.create!(
          name: "New Quizzes",
          url: "http://example.com/launch",
          consumer_key: "key",
          shared_secret: "secret",
          tool_id: "Quizzes 2"
        )
      end
      let(:basename) { "/accounts/#{account.id}" }
      let(:placement) { "account_navigation" }

      it "returns signed launch data for account context" do
        result = described_class.item_bank_launch_data(
          tool: account_tool,
          context: account,
          user:,
          controller:,
          request:,
          basename:,
          placement:,
          domain_root_account: account
        )

        expect(result).to be_a(Hash)
        expect(result[:basename]).to eq(basename)
      end
    end
  end

  describe "integration with NewQuizzes::LaunchDataBuilder" do
    let(:basename) { "/courses/#{course.id}/assignments/#{assignment.id}" }
    let(:mock_signed_data) do
      {
        launch_url: "http://example.com/launch",
        signature: "abc123",
        other_data: "value"
      }
    end

    before do
      allow(described_class).to receive(:find_tool).and_return(tool)
      allow(tool).to receive(:quiz_lti?).and_return(true)

      mock_builder = instance_double(NewQuizzes::LaunchDataBuilder)
      allow(NewQuizzes::LaunchDataBuilder).to receive(:new).and_return(mock_builder)
      allow(mock_builder).to receive(:build_with_signature).and_return(mock_signed_data)
    end

    it "adds basename to the signed data returned by LaunchDataBuilder" do
      result = described_class.default_launch_data(
        tool:,
        assignment:,
        context: course,
        user:,
        controller:,
        request:,
        basename:
      )

      expect(result).to eq(mock_signed_data.merge(basename:))
    end

    it "preserves all data from LaunchDataBuilder" do
      result = described_class.default_launch_data(
        tool:,
        assignment:,
        context: course,
        user:,
        controller:,
        request:,
        basename:
      )

      expect(result[:launch_url]).to eq("http://example.com/launch")
      expect(result[:signature]).to eq("abc123")
      expect(result[:other_data]).to eq("value")
    end
  end

  describe "parameter compaction" do
    let(:basename) { "/courses/#{course.id}/assignments/#{assignment.id}" }

    before do
      allow(described_class).to receive(:find_tool).and_return(tool)
      allow(tool).to receive(:quiz_lti?).and_return(true)
    end

    it "does not pass nil values to VariableExpander" do
      expect(Lti::VariableExpander).to receive(:new).with(
        anything,
        anything,
        anything,
        hash_not_including(current_pseudonym: nil)
      ).and_call_original

      described_class.default_launch_data(
        tool:,
        assignment:,
        context: course,
        user:,
        controller:,
        request:,
        basename:,
        current_pseudonym: nil
      )
    end

    it "passes current_pseudonym when provided" do
      expect(Lti::VariableExpander).to receive(:new).with(
        anything,
        anything,
        anything,
        hash_including(current_pseudonym: pseudonym)
      ).and_call_original

      described_class.default_launch_data(
        tool:,
        assignment:,
        context: course,
        user:,
        controller:,
        request:,
        basename:,
        current_pseudonym: pseudonym
      )
    end
  end
end
