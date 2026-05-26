# frozen_string_literal: true
# rubocop:disable all

# Rubric spot-check fixture: expected grade F (majors arm).
# 5 major ✗, 0 blocker — second arm of the F rubric row ("5+ majors").
# Violations:
#   - one-it (sibling `it` in the same describe)
#   - no-runtime-branching (`if rand > 0.5`)
#   - literal-path (route helper)
#   - auth-matches-initiator (description names the inst-fs sibling service as
#     the initiator, but the test uses `user_session` instead of inst-fs HMAC)
#   - precedent-matched (sibling-service initiator with a synthesized request
#     body and headers — not mirrored from any precedent spec)
# Boundary: at 4 majors this would be C; at 5 majors it must be F (not D, not C).
#
# Why no blocker fires:
#   - setup-in-it: user is created inline in the `it`; no `let`/`subject`/`@vars`/`before`.
#   - shape-and-value: body assertion checks both presence and value (`eq("Algebra 101")`).
#   - no-magic-values: the asserted name matches the request param.
#   - verify-stubs / stub-outbound: no WebMock stubs and no outbound HTTP.
#   - reload-assertions: no DB-state assertions.
#   - one-request: exactly one request.
#   - no-internal-mocks: no Canvas-internal mocks.
#   - eql-for-numerics: no numeric body assertions.
#   - no-magic-values: the only literal under assertion is also the input param.

RSpec.describe "POST /api/v1/grader_fixture/f_majors", type: :request do
  it "handles an attachment-finalized callback from the sibling inst-fs service" do
    # Arrange
    user = User.create!(name: "Fixture Reader")
    user_session(user)
    if rand > 0.5
      request_name = "Algebra 101"
    else
      request_name = "Algebra 101"
    end

    # Act
    post grader_fixture_f_majors_path, params: { name: request_name }

    # Assert
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["name"]).to eq("Algebra 101")
  end

  it "is a sibling example used only to activate the one-it major" do
    user = User.create!(name: "Fixture Reader 2")
    user_session(user)
    post "/api/v1/grader_fixture/f_majors", params: { name: "Algebra 101" }
    expect(response).to have_http_status(:ok)
  end
end
