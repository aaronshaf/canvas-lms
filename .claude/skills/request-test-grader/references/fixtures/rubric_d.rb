# frozen_string_literal: true
# rubocop:disable all

# Rubric spot-check fixture: expected grade D.
# 2 blocker ✗ — shape-and-value (body assertion is shape-only), reload-assertions.

RSpec.describe "PUT /api/v1/grader_fixture/d", type: :request do
  it "updates the fixture name and returns a body" do
    # Arrange
    course = Course.create!(name: "Original Name")
    user = User.create!(name: "Fixture Editor")
    user_session(user)

    # Act
    put "/api/v1/grader_fixture/d", params: { course_id: course.id, name: "New Name" }

    # Assert
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to have_key("name")
    expect(course.name).to eq("New Name")
  end
end
