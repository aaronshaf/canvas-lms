# frozen_string_literal: true

#
# Copyright (C) 2011 - present Instructure, Inc.
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

describe "RubricAssociations", type: :request do
  describe "POST 'create'" do
    it "requires authorization" do
      # Arrange
      course_with_teacher(active_all: true)
      rubric_association_model(user: @user, context: @course)

      # Act
      post "/courses/#{@course.id}/rubric_associations", params: { rubric_association: { rubric_id: @rubric.id } }

      # Assert
      expect(response).to redirect_to(login_url)
    end

    it "creates a rubric association and returns it in the response" do
      # Arrange
      course_with_teacher_logged_in(active_all: true)
      rubric_association_model(user: @user, context: @course)

      # Act
      post "/courses/#{@course.id}/rubric_associations", params: {
        rubric_association: { rubric_id: @rubric.id,
                              title: "some association",
                              association_type: @rubric_association.association_object.class.name,
                              association_id: @rubric_association.association_object.id }
      }

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["rubric_association"]["title"]).to eql("some association")
    end

    it "creates without manager_rubrics permission" do
      # Arrange
      course_with_teacher_logged_in(active_all: true)
      @course.account.role_overrides.create! role: teacher_role, permission: "manage_rubrics", enabled: false
      rubric_association_model(user: @user, context: @course)

      # Act
      post "/courses/#{@course.id}/rubric_associations", params: {
        rubric_association: { rubric_id: @rubric.id,
                              title: "some association",
                              association_type: @rubric_association.association_object.class.name,
                              association_id: @rubric_association.association_object.id }
      }

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["rubric_association"]["id"]).to be_present
    end

    describe "association_count in JSON response" do
      it "includes association_count when there is one association" do
        # Arrange
        course_with_teacher_logged_in(active_all: true)
        rubric = @course.rubrics.create!(title: "Test Rubric")
        assignment = @course.assignments.create!(title: "Test Assignment")

        # Act
        post "/courses/#{@course.id}/rubric_associations", params: {
          rubric_association: {
            rubric_id: rubric.id,
            association_type: "Assignment",
            association_id: assignment.id
          }
        }

        # Assert
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body["rubric_association"]["association_count"]).to be(1)
      end

      it "includes correct association_count when there are multiple associations" do
        # Arrange
        course_with_teacher_logged_in(active_all: true)
        rubric = @course.rubrics.create!(title: "Test Rubric")
        assignment1 = @course.assignments.create!(title: "Test Assignment 1")
        assignment2 = @course.assignments.create!(title: "Test Assignment 2")
        RubricAssociation.create!(
          rubric:,
          association_object: assignment1,
          context: @course,
          purpose: "grading"
        )

        # Act
        post "/courses/#{@course.id}/rubric_associations", params: {
          rubric_association: {
            rubric_id: rubric.id,
            association_type: "Assignment",
            association_id: assignment2.id
          }
        }

        # Assert
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body["rubric_association"]["association_count"]).to be(2)
      end
    end

    describe "AnonymousOrModerationEvent creation for auditable assignments" do
      it "records a rubric_created event for the assignment" do
        # Arrange
        course = Course.create!
        teacher = course.enroll_teacher(User.create!, active_all: true).user
        assignment = course.assignments.create!(anonymous_grading: true)
        rubric = Rubric.create!(title: "hi", context: course)
        request_params = {
          assignment_id: assignment.id,
          rubric_association: { association_id: assignment.id, association_type: "Assignment", rubric_id: rubric.id }
        }
        user_session(teacher)
        pre_count = AnonymousOrModerationEvent.where(event_type: "rubric_created", assignment:).count

        # Act
        post("/courses/#{course.id}/rubric_associations", params: request_params)

        # Assert
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body["rubric_association"]).to be_present
        expect(AnonymousOrModerationEvent.where(event_type: "rubric_created", assignment:).count).to eql(pre_count + 1)
      end

      it "includes the ID of the added rubric in the payload" do
        # Arrange
        course = Course.create!
        teacher = course.enroll_teacher(User.create!, active_all: true).user
        assignment = course.assignments.create!(anonymous_grading: true)
        rubric = Rubric.create!(title: "hi", context: course)
        request_params = {
          assignment_id: assignment.id,
          rubric_association: { association_id: assignment.id, association_type: "Assignment", rubric_id: rubric.id }
        }
        user_session(teacher)

        # Act
        post("/courses/#{course.id}/rubric_associations", params: request_params)

        # Assert
        expect(response).to have_http_status(:ok)
        event = AnonymousOrModerationEvent.find_by(event_type: "rubric_created", assignment:)
        expect(event.payload["id"]).to eql(rubric.id)
      end

      it "includes the updating user on the event" do
        # Arrange
        course = Course.create!
        teacher = course.enroll_teacher(User.create!, active_all: true).user
        assignment = course.assignments.create!(anonymous_grading: true)
        rubric = Rubric.create!(title: "hi", context: course)
        request_params = {
          assignment_id: assignment.id,
          rubric_association: { association_id: assignment.id, association_type: "Assignment", rubric_id: rubric.id }
        }
        user_session(teacher)

        # Act
        post("/courses/#{course.id}/rubric_associations", params: request_params)

        # Assert
        expect(response).to have_http_status(:ok)
        event = AnonymousOrModerationEvent.find_by(event_type: "rubric_created", assignment:)
        expect(event.user_id).to eql(teacher.id)
      end

      it "includes the associated assignment on the event" do
        # Arrange
        course = Course.create!
        teacher = course.enroll_teacher(User.create!, active_all: true).user
        assignment = course.assignments.create!(anonymous_grading: true)
        rubric = Rubric.create!(title: "hi", context: course)
        request_params = {
          assignment_id: assignment.id,
          rubric_association: { association_id: assignment.id, association_type: "Assignment", rubric_id: rubric.id }
        }
        user_session(teacher)

        # Act
        post("/courses/#{course.id}/rubric_associations", params: request_params)

        # Assert
        expect(response).to have_http_status(:ok)
        event = AnonymousOrModerationEvent.find_by(event_type: "rubric_created", assignment:)
        expect(event.assignment_id).to eql(assignment.id)
      end
    end

    describe "rubrics associated in a different" do
      specs_require_sharding

      describe "course" do
        it "duplicates the associated rubric" do
          # Arrange
          course_factory # @course = course1 (rubric's home)
          outcome_with_rubric(mastery_points: 3)            # @rubric.context = course1
          @course2 = course_factory                         # @course = course2 (association target)
          course_with_teacher_logged_in(active_all: true, course: @course2)
          assignment = @course2.assignments.create!(title: "Test Assignment")
          initial_count = Rubric.count

          # Act
          post "/courses/#{@course2.id}/rubric_associations", params: {
            rubric_association: { rubric_id: @rubric.id, association_type: "Assignment", association_id: assignment.id }
          }

          # Assert
          expect(response).to have_http_status(:ok)
          expect(Rubric.count).to eql(initial_count + 1)
          new_rubric = Rubric.where(context: @course2).order(:created_at).last
          expect(new_rubric.context).to eq(@course2)
          expect(new_rubric.data).to eq(@rubric.data)
        end

        it "duplicates the associated rubric into the correct shard" do
          # Arrange
          course_factory                          # @course = course1 (rubric's home)
          outcome_with_rubric(mastery_points: 3)  # @rubric.context = course1
          # GuardRail.activate(:secondary) restricts the DB role to read-only in the test
          # environment. The cross-shard write path in the controller happens before any
          # secondary activation, but the permission check machinery triggers it — stub to
          # prevent PG::InsufficientPrivilege on the rubric write.
          allow(GuardRail).to receive(:activate).and_call_original
          allow(GuardRail).to receive(:activate).with(:secondary).and_yield
          @shard2.activate do
            account_model
            @course3 = course_factory(account: @account)
            @assignment = assignment_model(course: @course3)
            course_with_teacher_logged_in(active_all: true, course: @course3)
          end

          # Act
          post "/courses/#{@course3.global_id}/rubric_associations", params: {
            rubric_association: { rubric_id: @rubric.global_id, association_id: @assignment.id, association_type: "Assignment" }
          }

          # Assert
          expect(response).to have_http_status(:ok)
          new_rubric = @shard2.activate { Rubric.where(context: @course3).order(:created_at).last }
          expect(new_rubric.context).to eq(@course3)
          expect(new_rubric.data).to eq(@rubric.data)
          expect(new_rubric.shard).to eq(@shard2)
        end

        describe "with the account_level_mastery_scales FF" do
          describe "enabled" do
            it "uses the new course mastery scales for learning outcome criterion" do
              # Arrange
              course_factory # @course = course1
              outcome_with_rubric(mastery_points: 3)            # @rubric.context = course1
              @course2 = course_factory                         # @course = course2
              course_with_teacher_logged_in(active_all: true, course: @course2)
              @course2.root_account.enable_feature!(:account_level_mastery_scales)
              proficiency = outcome_proficiency_model(@course2)
              mastery_rating = proficiency.outcome_proficiency_ratings.find(&:mastery)
              expected_points = mastery_rating.points
              expected_descriptions = proficiency.outcome_proficiency_ratings
                                                 .sort_by { |r| -r.points }
                                                 .map(&:description)
              assignment = @course2.assignments.create!(title: "Test Assignment")

              # Act
              post "/courses/#{@course2.id}/rubric_associations", params: {
                rubric_association: { rubric_id: @rubric.id, association_type: "Assignment", association_id: assignment.id }
              }

              # Assert
              expect(response).to have_http_status(:ok)
              new_rubric = Rubric.where(context: @course2).last
              outcome_criterion = new_rubric.data[0]
              expect(outcome_criterion[:ratings].length).to eql(proficiency.outcome_proficiency_ratings.count)
              expect(outcome_criterion[:points]).to eql(expected_points)
              expect(outcome_criterion[:mastery_points]).to eql(expected_points)
              expect(outcome_criterion[:ratings].pluck(:description)).to eq(expected_descriptions)
            end
          end

          describe "disabled" do
            it "does not change the existing criterions" do
              # Arrange
              course_factory # @course = course1
              outcome_with_rubric(mastery_points: 3)            # @rubric.context = course1
              @course2 = course_factory                         # @course = course2
              course_with_teacher_logged_in(active_all: true, course: @course2)
              @course2.root_account.disable_feature!(:account_level_mastery_scales)
              outcome_proficiency_model(@course2)
              original_rubric_data = @rubric.data
              assignment = @course2.assignments.create!(title: "Test Assignment")

              # Act
              post "/courses/#{@course2.id}/rubric_associations", params: {
                rubric_association: { rubric_id: @rubric.id, association_type: "Assignment", association_id: assignment.id }
              }

              # Assert
              expect(response).to have_http_status(:ok)
              expect(Rubric.where(context: @course2).last.data).to eq(original_rubric_data)
            end
          end
        end
      end

      describe "account" do
        it "does not duplicate the rubric" do
          # Arrange
          account_model # @account (non-Course rubric context)
          outcome_with_rubric({ mastery_points: 3, context: @account }) # @rubric.context = @account
          course_with_teacher_logged_in(active_all: true) # creates @course
          assignment = @course.assignments.create!(title: "Test Assignment")
          initial_count = Rubric.count

          # Act
          post "/courses/#{@course.id}/rubric_associations", params: {
            rubric_association: { rubric_id: @rubric.id, association_type: "Assignment", association_id: assignment.id }
          }

          # Assert
          expect(response).to have_http_status(:ok)
          expect(Rubric.count).to eql(initial_count)
          expect(response.parsed_body["rubric"]["id"]).to eql(@rubric.id)
        end
      end
    end
  end

  describe "PUT 'update'" do
    it "requires authorization" do
      # Arrange
      course_with_teacher(active_all: true)
      rubric_association_model(user: @user, context: @course)

      # Act
      put "/courses/#{@course.id}/rubric_associations/#{@rubric_association.id}"

      # Assert
      expect(response).to redirect_to(login_url)
    end

    it "updates a rubric association and returns it in the response" do
      # Arrange
      course_with_teacher_logged_in(active_all: true)
      rubric_association_model(user: @user, context: @course)

      # Act
      put "/courses/#{@course.id}/rubric_associations/#{@rubric_association.id}", params: { rubric_association: { title: "some association" } }

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["rubric_association"]["title"]).to eql("some association")
    end

    it "updates the rubric if updateable" do
      # Arrange
      course_with_teacher_logged_in(active_all: true)
      rubric_association_model(user: @user, context: @course)

      # Act
      put "/courses/#{@course.id}/rubric_associations/#{@rubric_association.id}", params: { rubric: { title: "new title" }, rubric_association: { title: "some association" } }

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["rubric"]["title"]).to eql("new title")
      expect(response.parsed_body["rubric_association"]["title"]).to eql("some association")
    end

    it "does not update the rubric if not updateable (should make a new one instead)" do
      # Arrange
      course_with_teacher_logged_in(active_all: true)
      rubric_association_model(user: @user, context: @course, purpose: "grading")
      @rubric.associate_with(@course, @course, purpose: "grading")
      original_title = @rubric.title

      # Act
      put "/courses/#{@course.id}/rubric_associations/#{@rubric_association.id}", params: { rubric: { title: "new title" }, rubric_association: { title: "some association" } }

      # Assert
      expect(response).to have_http_status(:ok)
      expect(@rubric.reload.title).to eql(original_title)
      expect(response.parsed_body["rubric_association"]["title"]).to eql("some association")
    end

    describe "AnonymousOrModerationEvent creation for auditable assignments" do
      it "records a rubric_updated event for the assignment" do
        # Arrange
        course = Course.create!
        teacher = course.enroll_teacher(User.create!, active_all: true).user
        assignment = course.assignments.create!(anonymous_grading: true)
        old_rubric = Rubric.create!(title: "zzz", context: course)
        RubricAssociation.generate(teacher, old_rubric, course, association_object: assignment, purpose: "grading")
        rubric = Rubric.create!(title: "hi", context: course)
        request_params = {
          assignment_id: assignment.id,
          rubric_association: { association_id: assignment.id, association_type: "Assignment", rubric_id: rubric.id }
        }
        user_session(teacher)
        pre_count = AnonymousOrModerationEvent.where(event_type: "rubric_updated", assignment:).count

        # Act
        put("/courses/#{course.id}/rubric_associations/0", params: request_params)

        # Assert
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body["rubric_association"]).to be_present
        expect(AnonymousOrModerationEvent.where(event_type: "rubric_updated", assignment:).count).to eql(pre_count + 1)
      end

      it "includes the ID of the removed rubric in the payload" do
        # Arrange
        course = Course.create!
        teacher = course.enroll_teacher(User.create!, active_all: true).user
        assignment = course.assignments.create!(anonymous_grading: true)
        old_rubric = Rubric.create!(title: "zzz", context: course)
        RubricAssociation.generate(teacher, old_rubric, course, association_object: assignment, purpose: "grading")
        rubric = Rubric.create!(title: "hi", context: course)
        request_params = {
          assignment_id: assignment.id,
          rubric_association: { association_id: assignment.id, association_type: "Assignment", rubric_id: rubric.id }
        }
        user_session(teacher)

        # Act
        put("/courses/#{course.id}/rubric_associations/0", params: request_params)

        # Assert
        expect(response).to have_http_status(:ok)
        event = AnonymousOrModerationEvent.find_by(event_type: "rubric_updated", assignment:)
        expect(event.payload["id"].first).to eql(old_rubric.id)
      end

      it "includes the ID of the added rubric in the payload" do
        # Arrange
        course = Course.create!
        teacher = course.enroll_teacher(User.create!, active_all: true).user
        assignment = course.assignments.create!(anonymous_grading: true)
        old_rubric = Rubric.create!(title: "zzz", context: course)
        RubricAssociation.generate(teacher, old_rubric, course, association_object: assignment, purpose: "grading")
        rubric = Rubric.create!(title: "hi", context: course)
        request_params = {
          assignment_id: assignment.id,
          rubric_association: { association_id: assignment.id, association_type: "Assignment", rubric_id: rubric.id }
        }
        user_session(teacher)

        # Act
        put("/courses/#{course.id}/rubric_associations/0", params: request_params)

        # Assert
        expect(response).to have_http_status(:ok)
        event = AnonymousOrModerationEvent.find_by(event_type: "rubric_updated", assignment:)
        expect(event.payload["id"].second).to eql(rubric.id)
      end

      it "includes the updating user on the event" do
        # Arrange
        course = Course.create!
        teacher = course.enroll_teacher(User.create!, active_all: true).user
        assignment = course.assignments.create!(anonymous_grading: true)
        old_rubric = Rubric.create!(title: "zzz", context: course)
        RubricAssociation.generate(teacher, old_rubric, course, association_object: assignment, purpose: "grading")
        rubric = Rubric.create!(title: "hi", context: course)
        request_params = {
          assignment_id: assignment.id,
          rubric_association: { association_id: assignment.id, association_type: "Assignment", rubric_id: rubric.id }
        }
        user_session(teacher)

        # Act
        put("/courses/#{course.id}/rubric_associations/0", params: request_params)

        # Assert
        expect(response).to have_http_status(:ok)
        event = AnonymousOrModerationEvent.find_by(event_type: "rubric_updated", assignment:)
        expect(event.user_id).to eql(teacher.id)
      end

      it "includes the associated assignment on the event" do
        # Arrange
        course = Course.create!
        teacher = course.enroll_teacher(User.create!, active_all: true).user
        assignment = course.assignments.create!(anonymous_grading: true)
        old_rubric = Rubric.create!(title: "zzz", context: course)
        RubricAssociation.generate(teacher, old_rubric, course, association_object: assignment, purpose: "grading")
        rubric = Rubric.create!(title: "hi", context: course)
        request_params = {
          assignment_id: assignment.id,
          rubric_association: { association_id: assignment.id, association_type: "Assignment", rubric_id: rubric.id }
        }
        user_session(teacher)

        # Act
        put("/courses/#{course.id}/rubric_associations/0", params: request_params)

        # Assert
        expect(response).to have_http_status(:ok)
        event = AnonymousOrModerationEvent.find_by(event_type: "rubric_updated", assignment:)
        expect(event.assignment_id).to eql(assignment.id)
      end
    end
  end

  describe "DELETE 'destroy'" do
    it "requires authorization" do
      # Arrange
      course_with_teacher(active_all: true)
      rubric_association_model(user: @user, context: @course)

      # Act
      delete "/courses/#{@course.id}/rubric_associations/#{@rubric_association.id}"

      # Assert
      expect(response).to redirect_to(login_url)
    end

    it "deletes the rubric if deletable" do
      # Arrange
      course_with_teacher_logged_in(active_all: true)
      rubric_association_model(user: @user, context: @course)

      # Act
      delete "/courses/#{@course.id}/rubric_associations/#{@rubric_association.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["rubric_association"]["id"]).to eql(@rubric_association.id)
      expect(@rubric_association.reload).to be_deleted
      expect(@rubric.reload).to be_deleted
    end

    it "does not delete the rubric if still created at the context level instead of the assignment level" do
      # Arrange
      course_with_teacher_logged_in(active_all: true)
      rubric_association_model(user: @user, context: @course)
      @rubric.associate_with(@course, @course, purpose: "bookmark")

      # Act
      delete "/courses/#{@course.id}/rubric_associations/#{@rubric_association.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["rubric_association"]["id"]).to eql(@rubric_association.id)
      expect(@rubric.reload).not_to be_deleted
      expect(@rubric.reload).not_to be_frozen
      expect(@rubric_association.reload).to be_deleted
    end

    it "deletes only the association if the rubric is not deletable" do
      # Arrange
      rubric_association_model
      course_with_teacher_logged_in(active_all: true)
      rubric_association_model(user: @user, context: @course, rubric: @rubric, purpose: "grading")
      @rubric.associate_with(@course, @course, purpose: "grading")
      @rubric.associate_with(@course, @course, purpose: "bookmark")

      # Act
      delete "/courses/#{@course.id}/rubric_associations/#{@rubric_association.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(@rubric.reload).not_to be_deleted
      expect(@rubric.reload).not_to be_frozen
      expect(@rubric_association.reload).to be_deleted
    end

    it "removes alignment links" do
      # Arrange
      course_with_teacher_logged_in(active_all: true)
      outcome_with_rubric # creates @rubric with one learning outcome alignment
      rubric_association_model(user: @user, context: @course, rubric: @rubric)

      # Act
      delete "/courses/#{@course.id}/rubric_associations/#{@rubric_association.id}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(@rubric.reload).to be_deleted
      expect(@rubric_association_object.reload.learning_outcome_alignments.count).to be(0)
      expect(@rubric.reload.learning_outcome_alignments.count).to be(0)
    end

    context "when associated with an auditable assignment" do
      it "creates an AnonymousOrModerationEvent capturing the deletion" do
        # Arrange
        course = Course.create!
        teacher = course.enroll_teacher(User.create!, active_all: true).user
        assignment = course.assignments.create!(anonymous_grading: true)
        rubric = Rubric.create!(title: "aaa", context: course)
        rubric_association = RubricAssociation.generate(teacher, rubric, course, purpose: "grading", association_object: assignment)
        user_session(teacher)
        pre_count = AnonymousOrModerationEvent.where(event_type: "rubric_deleted", assignment:, user: teacher).count

        # Act
        delete("/courses/#{course.id}/rubric_associations/#{rubric_association.id}")

        # Assert
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body["rubric_association"]["id"]).to eql(rubric_association.id)
        expect(AnonymousOrModerationEvent.where(event_type: "rubric_deleted", assignment:, user: teacher).count).to eql(pre_count + 1)
      end

      it "includes the removed rubric in the event payload" do
        # Arrange
        course = Course.create!
        teacher = course.enroll_teacher(User.create!, active_all: true).user
        assignment = course.assignments.create!(anonymous_grading: true)
        rubric = Rubric.create!(title: "aaa", context: course)
        rubric_association = RubricAssociation.generate(teacher, rubric, course, purpose: "grading", association_object: assignment)
        user_session(teacher)

        # Act
        delete("/courses/#{course.id}/rubric_associations/#{rubric_association.id}")

        # Assert
        expect(response).to have_http_status(:ok)
        event = AnonymousOrModerationEvent.find_by(event_type: "rubric_deleted", assignment:, user: teacher)
        expect(event.payload["id"]).to eql(rubric.id)
      end
    end
  end
end
