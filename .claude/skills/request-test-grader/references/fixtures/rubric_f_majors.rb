# frozen_string_literal: true
# rubocop:disable all

# Rubric spot-check fixture: expected grade F (majors arm).
# 5 major ✗, 0 blocker — second arm of the F rubric row ("5+ majors").
# Violations:
#   - one-it (sibling `it` in the same describe)
#   - no-shared-setup (`let(:user)`)
#   - no-runtime-branching (`if rand > 0.5`)
#   - literal-path (route helper)
#   - auth-matches-initiator (description names a bearer-token API client,
#     but the test uses `user_session` instead of an Authorization header)
# Boundary: at 4 majors this would be C; at 5 majors it must be F (not D, not C).

RSpec.describe "GET /api/v1/grader_fixture/f_majors", type: :request do
  let(:user) { User.create!(name: "Fixture Reader") }

  it "returns the fixture body for an external API client using a bearer token" do
    # Arrange
    user_session(user)
    if rand > 0.5
      request_name = "Algebra 101"
    else
      request_name = "Algebra 101"
    end

    # Act
    get grader_fixture_f_majors_path, params: { name: request_name }

    # Assert
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["name"]).to eq("Algebra 101")
  end

  it "is a sibling example used only to activate the one-it major" do
    user_session(user)
    get "/api/v1/grader_fixture/f_majors", params: { name: "Algebra 101" }
    expect(response).to have_http_status(:ok)
  end
end
