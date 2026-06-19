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
#

require_relative "../../import_helper"

describe "Importing Rubrics" do
  SYSTEMS.each do |system|
    next unless import_data_exists? system, "rubric"

    it "imports from #{system}" do
      data = get_import_data(system, "rubric")
      context = get_import_context(system)
      assignment = Assignment.create!(course: @course)
      migration = double
      allow(migration).to receive(:add_imported_item)
      allow(migration).to receive_messages(context:, migration_settings: {})

      data[:rubrics_to_import] = {}
      expect(Importers::RubricImporter.import_from_migration(data, migration)).to be_nil
      expect(context.rubrics.count).to eq 0

      data[:rubrics_to_import][data[:migration_id]] = true
      Importers::RubricImporter.import_from_migration(data, migration)
      Importers::RubricImporter.import_from_migration(data, migration)
      expect(context.rubrics.count).to eq 1
      r = Rubric.where(migration_id: data[:migration_id]).first

      assignment.reload
      expect(assignment.rubric_association).to be_nil

      expect(r.title).to eq data[:title]
      expect(r.description).to include(data[:description]) if data[:description]
      expect(r.points_possible).to eq data[:points_possible].to_f
      # make sure we can reconstitute whatever the importer stuffed into the hash
      expect(r.criteria_object).to be_a(Array)

      crit_ids = r.data.map { |rub| rub[:ratings].first[:criterion_id] }

      data[:data].each do |crit|
        id = crit[:migration_id] || crit[:id]
        expect(crit_ids.member?(id)).to be_truthy
      end
    end

    context "when rubric has an assessment" do
      let(:migration_id) { "g74ae39cd0bf07b03d73506c457f437b0" }

      before do
        course_with_teacher(active_all: true)
        course_with_student(active_all: true, course: @course)
        @context = @course
        @assignment = @context.assignments.create!(
          title: "some assignment",
          workflow_state: "published"
        )

        submission_model assignment: @assignment, user: @student
        @viewing_user = @teacher
        @assessed_user = @student
        rubric_association_model association_object: @assignment, purpose: "grading"
        @rubric.update(migration_id:)
        [@teacher, @student].each do |user|
          @rubric_association.rubric_assessments.create!({
                                                           artifact: @submission,
                                                           assessment_type: "grading",
                                                           assessor: user,
                                                           rubric: @rubric,
                                                           user: @assessed_user
                                                         })
        end
      end

      it "doesn't import from #{system}" do
        data = get_import_data(system, "rubric")

        migration = double
        allow(migration).to receive(:add_imported_item)
        allow(migration).to receive_messages(context: @context, migration_settings: {})
        expect(migration).to receive(:add_import_warning).once

        data[:rubrics_to_import] = { "#{migration_id}": true }
        data[:migration_id] = migration_id
        Importers::RubricImporter.import_from_migration(data, migration)
      end
    end

    it "imports from #{system} with associated assignment" do
      data = get_import_data(system, "rubric")
      context = get_import_context(system)
      assignment = Assignment.create!(course: @course)
      migration = double
      allow(migration).to receive(:add_imported_item)
      allow(migration).to receive_messages(context:, migration_settings: { associate_with_assignment_id: assignment.id })
      expect_any_instance_of(Rubric).not_to receive(:update_association_count)

      data[:rubrics_to_import] = {}
      data[:rubrics_to_import][data[:migration_id]] = true
      Importers::RubricImporter.import_from_migration(data, migration)
      Importers::RubricImporter.import_from_migration(data, migration)
      expect(context.rubrics.count).to eq 1
      r = Rubric.where(migration_id: data[:migration_id]).first

      assignment.reload
      expect(assignment.rubric_association.purpose).to eq "grading"
      expect(assignment.rubric_association.rubric_id).to eq r.id
      expect(r.association_count).to eq 0
    end

    it "imports the association count correctly" do
      data = get_import_data(system, "rubric")
      context = get_import_context(system)
      assignment = Assignment.create!(course: @course)
      migration = double
      allow(migration).to receive(:add_imported_item)
      allow(migration).to receive_messages(context:, migration_settings: { associate_with_assignment_id: assignment.id })

      data[:rubrics_to_import] = {}
      data[:rubrics_to_import][data[:migration_id]] = true
      data[:rubrics] = data[:data]
      data[:rubrics][0][:migration_id] = data[:migration_id]
      Importers::RubricImporter.import_from_migration(data, migration)
      expect(context.rubrics.count).to eq 1
      r = Rubric.where(migration_id: data[:migration_id]).first
      expect(r.association_count).to eq 0

      allow(migration).to receive(:imported_migration_items_by_class).with(Rubric).and_return([r])
      Importers::RubricImporter.process_rubric_association_count(migration)

      assignment.reload
      expect(assignment.rubric_association.purpose).to eq "grading"
      expect(assignment.rubric_association.rubric_id).to eq r.id
      expect(r.reload.association_count).to eq 1
    end
  end

  describe "long_description handling" do
    let(:context) { course_model }
    let(:migration) do
      m = double
      allow(m).to receive(:add_imported_item)
      allow(m).to receive_messages(context:, migration_settings: {}, cross_institution?: false, copied_external_outcome_map: {})
      m
    end

    let(:rating_long_description) { "" }
    let(:outcome_migration_id) { nil }

    let(:base_hash) do
      crit = {
        description: "Crit",
        long_description:,
        points: 5,
        id: "crit1",
        ratings: [
          { description: "Full", long_description: rating_long_description, points: 5, id: "rat1" },
        ],
      }
      crit[:learning_outcome_migration_id] = outcome_migration_id if outcome_migration_id

      {
        migration_id: "rubric_xss_1",
        title: "Rubric",
        points_possible: 5,
        rubrics_to_import: { "rubric_xss_1" => true },
        data: [crit],
      }
    end

    def stored_long_description
      Rubric.where(migration_id: "rubric_xss_1").first.data.first[:long_description]
    end

    def stored_rating_long_description
      Rubric.where(migration_id: "rubric_xss_1").first.data.first[:ratings].first[:long_description]
    end

    # Outcome-linked criteria carry RCE-authored Rich HTML in long_description.
    # The importer keeps a defense-in-depth Sanitize.clean pass on this branch.
    # The branch is triggered by either learning_outcome_migration_id (typical
    # CC import) or learning_outcome_external_identifier (cross-institution).
    context "outcome-linked criterion long_description" do
      let(:outcome_migration_id) { "outcome_mig_1" }

      context "with a script payload" do
        let(:long_description) { "<script>alert('xss')</script>safe text" }

        it "strips the script tag before persisting" do
          Importers::RubricImporter.import_from_migration(base_hash, migration)
          expect(stored_long_description).not_to include("<script")
          expect(stored_long_description).to include("safe text")
        end
      end

      context "with only learning_outcome_external_identifier set" do
        let(:long_description) { "<script>alert('xss')</script>safe text" }
        let(:base_hash) do
          {
            migration_id: "rubric_xss_1",
            title: "Rubric",
            points_possible: 5,
            rubrics_to_import: { "rubric_xss_1" => true },
            data: [
              {
                description: "Crit",
                long_description:,
                learning_outcome_external_identifier: "vendor:abc123",
                points: 5,
                id: "crit1",
                ratings: [],
              },
            ],
          }
        end

        it "still strips the script tag on the cross-institution branch" do
          Importers::RubricImporter.import_from_migration(base_hash, migration)
          expect(stored_long_description).not_to include("<script")
          expect(stored_long_description).to include("safe text")
        end
      end

      context "with an onerror payload" do
        let(:long_description) { '<img src="x" onerror="alert(1)">' }

        it "strips the event handler attribute" do
          Importers::RubricImporter.import_from_migration(base_hash, migration)
          expect(stored_long_description).not_to include("onerror")
        end
      end

      context "with a javascript: href" do
        let(:long_description) { '<a href="javascript:alert(1)">click</a>' }

        it "strips the javascript: scheme" do
          Importers::RubricImporter.import_from_migration(base_hash, migration)
          expect(stored_long_description).not_to include("javascript:")
        end
      end

      context "with safe formatting markup" do
        let(:long_description) { "<p>Hello <strong>world</strong></p>" }

        it "preserves benign HTML" do
          Importers::RubricImporter.import_from_migration(base_hash, migration)
          expect(stored_long_description).to include("<strong>world</strong>")
        end
      end

      # Locks the invariant that outcome-linked content stays sanitized.
      # If a future PR makes the outcome-linked branch also preserve
      # placeholders, this spec must be updated deliberately — silently
      # flipping it would reopen the LearningOutcome XSS surface
      # (see commit 58cbc61871a / CNVS-72824).
      context "with a placeholder-shaped token on the outcome-linked branch" do
        let(:long_description) { "Outcome <1362c51c-bb54-4aef-98e1-969294aa89f3>" }

        it "still strips the bracketed token (defense-in-depth)" do
          Importers::RubricImporter.import_from_migration(base_hash, migration)
          expect(stored_long_description).not_to include("<1362c51c")
        end
      end
    end

    # Non-outcome criteria store htmlified plain text — angle brackets are
    # intentional content (SEI GUIDs, "<your initials>", etc.) and must
    # round-trip verbatim. Render paths entity-escape on display.
    context "non-outcome criterion long_description" do
      context "with an SEI tracking GUID placeholder" do
        let(:long_description) { "Speaker notes are missing. <1362c51c-bb54-4aef-98e1-969294aa89f3>" }

        it "preserves the GUID placeholder verbatim" do
          Importers::RubricImporter.import_from_migration(base_hash, migration)
          expect(stored_long_description).to eq long_description
        end
      end

      context "with a word-shaped placeholder" do
        let(:long_description) { "Add <your initials> here" }

        it "preserves the placeholder verbatim" do
          Importers::RubricImporter.import_from_migration(base_hash, migration)
          expect(stored_long_description).to eq long_description
        end
      end

      context "with mixed inequality operators and placeholders" do
        let(:long_description) { "Use 5 < 10 & note <1234abcd-ef56-7890-abcd-ef1234567890>" }

        it "preserves the text verbatim" do
          Importers::RubricImporter.import_from_migration(base_hash, migration)
          expect(stored_long_description).to eq long_description
        end
      end
    end

    # Rating long_description is always plain text — ratings cannot link to
    # outcomes. Render paths auto-escape on display.
    context "rating long_description" do
      let(:long_description) { "" }

      context "with an SEI tracking GUID placeholder" do
        let(:rating_long_description) { "Identified the potential impact. <5527f489-b426-4f5f-849f-e0222bcb8f47>" }

        it "preserves the GUID placeholder verbatim" do
          Importers::RubricImporter.import_from_migration(base_hash, migration)
          expect(stored_rating_long_description).to eq rating_long_description
        end
      end

      context "with a word-shaped placeholder" do
        let(:rating_long_description) { "Sign with <your initials>" }

        it "preserves the placeholder verbatim" do
          Importers::RubricImporter.import_from_migration(base_hash, migration)
          expect(stored_rating_long_description).to eq rating_long_description
        end
      end

      context "with a payload that looks like HTML" do
        let(:rating_long_description) { '<img src="x" onerror="alert(1)">' }

        it "stores the value verbatim; render layer auto-escapes" do
          Importers::RubricImporter.import_from_migration(base_hash, migration)
          # The render layer escapes this on display (ERB auto-escape +
          # plain JSX text content); we deliberately do NOT mutate the
          # stored value, since doing so would also destroy benign
          # placeholders like "<your initials>".
          expect(stored_rating_long_description).to eq rating_long_description
        end
      end
    end
  end

  context "with the account_level_mastery_scales FF" do
    before do
      @data = get_import_data("vista", "rubric")
      @context = get_import_context("vista")
      @migration = @context.content_migrations.create!
      outcome_proficiency_model(@context.root_account)
      outcome_with_rubric({ mastery_points: 3, context: @context })
      @data[:data] = [{ learning_outcome_id: @outcome.id, points_possible: 5, ratings: [{ description: "Rating 1" }] }]
      @data[:rubrics_to_import] = {}
      @data[:rubrics_to_import][@data[:migration_id]] = true
    end

    context "enabled" do
      it "uses imported course's mastery scales for rubrics with learning_outcomes" do
        @context.root_account.enable_feature!(:account_level_mastery_scales)
        Importers::RubricImporter.import_from_migration(@data, @migration)
        rubric = Rubric.where(migration_id: @data[:migration_id]).first
        outcome_criterion = rubric.data[0]
        expect(outcome_criterion[:ratings].pluck(:description)).to eq ["best", "worst"]
        expect(outcome_criterion[:mastery_points]).to eq 10
      end
    end

    context "disabled" do
      it "uses imported course's mastery scales for rubrics with learning_outcomes" do
        @context.root_account.disable_feature!(:account_level_mastery_scales)
        Importers::RubricImporter.import_from_migration(@data, @migration)
        rubric = Rubric.where(migration_id: @data[:migration_id]).first
        outcome_criterion = rubric.data[0]
        expect(outcome_criterion[:ratings].pluck(:description)).to eq ["Rating 1"]
      end
    end
  end
end
