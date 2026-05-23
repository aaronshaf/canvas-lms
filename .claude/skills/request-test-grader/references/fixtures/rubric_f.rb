# frozen_string_literal: true
# rubocop:disable all

# Rubric spot-check fixture: expected grade F.
# 3 blocker ✗ — one-request (two HTTP calls), shape-and-value, reload-assertions.

RSpec.describe "PUT /api/v1/grader_fixture/f", type: :request do
  it "updates the fixture and reads the updated state" do
    # Arrange
    course = Course.create!(name: "Original Name")
    user = User.create!(name: "Fixture Editor")
    user_session(user)

    # Act
    put "/api/v1/grader_fixture/f", params: { course_id: course.id, name: "New Name" }
    get "/api/v1/grader_fixture/f", params: { course_id: course.id }

    # Assert
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to have_key("name")
    expect(course.name).to eq("New Name")
  end
end
