# frozen_string_literal: true
# rubocop:disable all

# Grader spot-check fixture: expected result=fail, failures=no-magic-values.
# 1 fail — no-magic-values ("Unnamed Course" never appears in setup; course was
# created without an explicit name so the asserted value is a factory default).

RSpec.describe "GET /api/v1/grader_fixture/magic_values", type: :request do
  it "returns the course record with its default name" do
    # Arrange
    user = User.create!
    user_session(user)
    course = Course.create!(account: Account.default)

    # Act
    get "/api/v1/grader_fixture/magic_values/#{course.id}"

    # Assert
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["name"]).to eq("Unnamed Course")
  end
end
