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

require_relative "../graphql_spec_helper"

describe GraphQLHelpers::RubricConnectionHelper do
  before(:once) do
    course_with_teacher(active_all: true)
    account_admin_user(account: @course.root_account)

    one_criterion   = [{ description: "C1", points: 10, id: "c1", ratings: [{ description: "Full", points: 10, id: "r1", criterion_id: "c1" }] }]
    two_criteria    = one_criterion + [{ description: "C2", points: 20, id: "c2", ratings: [{ description: "Full", points: 20, id: "r2", criterion_id: "c2" }] }]
    three_criteria  = two_criteria  + [{ description: "C3", points: 30, id: "c3", ratings: [{ description: "Full", points: 30, id: "r3", criterion_id: "c3" }] }]

    @rubric1 = rubric_model(context: @course.root_account, title: "Alpha Rubric", data: one_criterion, points_possible: 10)
    @rubric2 = rubric_model(context: @course.root_account, title: "Beta Rubric",  data: two_criteria,   points_possible: 30)
    @rubric3 = rubric_model(context: @course.root_account, title: "Gamma Rubric", data: three_criteria, points_possible: 60)

    [@rubric1, @rubric2, @rubric3].each { |r| r.associate_with(@course.root_account, @course.root_account, purpose: "bookmark") }

    assignment = @course.assignments.create!(title: "Graded Assignment", submission_types: "none", points_possible: 10)
    @rubric1.rubric_associations.create!(
      association_object: assignment,
      context: @course,
      purpose: "grading",
      workflow_state: "active"
    )
  end

  let(:account_type) { GraphQLTypeTester.new(@course.root_account, current_user: @admin) }

  def resolve_rubrics(args)
    account_type.resolve(<<~GQL, current_user: @admin)
      rubricsConnection(#{args}) { nodes { _id } }
    GQL
  end

  describe "workflowStates" do
    before(:once) do
      @rubric2.update!(workflow_state: "archived")
      @rubric3.update!(workflow_state: "draft")
    end

    it "filters to a single workflow_state" do
      result = resolve_rubrics('workflowStates: ["archived"]')
      expect(result).to contain_exactly(@rubric2.id.to_s)
    end

    it "filters to multiple workflow_states" do
      result = resolve_rubrics('workflowStates: ["active", "draft"]')
      expect(result).to contain_exactly(@rubric1.id.to_s, @rubric3.id.to_s)
    end

    it "returns all (except deleted) when omitted" do
      result = account_type.resolve(<<~GQL, current_user: @admin)
        rubricsConnection { nodes { _id } }
      GQL
      expect(result).to contain_exactly(@rubric1.id.to_s, @rubric2.id.to_s, @rubric3.id.to_s)
    end
  end

  describe "totalCount" do
    it "returns the count ignoring pagination" do
      result = account_type.resolve(<<~GQL, current_user: @admin)
        rubricsConnection(first: 1) { pageInfo { totalCount } }
      GQL
      expect(result).to be(3)
    end

    it "reflects the workflowStates filter" do
      @rubric2.update!(workflow_state: "archived")
      result = account_type.resolve(<<~GQL, current_user: @admin)
        rubricsConnection(first: 1, workflowStates: ["archived"]) { pageInfo { totalCount } }
      GQL
      expect(result).to be(1)
    end
  end

  describe "searchTerm" do
    it "filters by partial title match" do
      result = account_type.resolve(<<~GQL, current_user: @admin)
        rubricsConnection(searchTerm: "Alpha") { nodes { title } }
      GQL
      expect(result).to eql(["Alpha Rubric"])
    end

    it "returns multiple matches" do
      result = resolve_rubrics('searchTerm: "Rubric"')
      expect(result).to contain_exactly(@rubric1.id.to_s, @rubric2.id.to_s, @rubric3.id.to_s)
    end

    it "returns empty array when no titles match" do
      result = resolve_rubrics('searchTerm: "nonexistent"')
      expect(result).to eql([])
    end
  end

  describe "sort" do
    def sort_ids(field, direction)
      resolve_rubrics(%(searchTerm: "Rubric" sort: { field: #{field}, direction: #{direction} }))
    end

    describe "title" do
      it "sorts ascending" do
        expect(sort_ids("title", "ascending")).to eql([@rubric1.id.to_s, @rubric2.id.to_s, @rubric3.id.to_s])
      end

      it "sorts descending" do
        expect(sort_ids("title", "descending")).to eql([@rubric3.id.to_s, @rubric2.id.to_s, @rubric1.id.to_s])
      end
    end

    describe "criteria_count" do
      it "sorts ascending" do
        expect(sort_ids("criteria_count", "ascending")).to eql([@rubric1.id.to_s, @rubric2.id.to_s, @rubric3.id.to_s])
      end

      it "sorts descending" do
        expect(sort_ids("criteria_count", "descending")).to eql([@rubric3.id.to_s, @rubric2.id.to_s, @rubric1.id.to_s])
      end
    end

    describe "points_possible" do
      it "sorts ascending" do
        expect(sort_ids("points_possible", "ascending")).to eql([@rubric1.id.to_s, @rubric2.id.to_s, @rubric3.id.to_s])
      end

      it "sorts descending" do
        expect(sort_ids("points_possible", "descending")).to eql([@rubric3.id.to_s, @rubric2.id.to_s, @rubric1.id.to_s])
      end

      context "with an unscored rubric (hide_points = true)" do
        before do
          # @rubric2 already has the highest scored points (30); marking it
          # unscored should move it below all scored rubrics in ASC and above
          # them in DESC, regardless of its points_possible value.
          @rubric2.update!(hide_points: true)
        end

        it "places the unscored rubric first when ascending" do
          expect(sort_ids("points_possible", "ascending")).to eql(
            [@rubric2.id.to_s, @rubric1.id.to_s, @rubric3.id.to_s]
          )
        end

        it "places the unscored rubric last when descending" do
          expect(sort_ids("points_possible", "descending")).to eql(
            [@rubric3.id.to_s, @rubric1.id.to_s, @rubric2.id.to_s]
          )
        end
      end
    end

    describe "has_rubric_associations" do
      it "places associated rubric first when ascending" do
        result = sort_ids("has_rubric_associations", "ascending")
        expect(result.first).to eql(@rubric1.id.to_s)
        expect(result).to include(@rubric2.id.to_s, @rubric3.id.to_s)
      end

      it "places associated rubric last when descending" do
        result = sort_ids("has_rubric_associations", "descending")
        expect(result.last).to eql(@rubric1.id.to_s)
        expect(result).to include(@rubric2.id.to_s, @rubric3.id.to_s)
      end
    end
  end
end
