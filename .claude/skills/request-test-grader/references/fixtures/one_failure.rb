# frozen_string_literal: true
# rubocop:disable all

# Grader spot-check fixture: expected result=fail, failures=reload-assertions.
# 1 fail — reload-assertions (asserts DB state without `.reload`).

RSpec.describe "PUT /api/v1/grader_fixture/one_failure", type: :request do
  it "updates the fixture name in the database" do
    # Arrange
    course = Course.create!(name: "Original Name")
    user = User.create!(name: "Fixture Editor")
    user_session(user)

    # Act
    put "/api/v1/grader_fixture/one_failure", params: { course_id: course.id, name: "New Name" }

    # Assert
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["name"]).to eq("New Name")
    expect(course.name).to eq("New Name")
  end
end
