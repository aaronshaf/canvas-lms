# frozen_string_literal: true

#
# Copyright (C) 2015 - present Instructure, Inc.
#
# This file is part of Canvas.
#
# Canvas is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License along
# with this program. If not, see <http://www.gnu.org/licenses/>.

context "accessing public content" do
  before do
    course_factory(active_all: true)
    @course.update_attribute(:is_public, true)
    @course.update_attribute(:is_public_to_auth_users, true)
  end

  def test_public_access
    enable_cache do
      Timecop.freeze(10.seconds.ago) do
        yield
        expect(response).to be_successful
      end

      Timecop.freeze(8.seconds.ago) do
        @course.update_attribute(:is_public, false)
        @course.touch_content_if_public_visibility_changed(is_public: [true, false])

        yield
        assert_unauthorized
      end

      user_factory
      user_session(@user)

      Timecop.freeze(5.seconds.ago) do
        yield
        expect(response).to be_successful
      end

      @course.update_attribute(:is_public_to_auth_users, false)
      @course.touch_content_if_public_visibility_changed(is_public_to_auth_users: [true, false])

      yield
      assert_unauthorized
    end
  end

  it "shows assignments" do
    assignment = @course.assignments.create!(name: "blah")

    test_public_access do
      get "/courses/#{@course.id}/assignments/#{assignment.id}"
    end
  end

  it "shows quizzes" do
    quiz = @course.quizzes.create!
    quiz.publish!

    test_public_access do
      get "/courses/#{@course.id}/quizzes/#{quiz.id}"
    end
  end

  it "shows wiki pages" do
    page = @course.wiki_pages.create!(title: "stuff")

    test_public_access do
      get "/courses/#{@course.id}/pages/#{page.url}"
    end
  end

  it "lists published quizzes by title on the public quizzes index" do
    quiz = @course.quizzes.create!(title: "hey you should see me")
    quiz.publish!

    get "/courses/#{@course.id}/quizzes"

    expect(response).to be_successful
    assignment_quizzes = controller.js_env[:QUIZZES][:assignment]
    expect(assignment_quizzes.pluck(:title)).to include("hey you should see me")
    expect(assignment_quizzes.find { |q| q[:title] == "hey you should see me" }[:id].to_i).to eq quiz.id
  end
end
