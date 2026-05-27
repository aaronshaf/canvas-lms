# frozen_string_literal: true
# rubocop:disable all

# Rubric spot-check fixture: expected grade F.
# 3 blocker ✗ — setup-in-it (let outside the it), shape-and-value (have_key),
# reload-assertions (asserts course.name without `.reload`).
# Covers F via the "3+ blockers" arm of the rubric.

RSpec.describe "PUT /api/v1/grader_fixture/f", type: :request do
  let(:user) { User.create!(name: "Fixture Editor") }
  let(:course) { Course.create!(name: "Original Name") }

  it "updates the fixture and returns a body" do
    user_session(user)

    put "/api/v1/grader_fixture/f", params: { course_id: course.id, name: "New Name" }

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to have_key("name")
    expect(course.name).to eq("New Name")
  end
end
