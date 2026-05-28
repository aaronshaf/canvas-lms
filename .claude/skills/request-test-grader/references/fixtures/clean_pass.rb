# frozen_string_literal: true
# rubocop:disable all

# Grader spot-check fixture: expected result=pass.
# All applicable rules `pass` or `na`; zero `fail` verdicts.

RSpec.describe "GET /api/v1/grader_fixture/clean", type: :request do
  it "returns the fixture body for the requesting user" do
    # Arrange
    user = User.create!(name: "Fixture Reader")
    user_session(user)

    # Act
    get "/api/v1/grader_fixture/clean", params: { name: "Algebra 101" }

    # Assert
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["name"]).to eq("Algebra 101")
  end
end
