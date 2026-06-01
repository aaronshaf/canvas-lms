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

require_relative "../common"
require_relative "../helpers/quizzes_common"

describe "quiz restrictions as a student" do
  include_context "in-process server selenium tests"
  include QuizzesCommon

  def begin_taking_quiz
    get "/courses/#{@course.id}/quizzes/#{@quiz.id}"
    expect_new_page_load { f("#take_quiz_link").click }
    sleep 1 # In this case the UI updates on a timer, not an ajax callback
  end

  context "restrict access code" do
    before do
      course_with_student_logged_in
      @password = "threepwood"
      @quiz = course_quiz(active: true)
      @quiz.publish!
      @quiz.access_code = @password
      @quiz.save!
    end

    it "requires an access code", priority: "1" do
      begin_taking_quiz
      expect(fj("input[type=password][name= 'access_code']")).to be_present
    end
  end
end
