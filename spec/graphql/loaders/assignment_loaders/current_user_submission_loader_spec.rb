# frozen_string_literal: true

#
# Copyright (C) 2026 - present Instructure, Inc.
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
#

RSpec.describe Loaders::AssignmentLoaders::CurrentUserSubmissionLoader do
  before :once do
    course_with_teacher(active_all: true)
    @assignment1 = @course.assignments.create!(title: "Assignment 1", submission_types: "online_text_entry")
    @assignment2 = @course.assignments.create!(title: "Assignment 2", submission_types: "online_text_entry")

    @student1 = course_with_user("StudentEnrollment", course: @course, active_all: true).user
    @student2 = course_with_user("StudentEnrollment", course: @course, active_all: true).user
    @outsider = user_factory(active_all: true)
  end

  def batch_load(assignment_ids, user_id)
    GraphQL::Batch.batch do
      Promise.all(assignment_ids.map { |id| Loaders::AssignmentLoaders::CurrentUserSubmissionLoader.for(user_id).load(id) })
    end
  end

  it "returns nil for a user with no submission record" do
    results = batch_load([@assignment1.id], @outsider.id)
    expect(results[0]).to be_nil
  end

  it "returns the submission stub for an enrolled student" do
    results = batch_load([@assignment1.id], @student1.id)
    expect(results[0]).to be_a(Submission)
    expect(results[0].user_id).to eq(@student1.id)
    expect(results[0].assignment_id).to eq(@assignment1.id)
  end

  it "returns the submission with content after the student submits" do
    @assignment1.submit_homework(@student1, body: "hello")
    results = batch_load([@assignment1.id], @student1.id)
    expect(results[0]).to be_a(Submission)
    expect(results[0].body).to eq("hello")
  end

  it "scopes results by user_id and does not return another student's submission" do
    results = batch_load([@assignment1.id], @student1.id)
    expect(results[0].user_id).to eq(@student1.id)
  end

  it "loads submissions for multiple assignments in one query" do
    expect do
      batch_load([@assignment1.id, @assignment2.id], @student1.id)
    end.to make_database_queries(count: 1, matching: /SELECT.*FROM.*submissions/)
  end

  it "ignores deleted submissions" do
    sub = @assignment1.submissions.find_by(user: @student1)
    sub.update!(workflow_state: "deleted")
    results = batch_load([@assignment1.id], @student1.id)
    expect(results[0]).to be_nil
  end

  it "returns submissions for the correct user when multiple users have submissions" do
    results1 = batch_load([@assignment1.id], @student1.id)
    results2 = batch_load([@assignment1.id], @student2.id)
    expect(results1[0].user_id).to eq(@student1.id)
    expect(results2[0].user_id).to eq(@student2.id)
  end
end
