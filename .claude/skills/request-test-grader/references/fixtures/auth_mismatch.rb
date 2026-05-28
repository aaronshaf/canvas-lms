# frozen_string_literal: true
# rubocop:disable all

# Grader spot-check fixture: expected result=fail, failures=auth-matches-initiator.
# 1 fail — auth-matches-initiator (description says "external API client using a bearer token"
# but setup uses user_session, the human-via-canvas-ui pattern).

RSpec.describe "GET /api/v1/grader_fixture/auth_mismatch", type: :request do
  it "returns ok when called by an external API client using a bearer token" do
    # Arrange
    user = User.create!
    user_session(user)

    # Act
    get "/api/v1/grader_fixture/auth_mismatch"

    # Assert
    expect(response).to have_http_status(:ok)
  end
end
