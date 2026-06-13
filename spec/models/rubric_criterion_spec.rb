# frozen_string_literal: true

#
# Copyright (C) 2023 - present Instructure, Inc.
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

describe RubricCriterion do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:rubric) { rubric_for_course }
  let_once(:teacher) { User.create! }

  it "allows creation of a valid rubric criterion" do
    root_account_id = @course.root_account.id
    rubric_criterion = RubricCriterion.create!(rubric: @rubric, description: "criterion", points: 10, order: 1, created_by: teacher, root_account_id:)
    expect(rubric_criterion.errors.full_messages).to be_empty
    expect(rubric_criterion.valid?).to be_truthy
    expect(rubric_criterion.active?).to be_truthy
    expect(rubric_criterion.rubric).to eq(rubric)
    expect(rubric_criterion.description).to eq("criterion")
  end

  describe "preserves plain-text fields on save" do
    let(:root_account_id) { @course.root_account.id }

    def create_criterion(attrs = {})
      RubricCriterion.create!({
        rubric: @rubric,
        description: "ok",
        points: 10,
        order: 1,
        created_by: teacher,
        root_account_id:,
      }.merge(attrs))
    end

    it "saves description containing < and & as raw plain text" do
      expect(create_criterion(description: "5 < 10 & A").description).to eq("5 < 10 & A")
    end

    it "saves long_description containing <word>-shaped substrings as raw plain text" do
      expect(create_criterion(long_description: "Identify <key concepts>").long_description).to eq("Identify <key concepts>")
    end

    it "saves description containing NBSP as raw plain text" do
      nbsp_input = "a b"
      expect(create_criterion(description: nbsp_input).description).to eq(nbsp_input)
    end

    it "saves description containing quotes as raw plain text" do
      expect(create_criterion(description: %(say "hi" and don't)).description).to eq(%(say "hi" and don't))
    end

    it "saves <script> in description verbatim (render layer is the XSS boundary)" do
      rc = create_criterion(description: "<script>alert('xss')</script>")
      expect(rc.description).to eq("<script>alert('xss')</script>")
    end

    it "saves <script> in long_description verbatim (render layer is the XSS boundary)" do
      rc = create_criterion(long_description: "<p>keep</p><script>alert('xss')</script>")
      expect(rc.long_description).to eq("<p>keep</p><script>alert('xss')</script>")
    end

    it "preserves field values across updates" do
      rc = create_criterion(description: "first")
      rc.update!(description: "5 < 10 & A", long_description: "Identify <key concepts>")
      expect(rc.reload.description).to eq("5 < 10 & A")
      expect(rc.long_description).to eq("Identify <key concepts>")
    end
  end
end
