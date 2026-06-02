# frozen_string_literal: true

#
# Copyright (C) 2012 - present Instructure, Inc.
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

require_relative "../common"
require_relative "../helpers/outcome_common"
require_relative "pages/improved_outcome_management_page"
require "feature_flag_helper"

describe "outcomes" do
  include_context "in-process server selenium tests"
  include OutcomeCommon
  include ImprovedOutcomeManagementPage
  include FeatureFlagHelper

  let(:account) { Account.create(name: "sub account from default account", parent_account: Account.default) }
  let(:outcome_url) { "/accounts/#{account.id}/outcomes" }
  let(:who_to_login) { "admin" }

  describe "sub-account outcomes" do
    before do
      course_with_admin_logged_in
    end

    describe "with improved_outcome_management disabled" do
      before do
        mock_feature_flag_on_account(:improved_outcomes_management, false)
      end

      context "create/edit/delete outcomes" do
        it "creates a learning outcome with a new rating (root level)", priority: "2" do
          should_create_a_learning_outcome_with_a_new_rating_root_level
        end

        it "creates a learning outcome (nested)", priority: "2" do
          should_create_a_learning_outcome_nested
        end

        it "edits a learning outcome and delete a rating", priority: "2" do
          should_edit_a_learning_outcome_and_delete_a_rating
        end

        it "deletes a learning outcome", priority: "2" do
          skip_if_safari(:alert)
          should_delete_a_learning_outcome
        end

        it "validates decaying average_range", priority: "2" do
          should_validate_decaying_average_range "not a valid value for this calculation method"
        end

        it "validates n mastery_range", priority: "2" do
          should_validate_n_mastery_range
        end
      end

      context "create/edit/delete outcome groups" do
        it "creates an outcome group (root level)", priority: "1" do
          should_create_an_outcome_group_root_level
        end

        it "creates an outcome group (nested)", priority: "1" do
          should_create_an_outcome_group_nested
        end
      end

      describe "find/import dialog" do
        it "does not allow importing top level groups", priority: "1" do
          get outcome_url
          wait_for_ajaximations
          f(".find_outcome").click
          wait_for_ajaximations
          groups = ff(".outcome-group")
          expect(groups.size).to eq 2
          groups.each do |g|
            g.click
            expect(f(".ui-dialog-buttonpane .btn-primary")).not_to be_displayed
          end
        end
      end
    end

    describe "with improved_outcome_management enabled" do
      before do
        mock_feature_flag_on_account(:improved_outcomes_management, true)
      end

      it "creates an initial outcome in the sub-account level as an admin" do
        get outcome_url
        create_outcome("Test Outcome")
        run_jobs
        get outcome_url
        expect(tree_browser_outcome_groups.count).to eq(2)
        group_text = tree_browser_outcome_groups[0].text.split("\n")[0]
        expect(group_text).to eq("sub account from default account")
        add_new_group_text = tree_browser_outcome_groups[1].text
        expect(add_new_group_text).to eq("Create New Group")
        expect(LearningOutcome.find_by(context_id: account.id).short_description).to eq("Test Outcome")
      end

      # Can't reproduce the js error locally
      describe "with account_level_mastery_scales disabled" do
        it "edits an outcome and changes calculation int" do
          create_bulk_outcomes_groups(account, 1, 1, valid_outcome_data)
          get outcome_url
          select_outcome_group_with_text(account.name, 1).click
          individual_outcome_kabob_menu(0).click
          edit_outcome_button.click
          # change calculation int
          edit_individual_outcome_calculation_int(55)
          click_save_edit_modal
          # Verify through AR to save time
          outcome = LearningOutcome.find_by(context: account, short_description: "outcome 0")
          expect(outcome.calculation_int).to eq(55)
        end

        context "alignment summary tab" do
          before do
            context_outcome(account, 3)
            @assignment = assignment_model(course: @course)
            @aligned_outcome = LearningOutcome.find_by(context: account, short_description: "outcome 0")
            @aligned_outcome.align(@assignment, account)
          end

          it "there is no alignments tab" do
            get outcome_url
            tabs = ff("*[role='tablist'] *[role='tab']")
            expect(tabs.count).to eq 1
          end
        end
      end
    end
  end
end
