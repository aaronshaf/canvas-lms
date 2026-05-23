# frozen_string_literal: true
# rubocop:disable all

# Rubric spot-check fixture: expected grade A-.
# 1 minor ✗ — aaa-headers (no labels). Covers the A- lower bound:
# the rubric says "1–2 minor ✗ → A-", so 1 minor must not silently drift to A.

RSpec.describe "GET /api/v1/grader_fixture/a_minus_one_minor", type: :request do
  it "returns the fixture body for the requesting user" do
    user = User.create!(name: "Fixture Reader")
    user_session(user)

    get "/api/v1/grader_fixture/a_minus_one_minor", params: { name: "Algebra 101" }

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["name"]).to eq("Algebra 101")
  end
end
