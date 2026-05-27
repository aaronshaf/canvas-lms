# frozen_string_literal: true
# rubocop:disable all

# Rubric spot-check fixture: expected grade A-.
# 1 minor ✗ — precise-matchers (be_successful instead of have_http_status).
# Covers the A- arm of the rubric: 1 minor must not silently drift to A.

RSpec.describe "GET /api/v1/grader_fixture/a_minus_one_minor", type: :request do
  it "returns the fixture body for the requesting user" do
    user = User.create!(name: "Fixture Reader")
    user_session(user)

    get "/api/v1/grader_fixture/a_minus_one_minor", params: { name: "Algebra 101" }

    expect(response).to be_successful
    expect(response.parsed_body["name"]).to eq("Algebra 101")
  end
end
