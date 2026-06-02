# frozen_string_literal: true

#
# Copyright (C) 2026 - present Instructure, Inc.
#
# This file is part of Canvas.
#
# Canvas is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the
# Free Software Foundation, version 3 of the License.
#
# Canvas is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public
# License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program. If not, see <http://www.gnu.org/licenses/>.
#

describe "ContextModulesController" do
  # Helpers keep the mechanical record-building out of each example while
  # leaving the action and assertions inline, so every `it` still reads as a
  # self-contained story (no shared `before`/`let`; see Specs/NoNestedSetup).
  def course_with_logged_in_teacher
    course = course_factory(active_all: true)
    teacher = teacher_in_course(active_all: true, course:).user
    user_session(teacher)
    course
  end

  def create_modules(course, count)
    (1..count).map do |i|
      course.context_modules.create!(name: "Module #{i}", position: i)
    end
  end

  def create_assignment(course, title)
    course.assignments.create!(title:, submission_types: "online_text_entry")
  end

  def add_assignment_item(course, mod, title)
    mod.add_item({ type: "assignment", id: create_assignment(course, title).id })
  end

  # ---------------------------------------------------------------------------
  # Module reorder
  # Covers: spec/selenium/context_modules_v2/teachers/
  #         course_modules2_module_action_teacher_spec.rb:287,304,316,328
  # ---------------------------------------------------------------------------
  describe "POST /courses/:course_id/modules/reorder" do
    it "moves module down after second module" do
      # Arrange
      course = course_with_logged_in_teacher
      mod1, mod2, mod3, mod4 = create_modules(course, 4)

      # Act
      post "/courses/#{course.id}/modules/reorder",
           params: { order: "#{mod1.id},#{mod2.id},#{mod4.id},#{mod3.id}" }

      # Assert
      expect(response).to have_http_status(:ok)
      expect(mod4.reload.position).to eq(3)
      expect(course.context_modules.not_deleted.count).to eq(4)
    end

    it "moves module to bottom" do
      # Arrange
      course = course_with_logged_in_teacher
      mod1, mod2, mod3, mod4 = create_modules(course, 4)

      # Act
      post "/courses/#{course.id}/modules/reorder",
           params: { order: "#{mod2.id},#{mod3.id},#{mod4.id},#{mod1.id}" }

      # Assert
      expect(response).to have_http_status(:ok)
      expect(mod1.reload.position).to eq(4)
      expect(course.context_modules.not_deleted.count).to eq(4)
    end

    it "moves module to top" do
      # Arrange
      course = course_with_logged_in_teacher
      mod1, mod2, mod3, mod4 = create_modules(course, 4)

      # Act
      post "/courses/#{course.id}/modules/reorder",
           params: { order: "#{mod3.id},#{mod1.id},#{mod2.id},#{mod4.id}" }

      # Assert
      expect(response).to have_http_status(:ok)
      expect(mod3.reload.position).to eq(1)
      expect(course.context_modules.not_deleted.count).to eq(4)
    end

    it "moves module before first module" do
      # Arrange
      course = course_with_logged_in_teacher
      mod1, mod2, mod3, mod4 = create_modules(course, 4)

      # Act
      post "/courses/#{course.id}/modules/reorder",
           params: { order: "#{mod4.id},#{mod1.id},#{mod2.id},#{mod3.id}" }

      # Assert
      expect(response).to have_http_status(:ok)
      expect(mod4.reload.position).to eq(1)
      expect(course.context_modules.not_deleted.count).to eq(4)
    end
  end

  # ---------------------------------------------------------------------------
  # Module item reorder (move within and across modules)
  # Covers: spec/selenium/context_modules_v2/teachers/
  #         course_modules2_items_teacher_spec.rb:696,713,729
  # ---------------------------------------------------------------------------
  describe "POST /courses/:course_id/modules/:context_module_id/reorder" do
    it "moves a module item after another item in a different module" do
      # Arrange
      course = course_with_logged_in_teacher
      source_module = course.context_modules.create!(name: "Source Module")
      target_module = course.context_modules.create!(name: "Target Module")
      source_tag = add_assignment_item(course, source_module, "Source Assignment First")
      tgt_tag1   = add_assignment_item(course, target_module, "Target Assignment 1")
      tgt_tag2   = add_assignment_item(course, target_module, "Target Assignment 2")

      # Act
      post "/courses/#{course.id}/modules/#{target_module.id}/reorder",
           params: { order: "#{tgt_tag1.id},#{source_tag.id},#{tgt_tag2.id}" }

      # Assert
      expect(response).to have_http_status(:ok)
      expect(source_tag.reload.context_module_id).to eq(target_module.id)
      expect(source_tag.reload.position).to eq(2)
    end

    it "moves a module item before another item in the same module" do
      # Arrange
      course = course_with_logged_in_teacher
      source_module = course.context_modules.create!(name: "Source Module")
      tag1 = add_assignment_item(course, source_module, "Source Assignment 1")
      tag2 = add_assignment_item(course, source_module, "Source Assignment 2")
      tag3 = add_assignment_item(course, source_module, "Source Assignment 3")

      # Act
      post "/courses/#{course.id}/modules/#{source_module.id}/reorder",
           params: { order: "#{tag2.id},#{tag1.id},#{tag3.id}" }

      # Assert
      expect(response).to have_http_status(:ok)
      expect(tag2.reload.position).to eq(1)
      expect(tag1.reload.position).to eq(2)
    end

    it "moves a module item after another item in the same module" do
      # Arrange
      course = course_with_logged_in_teacher
      source_module = course.context_modules.create!(name: "Source Module")
      tag1 = add_assignment_item(course, source_module, "Source Assignment 1")
      tag2 = add_assignment_item(course, source_module, "Source Assignment 2")
      tag3 = add_assignment_item(course, source_module, "Source Assignment 3")

      # Act
      post "/courses/#{course.id}/modules/#{source_module.id}/reorder",
           params: { order: "#{tag1.id},#{tag3.id},#{tag2.id}" }

      # Assert
      expect(response).to have_http_status(:ok)
      expect(tag3.reload.position).to eq(2)
      expect(tag2.reload.position).to eq(3)
    end
  end

  # ---------------------------------------------------------------------------
  # Prerequisites persist via API
  # Covers: spec/selenium/context_modules_v2/teachers/
  #         course_modules2_module_action_teacher_spec.rb:96
  # ---------------------------------------------------------------------------
  describe "PUT /api/v1/courses/:course_id/modules/:id" do
    it "persists prerequisites when updated via API" do
      # Arrange
      course = course_with_logged_in_teacher
      mod1 = course.context_modules.create!(name: "Module 1")
      mod2 = course.context_modules.create!(name: "Module 2")

      # Act
      put "/api/v1/courses/#{course.id}/modules/#{mod2.id}",
          params: { module: { prerequisite_module_ids: [mod1.id] } }

      # Assert
      expect(response).to have_http_status(:ok)
      mod2.reload
      expect(mod2.prerequisites).not_to be_empty
      expect(mod2.prerequisites.pluck(:id)).to include(mod1.id)
    end

    it "persists completion_requirements for multiple items" do
      # Arrange
      course = course_with_logged_in_teacher
      mod = course.context_modules.create!(name: "Module With Requirements")
      tag1 = add_assignment_item(course, mod, "Assignment Item")
      quiz = course.quizzes.create!(title: "Quiz Item")
      tag2 = mod.add_item({ type: "quiz", id: quiz.id })

      # Act
      put "/courses/#{course.id}/modules/#{mod.id}",
          params: {
            context_module: {
              completion_requirements: {
                tag1.id.to_s => { type: "must_mark_done" },
                tag2.id.to_s => { type: "must_submit" }
              }
            }
          }

      # Assert
      expect(response).to have_http_status(:ok)
      mod.reload
      reqs = mod.completion_requirements
      tag1_req = reqs.find { |r| r[:id] == tag1.id }
      tag2_req = reqs.find { |r| r[:id] == tag2.id }
      expect(tag1_req).not_to be_nil
      expect(tag1_req[:type]).to eq("must_mark_done")
      expect(tag2_req).not_to be_nil
      expect(tag2_req[:type]).to eq("must_submit")
    end
  end
end
