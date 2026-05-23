# frozen_string_literal: true
# rubocop:disable all

# Rubric spot-check fixture: expected grade B (minors arm).
# 3 minor ✗ — aaa-headers (no labels), symbol-statuses (integer status),
# use-parsed-body (JSON.parse instead of response.parsed_body).
# Covers the B rubric row's second arm ("3+ minor ✗ and no blockers/majors").
# Boundary: at 2 minors this would be A-; at 3 minors it must be B.

RSpec.describe "GET /api/v1/grader_fixture/b_minors", type: :request do
  it "returns the fixture body for the requesting user" do
    user = User.create!(name: "Fixture Reader")
    user_session(user)

    get "/api/v1/grader_fixture/b_minors", params: { name: "Algebra 101" }

    expect(response).to have_http_status(200)
    expect(JSON.parse(response.body)["name"]).to eq("Algebra 101")
  end
end
