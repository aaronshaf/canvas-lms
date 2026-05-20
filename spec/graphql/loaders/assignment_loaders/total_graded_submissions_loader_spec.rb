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

RSpec.describe Loaders::AssignmentLoaders::TotalGradedSubmissionsLoader do
  before :once do
    course_with_teacher(active_all: true)
    @assignment1 = @course.assignments.create!(
      title: "Assignment 1",
      submission_types: "online_text_entry",
      points_possible: 10
    )
    @assignment2 = @course.assignments.create!(
      title: "Assignment 2",
      submission_types: "online_text_entry",
      points_possible: 10
    )

    @student1 = course_with_user("StudentEnrollment", course: @course, active_all: true).user
    @student2 = course_with_user("StudentEnrollment", course: @course, active_all: true).user
  end

  def batch_load(assignment_ids)
    GraphQL::Batch.batch do
      Promise.all(assignment_ids.map { |id| Loaders::AssignmentLoaders::TotalGradedSubmissionsLoader.load(id) })
    end
  end

  it "returns 0 for assignments with no graded submissions" do
    results = batch_load([@assignment1.id, @assignment2.id])
    expect(results).to eq([0, 0])
  end

  it "counts graded submissions" do
    sub = @assignment1.submit_homework(@student1, body: "hello")
    sub.update!(workflow_state: "graded", score: 8)
    results = batch_load([@assignment1.id, @assignment2.id])
    expect(results[0]).to eq(1)
    expect(results[1]).to eq(0)
  end

  it "counts excused submissions" do
    sub = @assignment1.submissions.find_by(user: @student1)
    sub.update!(excused: true)
    results = batch_load([@assignment1.id])
    expect(results[0]).to eq(1)
  end

  it "excludes ungraded submitted submissions" do
    @assignment1.submit_homework(@student1, body: "hello")
    results = batch_load([@assignment1.id])
    expect(results[0]).to eq(0)
  end

  it "ignores deleted submissions" do
    sub = @assignment1.submit_homework(@student1, body: "hello")
    sub.update!(workflow_state: "deleted")
    results = batch_load([@assignment1.id])
    expect(results[0]).to eq(0)
  end

  it "batches into a single query" do
    sub = @assignment1.submit_homework(@student1, body: "hello")
    sub.update!(workflow_state: "graded", score: 10)
    expect do
      batch_load([@assignment1.id, @assignment2.id])
    end.to make_database_queries(count: 1, matching: /SELECT.*FROM.*submissions/)
  end
end
