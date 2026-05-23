# frozen_string_literal: true
# rubocop:disable all

# Rubric spot-check fixture: expected grade A-.
# 2 minor ✗ — aaa-headers (no labels), symbol-statuses (integer status).

RSpec.describe "GET /api/v1/grader_fixture/a_minus", type: :request do
  it "returns the fixture body for the requesting user" do
    user = User.create!(name: "Fixture Reader")
    user_session(user)

    get "/api/v1/grader_fixture/a_minus", params: { name: "Algebra 101" }

    expect(response).to have_http_status(200)
    expect(response.parsed_body["name"]).to eq("Algebra 101")
  end
end
