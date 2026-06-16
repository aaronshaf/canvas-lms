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

RSpec.describe GradingPeriodSetsController do
  let(:group_helper) { Factories::GradingPeriodGroupHelper.new }

  context "given a root account" do
    let(:root_account) { Account.default }
    let(:enrollment_term) { root_account.enrollment_terms.first }

    before do
      @root_user = root_account.users.create! do |user|
        user.accept_terms
        user.register!
      end
      user_session(@root_user)
    end

    describe "GET #index" do
      before do
        @groups = (1..10).map do |i|
          group_helper.create_for_account(root_account, title: "Grading Period Set #{i}")
        end
      end

      it "fetches grading period sets" do
        get "/api/v1/accounts/#{root_account.id}/grading_period_sets"
        sets = json_parse.fetch("grading_period_sets")
        expect(sets.count).to eq(10)
        expect(sets.pluck("title")).to match_array((1..10).map { |i| "Grading Period Set #{i}" })
      end

      it "includes grading periods" do
        group = @groups.first
        period = Factories::GradingPeriodHelper.new.create_for_group(group)
        get "/api/v1/accounts/#{root_account.id}/grading_period_sets"
        set = json_parse.fetch("grading_period_sets").detect { |s| s["id"] == group.id.to_s }
        periods = set.fetch("grading_periods")
        expect(periods.count).to eq(1)
        expect(periods.first.fetch("id").to_s).to eql period.id.to_s
      end

      it "paginates the grading period sets" do
        get "/api/v1/accounts/#{root_account.id}/grading_period_sets"
        expect(json_parse.dig("meta", "pagination", "count")).to be(10)
      end

      it "orders the grading period sets by id" do
        # the next two lines force an unordered query to be consistently out of
        # natural order, which ensures the assertion can predictably fail
        @groups.take(5).map(&:destroy)
        @groups.take(5).each { |group| group.update!(workflow_state: "active") }
        get "/api/v1/accounts/#{root_account.id}/grading_period_sets"
        set_ids = json_parse.fetch("grading_period_sets").pluck("id")
        expect(set_ids).to eql(@groups.sort_by(&:id).map { |group| group.id.to_s })
      end
    end

    describe "POST #create" do
      let(:set_title) { "Spring 2024 Grading Set" }
      let(:post_create) do
        post "/api/v1/accounts/#{root_account.id}/grading_period_sets",
             params: {
               enrollment_term_ids: [enrollment_term.to_param],
               grading_period_set: group_helper.valid_attributes(weighted: true).merge(title: set_title)
             }
      end

      context "with valid params" do
        it "creates a new GradingPeriodSet" do
          expect { post_create }.to change(GradingPeriodGroup, :count).by(1)
        end

        it "returns a json representation of a new set" do
          post_create
          set_json = json_parse.fetch("grading_period_set")
          expect(response).to have_http_status(:created)
          expect(set_json["title"]).to eql set_title
          expect(set_json["weighted"]).to be true
        end
      end

      it "does not require enrollment_term_ids" do
        params = {
          grading_period_set: group_helper.valid_attributes
        }
        expect { post "/api/v1/accounts/#{root_account.id}/grading_period_sets", params: }.to change(GradingPeriodGroup, :count).by(1)
      end

      context "given a sub account enrollment term" do
        let(:sub_account) { root_account.sub_accounts.create! }
        let(:sub_account_enrollment_term) do
          sub_account.enrollment_terms.create!
        end

        it "returns a Not Found status code" do
          post "/api/v1/accounts/#{root_account.id}/grading_period_sets",
               params: {
                 enrollment_term_ids: [sub_account_enrollment_term.id],
                 grading_period_set: group_helper.valid_attributes
               }
          expect(response).to have_http_status(:not_found)
        end
      end
    end

    describe "PATCH #update" do
      let(:new_attributes) { { title: "An updated title!", weighted: false } }
      let(:grading_period_set) { group_helper.create_for_account(root_account) }

      context "with valid params" do
        let(:patch_update) do
          patch "/api/v1/accounts/#{root_account.id}/grading_period_sets/#{grading_period_set.id}",
                params: {
                  enrollment_term_ids: [enrollment_term.to_param],
                  grading_period_set: new_attributes
                }
        end

        it "updates the requested grading_period_set" do
          patch_update
          grading_period_set.reload
          expect(grading_period_set.title).to eql new_attributes.fetch(:title)
          expect(grading_period_set.weighted).to eql new_attributes.fetch(:weighted)
        end

        it "returns no content" do
          patch_update
          expect(response.status).to eql Rack::Utils.status_code(:no_content)
        end

        it "removes enrollment terms from the set" do
          term = root_account.enrollment_terms.create!
          root_account.courses.create!(enrollment_term: term)
          grading_period_set.enrollment_terms << term
          patch "/api/v1/accounts/#{root_account.id}/grading_period_sets/#{grading_period_set.id}",
                params: { grading_period_set: new_attributes }
          expect(response).to have_http_status(:no_content)
          expect(grading_period_set.reload.enrollment_terms).not_to include(term)
        end
      end

      it "defaults enrollment_term_ids to empty array" do
        grading_period_set.enrollment_terms << enrollment_term
        patch "/api/v1/accounts/#{root_account.id}/grading_period_sets/#{grading_period_set.id}",
              params: { grading_period_set: group_helper.valid_attributes }
        expect(response.status).to eql Rack::Utils.status_code(:no_content)
        expect(grading_period_set.reload.enrollment_terms.count).to eq(0)
      end

      context "given a sub account enrollment term" do
        let(:sub_account) { root_account.sub_accounts.create! }
        let(:sub_account_enrollment_term) do
          sub_account.enrollment_terms.create!
        end

        it "returns a Not Found status code" do
          patch "/api/v1/accounts/#{root_account.id}/grading_period_sets/#{grading_period_set.id}",
                params: {
                  enrollment_term_ids: [sub_account_enrollment_term.id],
                  grading_period_set: group_helper.valid_attributes
                }
          expect(response).to have_http_status(:not_found)
        end
      end
    end

    describe "DELETE #destroy" do
      it "destroys the requested grading period set" do
        grading_period_set = group_helper.create_for_account(root_account)
        delete "/api/v1/accounts/#{Account.default.id}/grading_period_sets/#{grading_period_set.id}"
        expect(grading_period_set.reload.workflow_state).to eq "deleted"
      end
    end

    context "given a sub account" do
      let(:sub_account) { root_account.sub_accounts.create! }

      describe "GET #index" do
        it "fetches sets through the root account" do
          group = group_helper.create_for_account(root_account)
          get "/api/v1/accounts/#{sub_account.id}/grading_period_sets"
          sets = json_parse.fetch("grading_period_sets")
          expect(sets.count).to eq(1)
          expect(sets.first["id"]).to eq(group.id.to_s)
        end
      end
    end
  end
end
