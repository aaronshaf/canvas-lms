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

describe TermsApiController do
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

  # ---------------------------------------------------------------------------
  # Selenium replacement: enrollment override dates & admin terms page behaviors
  # Source rows: accounts_spec.rb:75,91,107 and
  #              account_admin_terms_spec.rb:102,130
  # ---------------------------------------------------------------------------
  describe "enrollment type date overrides" do
    it "persists and surfaces StudentEnrollment override dates in the API response" do
      # Arrange
      account = Account.create!(name: "Override Test Account")
      admin   = account_admin_user(account:)
      term    = account.enrollment_terms.create!(name: "Spring Override Term")
      student_start = Time.zone.parse("2011-07-02T00:00:00Z")
      student_end   = Time.zone.parse("2011-07-30T00:00:00Z")

      # Act
      user_session(admin)
      put "/api/v1/accounts/#{account.id}/terms/#{term.id}",
          params: {
            enrollment_term: {
              overrides: {
                "StudentEnrollment" => {
                  start_at: student_start.iso8601,
                  end_at: student_end.iso8601
                }
              }
            }
          }
      expect(response).to have_http_status(:ok)

      get "/api/v1/accounts/#{account.id}/terms",
          params: { include: ["overrides"] }
      expect(response).to have_http_status(:ok)

      # Assert — shape and value
      term_json = response.parsed_body["enrollment_terms"].find { |t| t["id"] == term.id }
      expect(term_json).not_to be_nil
      expect(term_json["overrides"]).to be_a(Hash)
      override = term_json["overrides"]["StudentEnrollment"]
      expect(override).not_to be_nil
      expect(Time.zone.parse(override["start_at"])).to be_within(1.second).of(student_start)
      expect(Time.zone.parse(override["end_at"])).to be_within(1.second).of(student_end)

      # DB state
      db_override = term.reload
                        .enrollment_dates_overrides
                        .find_by(enrollment_type: "StudentEnrollment")
      expect(db_override).not_to be_nil
      expect(db_override.start_at).to be_within(1.second).of(student_start)
      expect(db_override.end_at).to be_within(1.second).of(student_end)
    end

    it "persists and surfaces TeacherEnrollment override dates in the API response" do
      # Arrange
      account = Account.create!(name: "Teacher Override Account")
      admin   = account_admin_user(account:)
      term    = account.enrollment_terms.create!(name: "Fall Override Term")
      teacher_start = Time.zone.parse("2011-07-03T00:00:00Z")
      teacher_end   = Time.zone.parse("2011-07-29T00:00:00Z")

      # Act
      user_session(admin)
      put "/api/v1/accounts/#{account.id}/terms/#{term.id}",
          params: {
            enrollment_term: {
              overrides: {
                "TeacherEnrollment" => {
                  start_at: teacher_start.iso8601,
                  end_at: teacher_end.iso8601
                }
              }
            }
          }
      expect(response).to have_http_status(:ok)

      get "/api/v1/accounts/#{account.id}/terms",
          params: { include: ["overrides"] }
      expect(response).to have_http_status(:ok)

      # Assert — shape and value
      term_json = response.parsed_body["enrollment_terms"].find { |t| t["id"] == term.id }
      expect(term_json).not_to be_nil
      override = term_json["overrides"]["TeacherEnrollment"]
      expect(override).not_to be_nil
      expect(Time.zone.parse(override["start_at"])).to be_within(1.second).of(teacher_start)
      expect(Time.zone.parse(override["end_at"])).to be_within(1.second).of(teacher_end)

      # DB state
      db_override = term.reload
                        .enrollment_dates_overrides
                        .find_by(enrollment_type: "TeacherEnrollment")
      expect(db_override).not_to be_nil
      expect(db_override.start_at).to be_within(1.second).of(teacher_start)
      expect(db_override.end_at).to be_within(1.second).of(teacher_end)
    end

    it "persists and surfaces TaEnrollment override dates in the API response" do
      # Arrange
      account = Account.create!(name: "TA Override Account")
      admin   = account_admin_user(account:)
      term    = account.enrollment_terms.create!(name: "Summer Override Term")
      ta_start = Time.zone.parse("2011-07-04T00:00:00Z")
      ta_end   = Time.zone.parse("2011-07-28T00:00:00Z")

      # Act
      user_session(admin)
      put "/api/v1/accounts/#{account.id}/terms/#{term.id}",
          params: {
            enrollment_term: {
              overrides: {
                "TaEnrollment" => {
                  start_at: ta_start.iso8601,
                  end_at: ta_end.iso8601
                }
              }
            }
          }
      expect(response).to have_http_status(:ok)

      get "/api/v1/accounts/#{account.id}/terms",
          params: { include: ["overrides"] }
      expect(response).to have_http_status(:ok)

      # Assert — shape and value
      term_json = response.parsed_body["enrollment_terms"].find { |t| t["id"] == term.id }
      expect(term_json).not_to be_nil
      override = term_json["overrides"]["TaEnrollment"]
      expect(override).not_to be_nil
      expect(Time.zone.parse(override["start_at"])).to be_within(1.second).of(ta_start)
      expect(Time.zone.parse(override["end_at"])).to be_within(1.second).of(ta_end)

      # DB state
      db_override = term.reload
                        .enrollment_dates_overrides
                        .find_by(enrollment_type: "TaEnrollment")
      expect(db_override).not_to be_nil
      expect(db_override.start_at).to be_within(1.second).of(ta_start)
      expect(db_override.end_at).to be_within(1.second).of(ta_end)
    end
  end

  describe "admin terms page behaviors" do
    it "does not create an EnrollmentTerm when no POST is issued (GET-only visit)" do
      # Arrange
      account = Account.create!(name: "No-Create Account")
      admin   = account_admin_user(account:)
      initial_count = account.enrollment_terms.count

      # Act
      user_session(admin)
      get "/accounts/#{account.id}/terms"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(account.enrollment_terms.reload.count).to eq initial_count
    end

    it "returns grading_period_group_id in term JSON when a grading period group is linked" do
      # Arrange
      account = Account.create!(name: "GPG Account")
      admin   = account_admin_user(account:)
      term    = account.enrollment_terms.create!(name: "GPG Term")
      group   = account.grading_period_groups.create!(title: "My Grading Set")
      term.update!(grading_period_group: group)

      # Act
      user_session(admin)
      get "/api/v1/accounts/#{account.id}/terms/#{term.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body["id"]).to eq term.id
      expect(body["grading_period_group_id"]).to eq group.id
    end
  end
end
