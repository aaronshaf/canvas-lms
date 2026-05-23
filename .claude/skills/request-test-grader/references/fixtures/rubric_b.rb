# frozen_string_literal: true
# rubocop:disable all

# Rubric spot-check fixture: expected grade B.
# 1 major ✗ — literal-path (uses a route helper).

RSpec.describe "GET /api/v1/grader_fixture/b", type: :request do
  it "returns the fixture body for the requesting user" do
    # Arrange
    user = User.create!(name: "Fixture Reader")
    user_session(user)

    # Act
    get grader_fixture_b_path, params: { name: "Algebra 101" }

    # Assert
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["name"]).to eq("Algebra 101")
  end
end
