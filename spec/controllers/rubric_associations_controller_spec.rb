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
      course_with_teacher(active_all: true)
      rubric_association_model(user: @user, context: @course)
      post "/courses/#{@course.id}/rubric_associations", params: { rubric_association: { rubric_id: @rubric.id } }
      assert_unauthorized
    end

    it "assigns variables" do
      course_with_teacher_logged_in(active_all: true)
      rubric_association_model(user: @user, context: @course)
      post "/courses/#{@course.id}/rubric_associations", params: {
        rubric_association: { rubric_id: @rubric.id,
                              title: "some association",
                              association_type: @rubric_association.association_object.class.name,
                              association_id: @rubric_association.association_object.id }
      }
      expect(response).to be_successful
      expect(response.parsed_body["rubric_association"]["title"]).to eql("some association")
    end

    it "creates without manager_rubrics permission" do
      course_with_teacher_logged_in(active_all: true)
      @course.account.role_overrides.create! role: teacher_role, permission: "manage_rubrics", enabled: false
      rubric_association_model(user: @user, context: @course)
      post "/courses/#{@course.id}/rubric_associations", params: {
        rubric_association: { rubric_id: @rubric.id,
                              title: "some association",
                              association_type: @rubric_association.association_object.class.name,
                              association_id: @rubric_association.association_object.id }
      }
      expect(response).to be_successful
    end

    describe "association_count in JSON response" do
      it "includes association_count when there is one association" do
        course_with_teacher_logged_in(active_all: true)
        rubric = @course.rubrics.create!(title: "Test Rubric")
        assignment = @course.assignments.create!(title: "Test Assignment")

        post "/courses/#{@course.id}/rubric_associations", params: {
          rubric_association: {
            rubric_id: rubric.id,
            association_type: "Assignment",
            association_id: assignment.id
          }
        }

        expect(response).to be_successful
        expect(response.parsed_body["rubric_association"]["association_count"]).to eq 1
      end

      it "includes correct association_count when there are multiple associations" do
        course_with_teacher_logged_in(active_all: true)
        rubric = @course.rubrics.create!(title: "Test Rubric")
        assignment1 = @course.assignments.create!(title: "Test Assignment 1")
        assignment2 = @course.assignments.create!(title: "Test Assignment 2")

        # Create first association
        RubricAssociation.create!(
          rubric:,
          association_object: assignment1,
          context: @course,
          purpose: "grading"
        )

        # Create second association via API
        post "/courses/#{@course.id}/rubric_associations", params: {
          rubric_association: {
            rubric_id: rubric.id,
            association_type: "Assignment",
            association_id: assignment2.id
          }
        }

        expect(response).to be_successful
        expect(response.parsed_body["rubric_association"]["association_count"]).to eq 2
      end
    end

    describe "AnonymousOrModerationEvent creation for auditable assignments" do
      let(:course) { Course.create! }
      let(:teacher) { course.enroll_teacher(User.create!, active_all: true).user }
      let(:assignment) { course.assignments.create!(anonymous_grading: true) }
      let(:rubric) { Rubric.create!(title: "hi", context: course) }

      let(:association_params) do
        { association_id: assignment.id, association_type: "Assignment", rubric_id: rubric.id }
      end
      let(:request_params) do
        { assignment_id: assignment.id, rubric_association: association_params }
      end

      let(:last_created_event) { AnonymousOrModerationEvent.where(event_type: "rubric_created").last }

      before do
        user_session(teacher)
      end

      it "records a rubric_created event for the assignment" do
        expect do
          post("/courses/#{course.id}/rubric_associations", params: request_params)
        end.to change {
          AnonymousOrModerationEvent.where(event_type: "rubric_created", assignment:).count
        }.by(1)
      end

      it "includes the ID of the added rubric in the payload" do
        post("/courses/#{course.id}/rubric_associations", params: request_params)
        expect(last_created_event.payload["id"]).to eq rubric.id
      end

      it "includes the updating user on the event" do
        post("/courses/#{course.id}/rubric_associations", params: request_params)
        expect(last_created_event.user_id).to eq teacher.id
      end

      it "includes the associated assignment on the event" do
        post("/courses/#{course.id}/rubric_associations", params: request_params)
        expect(last_created_event.assignment_id).to eq assignment.id
      end
    end

    describe "rubrics associated in a different" do
      specs_require_sharding
      describe "course" do
        before do
          course_factory
          outcome_with_rubric({ mastery_points: 3, context: @context })
          @course2 = course_factory
          course_with_teacher_logged_in(active_all: true, course: @course2)
        end

        it "duplicates the associated rubric" do
          expect do
            post "/courses/#{@course2.id}/rubric_associations", params: { rubric_association: { rubric_id: @rubric.id } }
          end.to change {
            Rubric.count
          }.by(1)
          new_rubric = Rubric.where(context: @course2).order(:created_at).last
          expect(new_rubric.context).to eq @course2
          expect(new_rubric.data).to eq @rubric.data
        end

        it "duplicates the associated rubric into the correct shard" do
          # GuardRail.activate(:secondary) runs SET ROLE canvas_readonly_user on
          # the current connection. When the request routes to shard2, this would
          # block writes. In production, secondary uses a separate read-replica
          # connection and cross-shard writes are unaffected.
          allow(GuardRail).to receive(:activate).and_call_original
          allow(GuardRail).to receive(:activate).with(:secondary).and_yield
          @shard2.activate do
            account_model
            @course3 = course_factory(account: @account)
            @assignment = assignment_model(course: @course3)
            course_with_teacher_logged_in(active_all: true, course: @course3)
          end
          post "/courses/#{@course3.global_id}/rubric_associations", params: {
            rubric_association: { rubric_id: @rubric.global_id, association_id: @assignment.id, association_type: "Assignment" }
          }
          new_rubric = @shard2.activate { Rubric.where(context: @course3).order(:created_at).last }
          expect(new_rubric.context).to eq @course3
          expect(new_rubric.data).to eq @rubric.data
          expect(new_rubric.shard).to eq @shard2
        end

        describe "with the account_level_mastery_scales FF" do
          describe "enabled" do
            before do
              @course2.root_account.enable_feature!(:account_level_mastery_scales)
              @proficiency = outcome_proficiency_model(@course2)
            end

            it "uses the new course mastery scales for learning outcome criterion" do
              post "/courses/#{@course2.id}/rubric_associations", params: { rubric_association: { rubric_id: @rubric.id } }
              new_rubric = Rubric.where(context: @course2).last
              outcome_criterion = new_rubric.data[0]
              expect(outcome_criterion[:ratings].length).to eq 2
              expect(outcome_criterion[:points]).to eq 10
              expect(outcome_criterion[:mastery_points]).to eq 10
              expect(outcome_criterion[:ratings].pluck(:description)).to eq ["best", "worst"]
            end
          end

          describe "disabled" do
            before do
              @course2.root_account.disable_feature!(:account_level_mastery_scales)
              @proficiency = outcome_proficiency_model(@course2)
            end

            it "does not change the existing criterions" do
              post "/courses/#{@course2.id}/rubric_associations", params: { rubric_association: { rubric_id: @rubric.id } }
              expect(Rubric.where(context: @course2).last.data).to eq @rubric.data
            end
          end
        end
      end

      describe "account" do
        before do
          account_model
          outcome_with_rubric({ mastery_points: 3, context: @account })
          course_with_teacher_logged_in(active_all: true, course: @course)
        end

        it "does not duplicate the rubric" do
          assignment = @course.assignments.create!(title: "Test Assignment")
          expect do
            post "/courses/#{@course.id}/rubric_associations", params: {
              rubric_association: { rubric_id: @rubric.id, association_type: "Assignment", association_id: assignment.id }
            }
          end.not_to change {
            Rubric.count
          }
          expect(response.parsed_body["rubric"]["id"]).to eq @rubric.id
        end
      end
    end
  end

  describe "PUT 'update'" do
    it "requires authorization" do
      course_with_teacher(active_all: true)
      rubric_association_model(user: @user, context: @course)
      put "/courses/#{@course.id}/rubric_associations/#{@rubric_association.id}"
      assert_unauthorized
    end

    it "assigns variables" do
      course_with_teacher_logged_in(active_all: true)
      rubric_association_model(user: @user, context: @course)
      put "/courses/#{@course.id}/rubric_associations/#{@rubric_association.id}", params: { rubric_association: { title: "some association" } }
      expect(response).to be_successful
      expect(response.parsed_body["rubric_association"]["title"]).to eql("some association")
    end

    it "updates the rubric if updateable" do
      course_with_teacher_logged_in(active_all: true)
      rubric_association_model(user: @user, context: @course)
      put "/courses/#{@course.id}/rubric_associations/#{@rubric_association.id}", params: { rubric: { title: "new title" }, rubric_association: { title: "some association" } }
      expect(response).to be_successful
      expect(response.parsed_body["rubric"]["title"]).to eql("new title")
      expect(response.parsed_body["rubric_association"]["title"]).to eql("some association")
    end

    it "does not update the rubric if not updateable (should make a new one instead)" do
      course_with_teacher_logged_in(active_all: true)
      rubric_association_model(user: @user, context: @course, purpose: "grading")
      @rubric.associate_with(@course, @course, purpose: "grading")
      put "/courses/#{@course.id}/rubric_associations/#{@rubric_association.id}", params: { rubric: { title: "new title" }, rubric_association: { title: "some association" } }
      expect(response).to be_successful
      expect(@rubric.reload.title).not_to eql("new title")
      expect(response.parsed_body["rubric_association"]["title"]).to eql("some association")
    end

    describe "AnonymousOrModerationEvent creation for auditable assignments" do
      let(:course) { Course.create! }
      let(:teacher) { course.enroll_teacher(User.create!, active_all: true).user }
      let(:assignment) { course.assignments.create!(anonymous_grading: true) }
      let(:rubric) { Rubric.create!(title: "hi", context: course) }

      let(:association_params) do
        { association_id: assignment.id, association_type: "Assignment", rubric_id: rubric.id }
      end
      let(:request_params) do
        { assignment_id: assignment.id, rubric_association: association_params }
      end

      let(:old_rubric) { Rubric.create!(title: "zzz", context: course) }
      let(:last_updated_event) { AnonymousOrModerationEvent.where(event_type: "rubric_updated").last }
      let(:existing_rubric_association) do
        RubricAssociation.generate(teacher, old_rubric, course, association_object: assignment, purpose: "grading")
      end

      before do
        existing_rubric_association
        user_session(teacher)
      end

      it "records a rubric_updated event for the assignment" do
        expect do
          put("/courses/#{course.id}/rubric_associations/0", params: request_params)
        end.to change {
          AnonymousOrModerationEvent.where(
            event_type: "rubric_updated",
            assignment:
          ).count
        }.by(1)
      end

      it "includes the ID of the removed rubric in the payload" do
        put("/courses/#{course.id}/rubric_associations/0", params: request_params)
        expect(last_updated_event.payload["id"].first).to eq old_rubric.id
      end

      it "includes the ID of the added rubric in the payload" do
        put("/courses/#{course.id}/rubric_associations/0", params: request_params)
        expect(last_updated_event.payload["id"].second).to eq rubric.id
      end

      it "includes the updating user on the event" do
        put("/courses/#{course.id}/rubric_associations/0", params: request_params)
        expect(last_updated_event.user_id).to eq teacher.id
      end

      it "includes the associated assignment on the event" do
        put("/courses/#{course.id}/rubric_associations/0", params: request_params)
        expect(last_updated_event.assignment_id).to eq assignment.id
      end
    end
  end

  describe "DELETE 'destroy'" do
    it "requires authorization" do
      course_with_teacher(active_all: true)
      rubric_association_model(user: @user, context: @course)
      delete "/courses/#{@course.id}/rubric_associations/#{@rubric_association.id}"
      assert_unauthorized
    end

    it "deletes the rubric if deletable" do
      course_with_teacher_logged_in(active_all: true)
      rubric_association_model(user: @user, context: @course)
      delete "/courses/#{@course.id}/rubric_associations/#{@rubric_association.id}"
      expect(response).to be_successful
      expect(@rubric_association.reload).to be_deleted
      expect(@rubric.reload).to be_deleted
    end

    it "should_not delete the rubric if still created at the context level instead of the assignment level" do
      course_with_teacher_logged_in(active_all: true)
      rubric_association_model(user: @user, context: @course)
      @rubric.associate_with(@course, @course, purpose: "bookmark")
      delete "/courses/#{@course.id}/rubric_associations/#{@rubric_association.id}"
      expect(response).to be_successful
      expect(@rubric.reload).not_to be_deleted
      expect(@rubric.reload).not_to be_frozen
      expect(@rubric_association.reload).to be_deleted
    end

    it "deletes only the association if the rubric is not deletable" do
      rubric_association_model
      course_with_teacher_logged_in(active_all: true)
      rubric_association_model(user: @user, context: @course, rubric: @rubric, purpose: "grading")
      @rubric.associate_with(@course, @course, purpose: "grading")
      @rubric.associate_with(@course, @course, purpose: "bookmark")
      delete "/courses/#{@course.id}/rubric_associations/#{@rubric_association.id}"
      expect(response).to be_successful
      expect(@rubric.reload).not_to be_deleted
      expect(@rubric.reload).not_to be_frozen
      expect(@rubric_association.reload).to be_deleted
    end

    it "removes aligments links" do
      course_with_teacher_logged_in(active_all: true)
      outcome_with_rubric
      rubric_association_model(user: @user, context: @course, rubric: @rubric)

      expect(@rubric_association_object.reload.learning_outcome_alignments.count).to eq 1
      expect(@rubric.reload.learning_outcome_alignments.count).to eq 1

      delete "/courses/#{@course.id}/rubric_associations/#{@rubric_association.id}"

      expect(@rubric.reload.deleted?).to be_truthy
      expect(@rubric_association_object.reload.learning_outcome_alignments.count).to eq 0
      expect(@rubric.reload.learning_outcome_alignments.count).to eq 0
    end

    context "when associated with an auditable assignment" do
      let(:course) { Course.create! }
      let(:assignment) { course.assignments.create!(anonymous_grading: true) }
      let(:teacher) { course.enroll_teacher(User.create!, active_all: true).user }
      let(:rubric) { Rubric.create!(title: "aaa", context: course) }
      let!(:rubric_association) do
        RubricAssociation.generate(teacher, rubric, course, purpose: "grading", association_object: assignment)
      end

      before do
        user_session(teacher)
      end

      it "creates an AnonymousOrModerationEvent capturing the deletion" do
        expect do
          delete("/courses/#{course.id}/rubric_associations/#{rubric_association.id}")
        end.to change {
          AnonymousOrModerationEvent.where(event_type: "rubric_deleted", assignment:, user: teacher).count
        }.by(1)
      end

      it "includes the removed rubric in the event payload" do
        delete("/courses/#{course.id}/rubric_associations/#{rubric_association.id}")

        event = AnonymousOrModerationEvent.find_by(event_type: "rubric_deleted", assignment:, user: teacher)
        expect(event.payload["id"]).to eq rubric.id
      end
    end
  end
end
