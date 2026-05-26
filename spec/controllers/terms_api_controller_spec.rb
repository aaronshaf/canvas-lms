# frozen_string_literal: true

#
# Copyright (C) 2023 - present Instructure, Inc.
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

describe TermsApiController, type: :request do
  context "pagination" do
    before do
      account_model
      account_admin_user(account: @account)
      user_session(@user)
    end

    def create_terms_with_same_start(count)
      count.times do |i|
        start_time = Time.new(2024, 9, 10, 14, 30, 45, "+00:00")
        @account.enrollment_terms.create!(name: "term #{i}", start_at: start_time)
      end
    end

    it "gets the default term (non-paginated)" do
      get "/api/v1/accounts/#{@account.id}/terms"

      terms = response.parsed_body["enrollment_terms"]
      expect(terms.length).to eq 1
      expect(terms.pluck("id")).to eq @account.enrollment_terms.pluck(:id)
    end

    it "gets the first and second page of terms" do
      terms_per_page_count = Api::PER_PAGE
      new_terms_count = terms_per_page_count + 5
      default_term_count = 1

      get "/api/v1/accounts/#{@account.id}/terms"
      expect(response).to have_http_status(:ok)

      # create new terms
      create_terms_with_same_start(new_terms_count)

      # get the first page of term results
      get "/api/v1/accounts/#{@account.id}/terms"
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["enrollment_terms"].length).to eq terms_per_page_count

      # get the second page of term results
      get "/api/v1/accounts/#{@account.id}/terms", params: { page: 2 }
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["enrollment_terms"].length).to eq (new_terms_count - terms_per_page_count) + default_term_count
    end

    it "gets terms sorted by id when start_at matches" do
      new_terms_count = 5

      create_terms_with_same_start(new_terms_count)

      get "/api/v1/accounts/#{@account.id}/terms"
      expect(response).to have_http_status(:ok)

      terms = response.parsed_body["enrollment_terms"]
      first_term_id = terms.first["id"]
      last_term_id = terms.last["id"]
      expect(first_term_id).to be < last_term_id
    end
  end

  context "search" do
    before do
      account_model
      account_admin_user(account: @account)
      user_session(@user)
    end

    it "searches for a term" do
      terms = Array.new(3) do |i|
        @account.enrollment_terms.create!(name: "term #{i}")
      end

      get "/api/v1/accounts/#{@account.id}/terms", params: { term_name: "term 2" }
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["enrollment_terms"].pluck("id")).to eq [terms[2].id]
    end

    it "searches for a term that does not exist" do
      get "/api/v1/accounts/#{@account.id}/terms", params: { term_name: "term 2" }
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["enrollment_terms"]).to eq []
    end
  end

  context "used_in_subaccount indicator" do
    before :once do
      account_model
      account_admin_user(account: @account)
      @term0 = @account.enrollment_terms.create!(name: "term 0")
      @term1 = @account.enrollment_terms.create!(name: "term 1")
    end

    before do
      user_session(@user)
    end

    it "correctly sets used_in_subaccount indicator when subaccount_id is the root account" do
      @account.courses.create!(enrollment_term_id: @term0)
      get "/api/v1/accounts/#{@account.id}/terms", params: { subaccount_id: @account.id }
      expect(response).to have_http_status(:ok)
      term_0 = response.parsed_body["enrollment_terms"].find { |term| term["id"] == @term0.id }
      term_1 = response.parsed_body["enrollment_terms"].find { |term| term["id"] == @term1.id }
      expect(term_0["used_in_subaccount"]).to be(true)
      expect(term_1["used_in_subaccount"]).to be(false)
    end

    it "sets used_in_subaccount indicator when subaccount_id is a subaccount" do
      subaccount = @account.sub_accounts.create!(name: "sub")
      subsub = subaccount.sub_accounts.create!(name: "subsub")
      subsub.courses.create!(enrollment_term_id: @term0)
      get "/api/v1/accounts/#{@account.id}/terms", params: { subaccount_id: subsub.id }
      expect(response).to have_http_status(:ok)
      term_0 = response.parsed_body["enrollment_terms"].find { |term| term["id"] == @term0.id }
      term_1 = response.parsed_body["enrollment_terms"].find { |term| term["id"] == @term1.id }
      expect(term_0["used_in_subaccount"]).to be(true)
      expect(term_1["used_in_subaccount"]).to be(false)
    end

    it "404s if subaccount_id is an unrelated account" do
      get "/api/v1/accounts/#{@account.id}/terms", params: { subaccount_id: account_model.id }
      expect(response).to have_http_status :not_found
    end
  end

  context "permission checks" do
    before(:once) do
      account_model
      @admin_user = account_admin_user(account: @account)
      @term0 = @account.enrollment_terms.create!(name: "term 0")
      course_with_teacher_and_student_enrolled(account: @account)
    end

    it "returns json for teachers" do
      user_session(@teacher)
      get "/api/v1/accounts/#{@account.id}/terms"

      expect(response).to have_http_status(:ok)
      terms = response.parsed_body["enrollment_terms"]
      expect(terms.pluck("id")).to match_array @account.enrollment_terms.pluck(:id)
    end

    it "renders unauthorized access for teachers" do
      user_session(@teacher)
      get "/accounts/#{@account.id}/terms"
      # render_unauthorized_action => 401 when html format
      expect(response).to have_http_status(:unauthorized)
    end

    it "returns 403 for students" do
      user_session(@student)
      get "/api/v1/accounts/#{@account.id}/terms"

      expect(response).to have_http_status(:forbidden)
    end

    it "renders view for admin users" do
      user_session(@admin_user)
      get "/accounts/#{@account.id}/terms"
      expect(response).to have_http_status(:ok)
    end

    it "returns json for admin users" do
      user_session(@admin_user)
      get "/api/v1/accounts/#{@account.id}/terms"
      expect(response).to have_http_status(:ok)
      terms = response.parsed_body["enrollment_terms"]
      expect(terms.pluck("id")).to match_array @account.enrollment_terms.pluck(:id)
    end
  end
end
