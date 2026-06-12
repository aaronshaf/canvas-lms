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

describe ContextController do
  let(:teacher) do
    course_with_teacher(active_all: true)
    @teacher
  end
  let(:course) do
    teacher
    @course
  end
  let(:student) do
    student_in_course(active_all: true, course:)
    @student
  end

  describe "GET 'roster'" do
    it "requires authorization" do
      get "/courses/#{course.id}/users"
      assert_unauthorized
    end

    it "works when the context is a group in a course" do
      user_session(student)
      @group = course.groups.create!
      @group.add_user(student, "accepted")
      get "/groups/#{@group.id}/users"
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("user_#{student.id}")
      expect(response.body).to include("user_#{teacher.id}")
    end

    it "only shows active group members to students" do
      active_student = user_factory
      course.enroll_student(active_student).accept!
      inactive_student = user_factory
      course.enroll_student(inactive_student).deactivate

      @group = course.groups.create!
      [student, active_student, inactive_student].each { |u| @group.add_user(u, "accepted") }

      user_session(student)
      get "/groups/#{@group.id}/users"
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("user_#{student.id}")
      expect(response.body).to include("user_#{active_student.id}")
      expect(response.body).not_to include("user_#{inactive_student.id}")
    end

    it "only shows active course instructors to students" do
      active_teacher = user_factory
      course.enroll_teacher(active_teacher).accept!
      inactive_teacher = user_factory
      course.enroll_teacher(inactive_teacher).deactivate

      @group = course.groups.create!
      @group.add_user(student, "accepted")

      user_session(student)
      get "/groups/#{@group.id}/users"
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("user_#{active_teacher.id}")
      expect(response.body).not_to include("user_#{inactive_teacher.id}")
    end

    it "only shows instructors in the same section as section-restricted student" do
      my_course = create_course
      my_student = user_factory(name: "mystudent")
      my_teacher = user_factory(name: "myteacher")
      other_teacher = user_factory(name: "otherteacher")
      section1 = my_course.course_sections.create!(name: "Section 1")
      section2 = my_course.course_sections.create!(name: "Section 2")
      my_course.enroll_user(my_student, "StudentEnrollment", section: section1, enrollment_state: "active", limit_privileges_to_course_section: true)
      my_course.enroll_user(my_teacher, "TeacherEnrollment", section: section1, enrollment_state: "active")
      my_course.enroll_user(other_teacher, "TeacherEnrollment", section: section2, enrollment_state: "active")

      my_group = my_course.groups.create!
      my_group.add_user(my_student, "accepted")

      user_session(my_student)
      get "/groups/#{my_group.id}/users"
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("user_#{my_teacher.id}")
      expect(response.body).not_to include("user_#{other_teacher.id}")
    end

    it "shows all group members to admins" do
      active_student = user_factory
      course.enroll_student(active_student).accept!
      inactive_student = user_factory
      course.enroll_student(inactive_student).deactivate

      @group = course.groups.create!
      [student, active_student, inactive_student].each { |u| @group.add_user(u, "accepted") }
      user_session(teacher)
      get "/groups/#{@group.id}/users"
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("user_#{student.id}")
      expect(response.body).to include("user_#{active_student.id}")
      expect(response.body).to include("user_#{inactive_student.id}")
    end

    it "redirects 'disabled', if disabled by the teacher" do
      user_session(student)
      course.update_attribute(
        :tab_configuration,
        [{ "id" => Course::TAB_PEOPLE, "hidden" => true }]
      )
      get "/courses/#{course.id}/users"
      expect(response).to have_http_status(:found)
      expect(flash[:notice]).to match(/That page has been disabled/)
    end

    context "granular enrollment permissions" do
      it "teacher and student permissions are excluded from active_granular_enrollment_permissions when not enabled" do
        %w[add_student_to_course add_teacher_to_course].each do |perm|
          RoleOverride.create!(context: Account.default, permission: perm, role: teacher_role, enabled: false)
        end
        %w[add_designer_to_course add_observer_to_course add_ta_to_course].each do |perm|
          RoleOverride.create!(context: Account.default, permission: perm, role: teacher_role, enabled: true)
        end
        user_session(teacher)
        get "/courses/#{course.id}/users"
        expect(response).to have_http_status(:ok)
        env = js_env_from_response(response)
        expect(env.dig("permissions", "active_granular_enrollment_permissions")).to eq(%w[TaEnrollment DesignerEnrollment ObserverEnrollment])
      end
    end

    context "student context cards" do
      it "is always enabled for teachers" do
        %w[manage_students allow_course_admin_actions].each do |perm|
          RoleOverride.manage_role_override(Account.default, teacher_role, perm, override: false)
        end
        user_session(teacher)
        get "/courses/#{course.id}/users"
        expect(response).to have_http_status(:ok)
        env = js_env_from_response(response)
        expect(env["STUDENT_CONTEXT_CARDS_ENABLED"]).to be true
      end

      it "is always disabled for students" do
        user_session(student)
        get "/courses/#{course.id}/users"
        expect(response).to have_http_status(:ok)
        env = js_env_from_response(response)
        expect(env["STUDENT_CONTEXT_CARDS_ENABLED"]).to be_nil
      end
    end

    it "displays modernized course people page when FF enabled" do
      course.root_account.enable_feature!(:people_page_modernization)
      user_session(teacher)
      get "/courses/#{course.id}/users"
      expect(response).to have_http_status(:ok)
      expect(response).to render_template "layouts/application"
      expect(response.body).to include("push('course_people_new')")
    end

    context "allow_manage_differentiation_tags in js_env" do
      before do
        course.account.settings = { allow_assign_to_differentiation_tags: { value: true } }
        course.account.save!
      end

      it "set to true when differentiation tags are enabled in account settings" do
        user_session(teacher)
        get "/courses/#{course.id}/users"
        expect(response).to have_http_status(:ok)
        env = js_env_from_response(response)
        expect(env.dig("permissions", "allow_assign_to_differentiation_tags")).to be true
      end

      it "set to false when differentiation tags are disabled in account settings" do
        course.account.settings = { allow_assign_to_differentiation_tags: { value: false } }
        course.account.save!
        user_session(teacher)
        get "/courses/#{course.id}/users"
        expect(response).to have_http_status(:ok)
        env = js_env_from_response(response)
        expect(env.dig("permissions", "allow_assign_to_differentiation_tags")).to be false
      end
    end
  end

  describe "GET 'roster_user'" do
    before do
      # analytics_2 must be enabled to short-circuit the analytics sidebar helper,
      # which otherwise calls feature_enabled?(:hide_legacy_course_analytics),
      # a feature only registered in private plugins.
      course.enable_feature!(:analytics_2)
    end

    it "requires authorization" do
      get "/courses/#{course.id}/users/#{student.id}"
      assert_unauthorized
    end

    it "assigns variables" do
      user_session(teacher)
      enrollment = course.enroll_student(user_factory(active_all: true))
      enrollment.accept!
      student = enrollment.user
      get "/courses/#{course.id}/users/#{student.id}"
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("/users/#{student.id}")
      expect(response.body).to include(student.name)
      expect(response.body).to include("Recent Messages")
    end

    describe "across shards" do
      specs_require_sharding

      it "allows merged users from other shards to be referenced" do
        user1 = user_model
        course1 = course_factory(active_all: true)
        course1.enable_feature!(:analytics_2)
        course1.enroll_user(user1)

        @shard2.activate do
          @user2 = user_model
          @course2 = course_factory(active_all: true)
          @course2.enroll_user(@user2)
        end

        UserMerge.from(user1).into(@user2)

        admin = user_model
        Account.site_admin.account_users.create!(user: admin)
        user_session(admin)

        get "/courses/#{course1.id}/users/#{@user2.id}"
        expect(response).to have_http_status(:ok)
      end
    end

    describe "hide_sections_on_course_users_page setting is Off" do
      before do
        @student2 = student_in_course(course:, active_all: true).user
      end

      it "sets js_env with hide sections setting to false" do
        @other_section = course.course_sections.create! name: "Other Section FRD"
        user_session(student)
        get "/courses/#{course.id}/users", params: { id: student.id }
        expect(response).to have_http_status(:ok)
        env = js_env_from_response(response)
        expect(env.dig("course", "hideSectionsOnCourseUsersPage")).to be false
      end

      it "sets js_env with hide sections setting to true" do
        course.hide_sections_on_course_users_page = true
        course.save!
        @other_section = course.course_sections.create! name: "Other Section FRD"
        user_session(student)
        get "/courses/#{course.id}/users", params: { id: student.id }
        expect(response).to have_http_status(:ok)
        env = js_env_from_response(response)
        expect(env.dig("course", "hideSectionsOnCourseUsersPage")).to be true
      end
    end

    describe "section visibility" do
      before do
        @other_section = course.course_sections.create! name: "Other Section FRD"
        course.enroll_teacher(teacher, section: @other_section, allow_multiple_enrollments: true)
              .accept!
        @other_student = user_factory
        course.enroll_student(
          @other_student,
          section: @other_section,
          limit_privileges_to_course_section: true
        )
              .accept!
      end

      it "prevents section-limited users from seeing users in other sections" do
        user_session(student)
        get "/courses/#{course.id}/users/#{@other_student.id}"
        expect(response).to have_http_status(:ok)

        user_session(@other_student)
        get "/courses/#{course.id}/users/#{student.id}"
        expect(response).to have_http_status(:found)
        expect(flash[:error]).to eq("That user does not exist or is not currently a member of this course")
      end

      it "limits enrollments by visibility for course default section" do
        user_session(student)
        get "/courses/#{course.id}/users/#{teacher.id}"
        expect(response).to have_http_status(:ok)
        expect(response.body).to include("/users/#{teacher.id}")
      end

      it "limits enrollments by visibility for other section" do
        user_session(@other_student)
        get "/courses/#{course.id}/users/#{teacher.id}"
        expect(response).to have_http_status(:ok)
        expect(response.body).to include("/users/#{teacher.id}")
      end

      it "lets admins see concluded students" do
        user_session(teacher)
        student.enrollments.first.complete!
        get "/courses/#{course.id}/users/#{student.id}"
        expect(response).to have_http_status(:ok)
      end

      it "lets admins see inactive students" do
        user_session(teacher)
        student.enrollments.first.deactivate
        get "/courses/#{course.id}/users/#{student.id}"
        expect(response).to have_http_status(:ok)
      end

      it "does not let students see inactive students" do
        another_student = user_factory
        course.enroll_student(another_student, section: course.default_section).accept!
        user_session(another_student)

        student.enrollments.first.deactivate

        get "/courses/#{course.id}/users/#{student.id}"
        expect(response).to have_http_status(:found)
      end

      context "hide course sections from students feature enabled" do
        it "sets js_env with hide sections setting to true for roster_user" do
          course.hide_sections_on_course_users_page = true
          course.save!
          @other_section = course.course_sections.create! name: "Other Section FRD"
          user_session(student)
          get "/courses/#{course.id}/users/#{teacher.id}"
          expect(response).to have_http_status(:ok)
          env = js_env_from_response(response)
          expect(env.dig("course", "hideSectionsOnCourseUsersPage")).to be true
        end

        it "sets js_env with hide sections setting to false for roster_user" do
          course.hide_sections_on_course_users_page = false
          course.save!
          @other_section = course.course_sections.create! name: "Other Section FRD"
          user_session(student)
          get "/courses/#{course.id}/users/#{teacher.id}"
          expect(response).to have_http_status(:ok)
          env = js_env_from_response(response)
          expect(env.dig("course", "hideSectionsOnCourseUsersPage")).to be false
        end
      end
    end

    context "profiles enabled" do
      before do
        account_admin_user
        course_with_student(active_all: true)
        @course.enable_feature!(:analytics_2)

        account = Account.default
        account.settings = { enable_profiles: true }
        account.save!
      end

      it "does not show the dummy course as common" do
        Course.ensure_dummy_course
        user_session(@admin)
        get "/courses/#{@course.id}/users/#{@student.id}"
        expect(response).to have_http_status(:ok)
        expect(response.body).to include(@student.short_name)
      end

      it "displays user short name in breadcrumb" do
        @student.short_name = "display"
        @student.save
        user_session(@admin)
        get "/courses/#{@course.id}/users/#{@student.id}"
        expect(response).to have_http_status(:ok)
        expect(js_env_from_response(response)["CONTEXT_USER_DISPLAY_NAME"]).to eq(@student.short_name)
      end

      context "recent messages on the roster user page" do
        before do
          topic = @course.discussion_topics.create!(user: @student, message: "Discussion")
          (1..11).each { |number| topic.discussion_entries.create!(message: number, user: @student) }
          user_session(@admin)
        end

        it "only shows 10 most recent messages" do
          entries = @student.discussion_entries.order(created_at: :desc)
          get "/courses/#{@course.id}/users/#{@student.id}"
          expect(response).to have_http_status(:ok)
          expect(response.body).to include("entry_#{entries.first.id}")
          expect(response.body).not_to include("entry_#{entries.last.id}")
        end

        it "requires discussion entry :read permission" do
          allow_any_instance_of(DiscussionEntry).to receive(:grants_right?).with(anything, anything, :read).and_return(false)
          get "/courses/#{@course.id}/users/#{@student.id}"
          expect(response).to have_http_status(:ok)
          expect(response.body).to include("No Messages")
        end

        it "excludes anonymous discussion topics" do
          @course.discussion_topics.last.update(anonymous_state: "full_anonymity")
          get "/courses/#{@course.id}/users/#{@student.id}"
          expect(response).to have_http_status(:ok)
          expect(response.body).to include("No Messages")
        end

        it "excludes anonymous discussion entries in partially anonymous discussion topics" do
          @course.discussion_topics.last.update(anonymous_state: "partial_anonymity")
          @course.discussion_topics.last.discussion_entries.where(message: %w[1 3 5 7]).update_all(is_anonymous_author: true)
          visible_entry = @student.discussion_entries.find_by(message: "2")
          hidden_entry = @student.discussion_entries.find_by(message: "1")
          get "/courses/#{@course.id}/users/#{@student.id}"
          expect(response).to have_http_status(:ok)
          expect(response.body).to include("entry_#{visible_entry.id}")
          expect(response.body).not_to include("entry_#{hidden_entry.id}")
        end

        it "teacher sees the Recent Messages section when viewing a student who has replied to a discussion" do
          get "/courses/#{@course.id}/users/#{@student.id}"
          expect(response).to have_http_status(:ok)
          expect(response.body).to include("Recent Messages")
        end
      end
    end

    context "profiles disabled" do
      before do
        account_admin_user
        course_with_student(active_all: true)
        topic = @course.discussion_topics.create!(user: @student, message: "Discussion")
        topic.discussion_entries.create!(message: "a student reply", user: @student)
        user_session(@admin)
      end

      it "teacher sees the Recent Messages section when viewing a student who has replied to a discussion" do
        get "/courses/#{@course.id}/users/#{@student.id}"
        expect(response).to have_http_status(:ok)
        expect(response.body).to include("Recent Messages")
      end
    end

    describe "rejected enrollments" do
      before do
        @section1 = course.course_sections.create!(name: "Section 1")
        @section2 = course.course_sections.create!(name: "Section 2")

        @student_with_rejected = user_factory(active_all: true)
        enrollment1 = course.enroll_student(@student_with_rejected, section: @section1, enrollment_state: "invited")
        enrollment1.accept!

        enrollment2 = course.enroll_student(@student_with_rejected, section: @section2, enrollment_state: "invited", allow_multiple_enrollments: true)
        enrollment2.reject!
      end

      it "displays 'Invitation Declined' label when profiles are enabled" do
        account = Account.default
        account.settings = { enable_profiles: true }
        account.save!

        user_session(teacher)
        get "/courses/#{course.id}/users/#{@student_with_rejected.id}"

        expect(response).to have_http_status(:ok)
        expect(response.body).to include("Invitation Declined")
      end

      it "displays 'Invitation Declined' label when profiles are disabled" do
        account = Account.default
        account.settings = { enable_profiles: false }
        account.save!

        user_session(teacher)
        get "/courses/#{course.id}/users/#{@student_with_rejected.id}"

        expect(response).to have_http_status(:ok)
        expect(response.body).to include("Invitation Declined")
      end
    end
  end

  describe "POST 'object_snippet'" do
    before do
      @obj = "<object data='test'></object>"
      @data = Base64.encode64(@obj)
      @hmac = Canvas::Security.hmac_sha1(@data)
    end

    before do
      allow(HostUrl).to receive(:is_file_host?).and_return(true)
    end

    it "requires a valid HMAC" do
      post "/object_snippet", params: { object_data: @data, s: "DENIED" }
      assert_status(400)
    end

    it "renders given a correct HMAC" do
      post "/object_snippet", params: { object_data: @data, s: @hmac }
      expect(response).to have_http_status(:ok)
      expect(response["X-XSS-Protection"]).to eq "0"
    end
  end

  describe "GET 'prior_users" do
    before do
      create_users_in_course(course, 21)
      course.student_enrollments.update_all(workflow_state: "completed")
      user_session(teacher)
    end

    it "paginates" do
      get "/courses/#{course.id}/users/prior"
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("Prior Users")
    end
  end

  describe "GET 'undelete_index'" do
    it "works" do
      user_session(teacher)
      assignment_model(course:)
      @assignment.destroy

      get "/courses/#{course.id}/undelete"
      expect(response).to have_http_status(:ok)
      expect(response.body).to include(@assignment.name)
    end

    it "sorts by deleted_at/updated_at descending" do
      assignment = assignment_model(course:)
      page = wiki_page_model(course:)
      file = attachment_model(context: course)
      discussion = discussion_topic_model(course:)

      discussion.update_columns(updated_at: 1.day.ago, workflow_state: "deleted")
      file.update_columns(deleted_at: 2.days.ago, file_state: "deleted")
      page.update_columns(updated_at: 3.days.ago, workflow_state: "deleted")
      assignment.update_columns(updated_at: 4.days.ago, workflow_state: "deleted")

      user_session(teacher)
      get "/courses/#{course.id}/undelete"
      expect(response).to have_http_status(:ok)
      body = response.body
      expect(body.index(discussion.asset_string)).to be < body.index(file.asset_string)
      expect(body.index(file.asset_string)).to be < body.index(page.asset_string)
      expect(body.index(page.asset_string)).to be < body.index(assignment.asset_string)
    end

    it "shows group_categories" do
      user_session(teacher)
      category = GroupCategory.student_organized_for(course)
      category.destroy

      get "/courses/#{course.id}/undelete"
      expect(response).to have_http_status(:ok)
      expect(response.body).to include(category.name)
    end

    context ":differentiation_tags" do
      before do
        course.account.settings[:allow_assign_to_differentiation_tags] = { value: true }
        course.account.save!
        course.account.reload
        @gc = course.group_categories.create!(name: "group category")
        @gc.destroy

        @ncgc = course.group_categories.create!(name: "non-collaborative group category", non_collaborative: true)
        @ncgc.destroy
      end

      it "shows both kinds of group categories when both kinds of group deletion permissions are true" do
        user_session(teacher)
        get "/courses/#{course.id}/undelete"
        expect(response.body).to include(@gc.asset_string)
        expect(response.body).to include(@ncgc.asset_string)
      end

      it "shows only collaborative group categories when only that permission is true" do
        course.account.role_overrides.create!(permission: :manage_tags_delete, role: teacher_role, enabled: false)
        user_session(teacher)
        get "/courses/#{course.id}/undelete"
        expect(response.body).to include(@gc.asset_string)
        expect(response.body).not_to include(@ncgc.asset_string)
      end

      it "shows only non-collaborative group categories when only that permission is true" do
        course.account.role_overrides.create!(permission: :manage_groups_delete, role: teacher_role, enabled: false)
        user_session(teacher)
        get "/courses/#{course.id}/undelete"
        expect(response.body).not_to include(@gc.asset_string)
        expect(response.body).to include(@ncgc.asset_string)
      end

      it "shows no group categories when neither permission is true" do
        false_permissions = [:manage_groups_delete, :manage_tags_delete]
        false_permissions.each do |perm|
          course.account.role_overrides.create!(permission: perm, role: teacher_role, enabled: false)
        end
        user_session(teacher)
        get "/courses/#{course.id}/undelete"
        expect(response).to have_http_status(:ok)
      end
    end

    it "shows groups" do
      user_session(teacher)
      category = GroupCategory.student_organized_for(course)
      g1 = category.groups.create!(context: course, name: "group_a")
      g1.destroy

      get "/courses/#{course.id}/undelete"
      expect(response).to have_http_status(:ok)
      expect(response.body).to include(g1.name)
    end

    it "does now show group discussions that are not restorable" do
      group_assignment_discussion(course:)

      @root_topic.destroy
      user_session(teacher)
      get "/groups/#{@group.id}/undelete"

      expect(response).to have_http_status(:ok)
      expect(response.body).not_to include(@topic.title)
    end

    describe "Rubric Associations" do
      before do
        assignment = assignment_model(course:)
        rubric = rubric_model({
                                context: course,
                                title: "Test Rubric",
                                data: [{
                                  description: "Some criterion",
                                  points: 10,
                                  id: "crit1",
                                  ignore_for_scoring: true,
                                  ratings: [
                                    { description: "Good", points: 10, id: "rat1", criterion_id: "crit1" }
                                  ]
                                }]
                              })
        @association = rubric.associate_with(assignment, course, purpose: "grading")
      end

      it "shows deleted rubric associations" do
        @association.destroy
        user_session(teacher)
        get "/courses/#{course.id}/undelete"
        expect(response.body).to include(@association.asset_string)
      end

      it "does not show active rubric associations" do
        user_session(teacher)
        get "/courses/#{course.id}/undelete"
        expect(response).to have_http_status(:ok)
        expect(response.body).not_to include(@association.asset_string)
      end
    end
  end

  describe "POST 'undelete_item'" do
    it "allows undeleting groups" do
      user_session(teacher)
      category = GroupCategory.student_organized_for(course)
      g1 = category.groups.create!(context: course, name: "group_a")
      g1.destroy

      post "/courses/#{course.id}/undelete/#{g1.asset_string}"
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["group"]["workflow_state"]).to eq "available"
      expect(response.parsed_body["group"]["deleted_at"]).to be_nil
    end

    it "allows undeleting group_categories" do
      user_session(teacher)
      category = GroupCategory.student_organized_for(course)
      g1 = category.groups.create!(context: course, name: "group_a")
      category.destroy

      post "/courses/#{course.id}/undelete/#{category.asset_string}"
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["group_category"]["deleted_at"]).to be_nil
      expect(g1.reload.deleted_at).to be_nil
      expect(g1.reload.workflow_state).to eq "available"
    end

    it "allows undeleting non-collaborative group_categories" do
      user_session(teacher)
      category = GroupCategory.create!(context: course, name: "Tag Category", non_collaborative: true)
      g1 = category.groups.create!(context: course, name: "group_a", non_collaborative: true)
      category.destroy

      post "/courses/#{course.id}/undelete/#{category.asset_string}"
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["group_category"]["deleted_at"]).to be_nil
      expect(g1.reload.deleted_at).to be_nil
      expect(g1.reload.workflow_state).to eq "available"
    end

    it "does not allow dangerous sends" do
      user_session(teacher)
      expect_any_instantiation_of(course).not_to receive(:teacher_names)
      post "/courses/#{course.id}/undelete/teacher_name_1"
      expect(response).to have_http_status :internal_server_error
    end

    it "does not allow restoring unrestorable discussion topics" do
      group_assignment_discussion(course:)
      @root_topic.destroy

      user_session(teacher)
      post "/groups/#{@group.id}/undelete/#{@topic.asset_string}"
      expect(response).to have_http_status :forbidden
      expect(response.parsed_body.first).to include("Cannot undelete a child topic")
    end

    it 'allows undeleting a "normal" association' do
      user_session(teacher)
      assignment_model(course:)
      @assignment.destroy

      post "/courses/#{course.id}/undelete/#{@assignment.asset_string}"
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["assignment"]["workflow_state"]).not_to eq("deleted")
    end

    it "allows undeleting wiki pages" do
      user_session(teacher)
      page = course.wiki_pages.create!(title: "some page")
      page.destroy

      post "/courses/#{course.id}/undelete/#{page.asset_string}"
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["wiki_page"]["workflow_state"]).to eq("unpublished")
    end

    it "allows undeleting attachments" do
      user_session(teacher)
      attachment_model
      @attachment.destroy

      post "/courses/#{course.id}/undelete/#{@attachment.asset_string}"
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["attachment"]["id"]).to eql(@attachment.id)
      expect(response.parsed_body["attachment"]["file_state"]).to eq("available")
    end

    it "allows undeleting rubric associations" do
      assignment = assignment_model(course:)
      rubric = rubric_model({
                              context: course,
                              title: "Test Rubric",
                              data: [{
                                description: "Some criterion",
                                points: 10,
                                id: "crit1",
                                ignore_for_scoring: true,
                                ratings: [
                                  { description: "Good", points: 10, id: "rat1", criterion_id: "crit1" }
                                ]
                              }]
                            })
      association = rubric.associate_with(assignment, course, purpose: "grading")
      association.destroy

      user_session(teacher)
      post "/courses/#{course.id}/undelete/#{association.asset_string}"
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["rubric_association"]["id"]).to eql(association.id)
      expect(response.parsed_body["rubric_association"]["workflow_state"]).to eq("active")
    end

    it "does not error undeleting a quiz assignment that somehow has no quiz" do
      user_session(teacher)
      course.root_account.enable_feature!(:allow_attachment_association_creation)
      assignment = course.assignments.create!(
        submission_types: "online_quiz",
        description: "<p><a href='/courses/#{course.id}/files/1/download'>quiz file link</a></p>",
        workflow_state: "deleted",
        updating_user: teacher
      )

      expect do
        post "/courses/#{course.id}/undelete/#{assignment.asset_string}"
      end.not_to raise_error

      expect(response.parsed_body["assignment"]["workflow_state"]).to eq("unpublished")
    end
  end

  describe "GET 'roster_user_usage'" do
    before do
      @page = course.wiki_pages.create(title: "some page")
      AssetUserAccess.create!(
        { user_id: student, asset_code: @page.asset_string, context: course, category: "pages" }
      )
    end

    it "returns accesses" do
      user_session(teacher)

      get "/courses/#{course.id}/users/#{student.id}/usage"

      expect(response).to have_http_status(:ok)
      expect(AssetUserAccess.where(user_id: student, context: course).count).to eq 1
    end

    it "returns json" do
      user_session(teacher)

      get "/courses/#{course.id}/users/#{student.id}/usage.json"

      expect(response).to have_http_status(:ok)
      body = json_parse(response.body)
      expect(body.length).to eq 1
      expect(body.first["asset_user_access"]["asset_code"]).to eq @page.asset_string
    end
  end
end
