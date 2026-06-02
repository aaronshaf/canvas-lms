# frozen_string_literal: true

#
# Copyright (C) 2011 - present Instructure, Inc.
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

require_relative "../helpers/outcome_common"
require_relative "pages/improved_outcome_management_page"
require "feature_flag_helper"

describe "outcomes" do
  include_context "in-process server selenium tests"
  include FeatureFlagHelper
  include OutcomeCommon
  include ImprovedOutcomeManagementPage

  let(:who_to_login) { "teacher" }
  let(:outcome_url) { "/courses/#{@course.id}/outcomes" }

  describe "course outcomes" do
    before do
      mock_feature_flag_on_account(:improved_outcomes_management, false)
      course_with_teacher_logged_in
    end

    def save_without_error(value = 4, title = "New Outcome")
      replace_content(f(".outcomes-content input[name=title]"), title)
      replace_content(f("input[name=calculation_int]"), value)
      f(".submit_button").click
      wait_for_ajaximations
      expect(f(".title").text).to include(title)
      expect(f("#calculation_int").text.to_i).to eq(value)
    end

    context "create/edit/delete outcomes" do
      it "creates a learning outcome with a new rating (root level)", priority: "1" do
        should_create_a_learning_outcome_with_a_new_rating_root_level
      end

      it "creates a learning outcome (nested)", priority: "1" do
        should_create_a_learning_outcome_nested
      end

      it "edits a learning outcome and delete a rating", priority: "1" do
        should_edit_a_learning_outcome_and_delete_a_rating
      end

      it "deletes a learning outcome", priority: "1" do
        skip_if_safari(:alert)
        should_delete_a_learning_outcome
      end

      context "validate decaying average" do
        before do
          get outcome_url
          f(".add_outcome_link").click
        end

        it "validates decaying average_range", priority: "2" do
          should_validate_decaying_average_range "The value must be between '50' and '99'"
        end

        it "validates calculation int acceptable values", priority: "1" do
          save_without_error(1)
          f(".edit_button").click
          save_without_error(65)
        end

        it "retains the settings after saving", priority: "1" do
          click_option("#calculation_method", "Decaying Average")
          save_without_error(rand(50..99), "Decaying Average")
          expect(f("#calculation_method").text).to include("Decaying Average")
        end
      end

      context "validate n mastery" do
        before do
          get outcome_url
          f(".add_outcome_link").click
        end

        it "validates n mastery_range", priority: "2" do
          should_validate_n_mastery_range
        end

        it "validates calculation int acceptable range values", priority: "1" do
          click_option("#calculation_method", "n Number of Times")
          save_without_error(2)
          f(".edit_button").click
          save_without_error(5)
        end

        it "retains the settings after saving", priority: "1" do
          click_option("#calculation_method", "n Number of Times")
          save_without_error(3, "n Number of Times")
          refresh_page
          fj(".outcomes-sidebar .outcome-level:first li").click
          expect(f("#calculation_int").text).to eq("3")
          expect(f("#calculation_method").text).to include("n Number of Times")
        end
      end

      context "create/edit/delete outcome groups" do
        it "deletes an outcome group", priority: "2" do
          skip_if_safari(:alert)
          should_delete_an_outcome_group
        end

        it "drags and drop an outcome to an outcome group", priority: "2" do
          group = @course.learning_outcome_groups.create!(title: "groupage")
          group2 = @course.learning_outcome_groups.create!(title: "groupage2")
          group.adopt_outcome_group(group2)
          group2.add_outcome @course.created_learning_outcomes.create!(title: "o1")
          get "/courses/#{@course.id}/outcomes"
          f(".ellipsis[title='groupage2']").click
          wait_for_ajaximations

          # make sure the outcome group 'groupage2' and outcome 'o1' are on different frames
          expect(ffj(".outcome-level:first .outcome-group .ellipsis")[0]).to have_attribute("title", "groupage2")
          expect(ffj(".outcome-level:last .outcome-link .ellipsis")[0]).to have_attribute("title", "o1")
          drag_and_drop_element(ffj(".outcome-level:last .outcome-link .ellipsis")[0], ff(".outcome-level")[0])
          wait_for_ajaximations

          # after the drag and drop, the outcome and the group are on a same screen
          expect(ffj(".outcome-level:last .outcome-group .ellipsis")[0]).to have_attribute("title", "groupage2")
          expect(ffj(".outcome-level:last .outcome-link .ellipsis")[0]).to have_attribute("title", "o1")

          # assert there is only one frame now after the drag and drop
          expect(ffj(" .outcome-level:first")).to eq ffj(" .outcome-level:last")
        end
      end
    end

    context "actions" do
      it "does not render an HTML-escaped title in outcome directory while editing", priority: "2" do
        title = "escape & me <<->> if you dare"
        @context = (who_to_login == "teacher") ? @course : account
        outcome_model
        get outcome_url
        wait_for_ajaximations
        fj(".outcomes-sidebar .outcome-level:first li").click
        wait_for_ajaximations
        f(".edit_button").click

        # pass in the unescaped version of the title:
        replace_content f(".outcomes-content input[name=title]"), title
        f(".submit_button").click
        wait_for_ajaximations

        # the "readable" version should be rendered in directory browser
        li_el = fj(".outcomes-sidebar .outcome-level:first li:first")
        expect(li_el).to be_truthy # should be present
        expect(li_el.text).to eq title

        # the "readable" version should be rendered in the view:
        expect(f(".outcomes-content .title").text).to eq title

        # and the escaped version should be stored!
        # expect(LearningOutcome.where(short_description: escaped_title)).to be_exists
        # or not, looks like it isn't being escaped
        expect(LearningOutcome.where(short_description: title)).to be_exists
      end
    end

    describe "#show" do
      it "shows rubrics as aligned items", priority: "2" do
        outcome_with_rubric

        get "/courses/#{@course.id}/outcomes/#{@outcome.id}"
        wait_for_ajaximations

        expect(f("#alignments").text).to match(/#{@rubric.title}/)
      end
    end

    describe "with improved_outcome_management enabled" do
      before do
        mock_feature_flag_on_account(:improved_outcomes_management, true)
      end

      context "alignment summary tab" do
        before do
          context_outcome(@course, 3)
          @assignment = assignment_model(course: @course)
          @aligned_outcome = LearningOutcome.find_by(context: @course, short_description: "outcome 0")
          @aligned_outcome.align(@assignment, @course)
        end

        it "shows list of alignments when aligned outcome is expanded" do
          get outcome_url
          click_alignments_tab
          alignment_summary_expand_outcome_description_button(0).click
          expect(alignment_summary_outcome_alignments_list.length).to eq(1)
        end

        it "filters outcomes with and without alignments" do
          get outcome_url
          click_alignments_tab
          expect(alignment_summary_outcomes_list.length).to eq(3)
          # filters outcomes with alignments
          click_option(alignment_summary_filter_all_input, "With Alignments")
          expect(alignment_summary_outcomes_list.length).to eq(1)
          expect(alignment_summary_outcome_alignments(0)).to eq("1")
          # filters outcomes without alignments
          click_option(alignment_summary_filter_with_alignments_input, "Without Alignments")
          expect(alignment_summary_outcomes_list.length).to eq(2)
          expect(alignment_summary_outcome_alignments(0)).to eq("0")
          expect(alignment_summary_outcome_alignments(1)).to eq("0")
        end
      end
    end
  end
end
