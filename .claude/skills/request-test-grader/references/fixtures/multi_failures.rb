# frozen_string_literal: true
# rubocop:disable all

# Grader spot-check fixture: expected result=fail, failures={setup-in-it, shape-and-value, reload-assertions, precise-matchers}.
# 3 rule violations from the setup/assertion side:
#   - setup-in-it (let outside the it)
#   - shape-and-value (have_key instead of value check)
#   - reload-assertions (asserts course.name without `.reload`)
# Plus precise-matchers fail (have_key produces an uninformative true/false failure
# message — co-fires with shape-and-value per the rule's independence clause).

RSpec.describe "PUT /api/v1/grader_fixture/multi_failures", type: :request do
  let(:user) { User.create!(name: "Fixture Editor") }
  let(:course) { Course.create!(name: "Original Name") }

  it "updates the fixture and returns a body" do
    user_session(user)

    put "/api/v1/grader_fixture/multi_failures", params: { course_id: course.id, name: "New Name" }

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to have_key("name")
    expect(course.name).to eq("New Name")
  end
end
