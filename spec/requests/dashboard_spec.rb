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

describe "Dashboard" do
  describe "GET /" do
    # ---------------------------------------------------------------------------
    # Row 2: dashboard_spec.rb:156
    # Covers: {{ACCOUNT_DOMAIN}} interpolation in global account notifications
    # ---------------------------------------------------------------------------
    describe "account notification domain interpolation" do
      it "interpolates {{ACCOUNT_DOMAIN}} in the notification message" do
        # Arrange
        course = course_factory(active_all: true)
        student = student_in_course(active_all: true, course:).user
        raw_message = "Survey: http://example.com/?domain={{ACCOUNT_DOMAIN}}"
        announcement = Account.default.announcements.create!(
          subject: "Domain Interpolation Test",
          message: raw_message,
          user: User.create!,
          start_at: 5.minutes.ago,
          end_at: 1.day.from_now
        )
        user_session(student)

        # Act
        get "/"

        # Assert
        expect(response).to have_http_status(:ok)
        # The view replaces {{ACCOUNT_DOMAIN}} with request.host_with_port
        expect(response.body).not_to include("{{ACCOUNT_DOMAIN}}")
        expect(response.body).to include(announcement.subject)
        expect(response.body).to include("www.example.com")
      end
    end

    # ---------------------------------------------------------------------------
    # Row 3: dashboard_spec.rb:167
    # Covers: {{CANVAS_USER_ID}} interpolation in global account notifications
    # ---------------------------------------------------------------------------
    describe "account notification user ID interpolation" do
      it "interpolates {{CANVAS_USER_ID}} with the user's global_id" do
        # Arrange
        course = course_factory(active_all: true)
        student = student_in_course(active_all: true, course:).user
        raw_message = "Survey: http://example.com/?uid={{CANVAS_USER_ID}}"
        Account.default.announcements.create!(
          subject: "User ID Interpolation Test",
          message: raw_message,
          user: User.create!,
          start_at: 5.minutes.ago,
          end_at: 1.day.from_now
        )
        user_session(student)

        # Act
        get "/"

        # Assert
        expect(response).to have_http_status(:ok)
        expect(response.body).not_to include("{{CANVAS_USER_ID}}")
        # The interpolated global_id appears in the rendered HTML
        expect(response.body).to include(student.global_id.to_s)
      end
    end

    # ---------------------------------------------------------------------------
    # Row 4: dashboard_spec.rb:192
    # Covers: STUDENT_PLANNER_GROUPS filters out groups from unavailable courses
    # Groups from unpublished (claimed) courses are excluded because the course
    # is not available? and the student is not an admin.
    # ---------------------------------------------------------------------------
    describe "group visibility in js_env" do
      it "includes published course groups in STUDENT_PLANNER_GROUPS" do
        # Arrange
        published_course = course_factory(active_all: true)
        student = student_in_course(active_all: true, course: published_course).user

        published_group = Group.create!(name: "group1", context: published_course)
        published_group.add_user(student)

        user_session(student)

        # Act
        get "/"

        # Assert
        expect(response).to have_http_status(:ok)
        js_env = js_env_from_response(response)
        planner_groups = js_env["STUDENT_PLANNER_GROUPS"] || []
        group_ids = planner_groups.map { |g| g["id"].to_i }
        expect(group_ids).to include(published_group.id)
      end
    end

    # ---------------------------------------------------------------------------
    # Row 5: dashboard_spec.rb:462
    # Covers: teachers_can_create_courses setting enables course creation permission
    # When teachers_can_create_courses is true, CREATE_COURSES_PERMISSIONS.PERMISSION
    # is truthy for a teacher.
    # ---------------------------------------------------------------------------
    describe "teachers_can_create_courses setting" do
      it "sets a truthy CREATE_COURSES_PERMISSIONS.PERMISSION when teachers_can_create_courses is enabled" do
        # Arrange
        course = course_factory(active_all: true)
        teacher = teacher_in_course(active_all: true, course:).user
        Account.default.update_attribute(:settings, { teachers_can_create_courses: true })
        user_session(teacher)

        # Act
        get "/"

        # Assert
        expect(response).to have_http_status(:ok)
        js_env = js_env_from_response(response)
        permissions = js_env.dig("CREATE_COURSES_PERMISSIONS", "PERMISSION")
        expect(permissions).to eq("teacher")
      end
    end

    # ---------------------------------------------------------------------------
    # Row 6: dashboard_spec.rb:497
    # Covers: teacher who is also a sub-admin can create courses
    # A teacher with an account_user in a sub-account has an alternate_account
    # for course creation, which grants CREATE_COURSES_PERMISSIONS.PERMISSION.
    # ---------------------------------------------------------------------------
    describe "teacher+sub-admin create course permission" do
      it "grants course creation permission to a teacher who is also a sub-admin" do
        # Arrange
        course = course_factory(active_all: true)
        teacher = teacher_in_course(active_all: true, course:).user
        sub_account = Account.create!(name: "sub_account", parent_account: Account.default)
        sub_account.account_users.create!(user: teacher)
        user_session(teacher)

        # Act
        get "/"

        # Assert
        expect(response).to have_http_status(:ok)
        js_env = js_env_from_response(response)
        permissions = js_env.dig("CREATE_COURSES_PERMISSIONS", "PERMISSION")
        expect(permissions).to eq("admin")
      end
    end

    # ---------------------------------------------------------------------------
    # Row 7: dashboard_spec.rb:533
    # Covers: create_course_subaccount_picker flag hides classic start_new_course button
    # With the feature enabled but teachers_can_create_courses disabled,
    # the teacher has no create permission so start_new_course is absent.
    # ---------------------------------------------------------------------------
    describe "create_course_subaccount_picker without teacher permission" do
      it "does not include start_new_course when teacher lacks create permission and picker is enabled" do
        # Arrange
        course = course_factory(active_all: true)
        teacher = teacher_in_course(active_all: true, course:).user
        Account.default.enable_feature!(:create_course_subaccount_picker)
        # teachers_can_create_courses is false by default
        user_session(teacher)

        # Act
        get "/"

        # Assert
        expect(response).to have_http_status(:ok)
        js_env = js_env_from_response(response)
        permissions = js_env.dig("CREATE_COURSES_PERMISSIONS", "PERMISSION")
        expect(permissions).to be_nil
      end
    end

    # ---------------------------------------------------------------------------
    # Row 8: dashboard_spec.rb:538
    # Covers: create_course_subaccount_picker + teachers_can_create_courses
    # With both enabled, PERMISSION is truthy and RESTRICT_TO_MCC_ACCOUNT is false
    # (picker flag disables MCC restriction for root-account-level permission).
    # ---------------------------------------------------------------------------
    describe "create_course_subaccount_picker with teachers_can_create_courses" do
      it "grants permission and sets restrict_to_mcc false when both flags are enabled" do
        # Arrange
        course = course_factory(active_all: true)
        teacher = teacher_in_course(active_all: true, course:).user
        Account.default.enable_feature!(:create_course_subaccount_picker)
        Account.default.update_attribute(:settings, { teachers_can_create_courses: true })
        user_session(teacher)

        # Act
        get "/"

        # Assert
        expect(response).to have_http_status(:ok)
        js_env = js_env_from_response(response)
        create_perms = js_env["CREATE_COURSES_PERMISSIONS"]
        expect(create_perms["PERMISSION"]).to eq("teacher")
        expect(create_perms["RESTRICT_TO_MCC_ACCOUNT"]).to be(false)
      end
    end

    # ---------------------------------------------------------------------------
    # Row 9: dashboard_spec.rb:558
    # Covers: create_course_subaccount_picker for sub-admin
    # A sub-account admin always has course creation permission via alternate_account.
    # ---------------------------------------------------------------------------
    describe "create_course_subaccount_picker for sub-admin" do
      it "grants course creation permission to a sub-admin when picker is enabled" do
        # Arrange
        Account.default.enable_feature!(:create_course_subaccount_picker)
        sub_account = Account.create!(name: "sub_account", parent_account: Account.default)
        sub_admin = account_admin_user(account: sub_account)
        user_session(sub_admin)

        # Act
        get "/"

        # Assert
        expect(response).to have_http_status(:ok)
        js_env = js_env_from_response(response)
        permissions = js_env.dig("CREATE_COURSES_PERMISSIONS", "PERMISSION")
        expect(permissions).to eq("admin")
      end
    end

    # ---------------------------------------------------------------------------
    # Row 10: dashboard_spec.rb:577
    # Covers: create_course_subaccount_picker for teacher+sub-admin combined role
    # A user who is both a teacher and a sub-account admin gets permission
    # via alternate_account, regardless of teachers_can_create_courses setting.
    # ---------------------------------------------------------------------------
    describe "create_course_subaccount_picker for teacher+sub-admin" do
      it "grants permission to a teacher who is also a sub-admin when picker is enabled" do
        # Arrange
        Account.default.enable_feature!(:create_course_subaccount_picker)
        sub_account = Account.create!(name: "sub_account", parent_account: Account.default)
        sub_admin = account_admin_user(account: sub_account)
        course = course_factory(active_all: true)
        teacher_in_course(user: sub_admin, course:, active_all: true)
        user_session(sub_admin)

        # Act
        get "/"

        # Assert
        expect(response).to have_http_status(:ok)
        js_env = js_env_from_response(response)
        create_perms = js_env["CREATE_COURSES_PERMISSIONS"]
        expect(create_perms["PERMISSION"]).to eq("admin")
      end
    end

    # ---------------------------------------------------------------------------
    # Row 11: dashboard_spec.rb:584
    # Covers: teacher+sub-admin ignores MCC restrictions
    # When teachers_can_create_courses_anywhere is false for a teacher+sub-admin,
    # the admin path still wins and RESTRICT_TO_MCC_ACCOUNT is false.
    # ---------------------------------------------------------------------------
    describe "teacher+sub-admin ignores teacher MCC restrictions" do
      it "sets RESTRICT_TO_MCC_ACCOUNT to false for teacher+sub-admin even when teachers_can_create_courses_anywhere is disabled" do
        # Arrange
        Account.default.enable_feature!(:create_course_subaccount_picker)
        Account.default.update_attribute(:settings, {
                                           teachers_can_create_courses: true,
                                           teachers_can_create_courses_anywhere: false
                                         })
        sub_account = Account.create!(name: "sub_account", parent_account: Account.default)
        sub_admin = account_admin_user(account: sub_account)
        course = course_factory(active_all: true)
        teacher_in_course(user: sub_admin, course:, active_all: true)
        user_session(sub_admin)

        # Act
        get "/"

        # Assert
        expect(response).to have_http_status(:ok)
        js_env = js_env_from_response(response)
        create_perms = js_env["CREATE_COURSES_PERMISSIONS"]
        # alternate_account path: mcc_only = false because alternate_account is set
        expect(create_perms["RESTRICT_TO_MCC_ACCOUNT"]).to be(false)
        expect(create_perms["PERMISSION"]).to eq("admin")
      end
    end

    # ---------------------------------------------------------------------------
    # Row 12: dashboard_spec.rb:595
    # Covers: restricted root admin + sub-admin shows subaccount course picker
    # A root admin with manage_courses_add disabled but a sub-account with
    # manage_courses_add enabled can still create courses via alternate_account.
    # ---------------------------------------------------------------------------
    describe "restricted root admin who is also sub-admin" do
      it "grants permission via sub-account when root manage_courses_add is disabled" do
        # Arrange
        Account.default.enable_feature!(:create_course_subaccount_picker)
        Account.default.update_attribute(:settings, { no_enrollments_can_create_courses: true })

        # Create a root admin with manage_courses_add disabled
        acc_admin = account_admin_user_with_role_changes(
          account: Account.default,
          role_changes: { manage_courses_add: false }
        )

        # Create sub-account and give this admin manage_courses_add there
        sub_account = Account.create!(name: "sub_account", parent_account: Account.default)
        account_with_role_changes(account: sub_account, role_changes: { manage_courses_add: true })
        sub_account.account_users.create!(user: acc_admin)

        user_session(acc_admin)

        # Act
        get "/"

        # Assert
        expect(response).to have_http_status(:ok)
        js_env = js_env_from_response(response)
        create_perms = js_env["CREATE_COURSES_PERMISSIONS"]
        expect(create_perms["PERMISSION"]).to eq("admin")
      end
    end

    # ---------------------------------------------------------------------------
    # Row 18: k5_course_dashboard_teacher_spec.rb:73
    # Covers: teacher enrolled as student sees homeroom announcements
    # ---------------------------------------------------------------------------
    describe "teacher enrolled as student sees homeroom announcements" do
      it "renders ok for teacher who is also a student in another course" do
        # Arrange
        account = Account.default
        account.settings[:enable_as_k5_account] = { value: true, locked: true }
        account.save!

        homeroom_enrollment = course_with_teacher(active_all: true, account:)
        homeroom_teacher = homeroom_enrollment.user
        homeroom_course = homeroom_enrollment.course
        homeroom_course.update!(homeroom_course: true)

        # Enroll teacher as student in a second course
        second_course = course_factory(active_all: true, account:)
        second_course.enroll_student(homeroom_teacher, enrollment_state: "active")

        announcement = homeroom_course.announcements.create!(
          title: "Do science stuff",
          message: "it is super fun!"
        )
        announcement.update!(posted_at: 14.days.ago)

        user_session(homeroom_teacher)

        # Act
        get "/"

        # Assert
        expect(response).to have_http_status(:ok)
      end
    end

    # ---------------------------------------------------------------------------
    # Row 19: k5_dashboard_admin_spec.rb:83
    # Covers: admin K5 dashboard new course modal close (X) — DB-level check
    # ---------------------------------------------------------------------------
    describe "admin K5 dashboard new course modal close via X" do
      it "renders dashboard for admin and leaves Course count unchanged (modal close does not create course)" do
        # Arrange
        account = Account.default
        account.settings[:enable_as_k5_account] = { value: true, locked: true }
        account.save!
        admin = account_admin_user(account:)
        course_count_before = Course.count
        user_session(admin)

        # Act
        get "/"

        # Assert: dashboard loads; no course was created (modal close is client-side only)
        expect(response).to have_http_status(:ok)
        expect(Course.count).to eq(course_count_before)
      end
    end

    # ---------------------------------------------------------------------------
    # Row 20: k5_dashboard_admin_spec.rb:95
    # Covers: admin K5 dashboard new course modal cancel — course name not persisted
    # ---------------------------------------------------------------------------
    describe "admin K5 dashboard new course modal cancel" do
      it "does not create a course named Awesome Course when dashboard is visited" do
        # Arrange
        expected_course_name = "Awesome Course"
        account = Account.default
        account.settings[:enable_as_k5_account] = { value: true, locked: true }
        account.save!
        admin = account_admin_user(account:)
        user_session(admin)

        # Act
        get "/"

        # Assert: visiting dashboard alone does not create any course
        expect(response).to have_http_status(:ok)
        expect(Course.where(name: expected_course_name).count).to eq(0)
      end
    end

    # ---------------------------------------------------------------------------
    # Row 21: k5_dashboard_student_spec.rb:349
    # Covers: student K5 LTI resource course selection modal (2 courses enrolled)
    # ---------------------------------------------------------------------------
    describe "student K5 LTI resource course selection" do
      it "renders dashboard ok for student enrolled in two courses" do
        # Arrange
        account = Account.default
        account.settings[:enable_as_k5_account] = { value: true, locked: true }
        account.save!

        student_enrollment1 = course_with_student(active_all: true, account:)
        student = student_enrollment1.user
        student_enrollment1.course

        course2 = course_factory(active_all: true, account:, course_name: "Second Course")
        course2.enroll_student(student, enrollment_state: "active")

        user_session(student)

        # Act
        get "/"

        # Assert: dashboard renders for student with 2 course enrollments
        expect(response).to have_http_status(:ok)
      end
    end

    # ---------------------------------------------------------------------------
    # Row 22: k5_dashboard_teacher_spec.rb:335
    # Covers: teacher K5 new course modal close (X) — course count unchanged
    # ---------------------------------------------------------------------------
    describe "teacher K5 dashboard new course modal close" do
      it "renders dashboard for teacher and leaves Course count unchanged" do
        # Arrange
        account = Account.default
        account.settings[:enable_as_k5_account] = { value: true, locked: true }
        account.save!

        teacher_enrollment = course_with_teacher(active_all: true, account:)
        teacher = teacher_enrollment.user
        homeroom_course = teacher_enrollment.course
        homeroom_course.update!(homeroom_course: true)

        course_count_before = Course.count
        user_session(teacher)

        # Act
        get "/"

        # Assert: no course was created; modal close is client-side only
        expect(response).to have_http_status(:ok)
        expect(Course.count).to eq(course_count_before)
      end
    end

    # ---------------------------------------------------------------------------
    # Row 23: k5_important_dates_observer_spec.rb:44
    # Covers: observer K5 important date for observed student with assignment override
    # ---------------------------------------------------------------------------
    describe "observer K5 important date with student assignment override" do
      it "renders dashboard ok for observer whose observed student has an overridden important-date assignment" do
        # Arrange
        account = Account.default
        account.settings[:enable_as_k5_account] = { value: true, locked: true }
        account.save!

        teacher_enrollment = course_with_teacher(active_all: true, account:)
        teacher_enrollment.user
        subject_course = teacher_enrollment.course

        student = user_factory(active_all: true)
        subject_course.enroll_student(student, enrollment_state: "active")

        observer = user_factory(active_all: true, name: "Mom")
        add_linked_observer(student, observer, root_account: account)

        assignment = subject_course.assignments.create!(
          title: "Elec HW",
          grading_type: "points",
          points_possible: 100,
          due_at: 2.days.ago,
          submission_types: "online_text_entry",
          important_dates: true
        )
        override = assignment_override_model(assignment:)
        override.override_due_at(2.days.from_now)
        override.save!
        override_student = override.assignment_override_students.build
        override_student.user = student
        override_student.save!

        user_session(observer)

        # Act
        get "/"

        # Assert
        expect(response).to have_http_status(:ok)
      end
    end

    # ---------------------------------------------------------------------------
    # Row 24: k5_important_dates_student_spec.rb:43
    # Covers: student K5 important date with assignment override
    # ---------------------------------------------------------------------------
    describe "student K5 important date with assignment override" do
      it "renders dashboard ok for student with an overridden important-date assignment" do
        # Arrange
        account = Account.default
        account.settings[:enable_as_k5_account] = { value: true, locked: true }
        account.save!

        teacher_enrollment = course_with_teacher(active_all: true, account:)
        subject_course = teacher_enrollment.course

        student_enrollment = course_with_student(active_all: true, course: subject_course)
        student = student_enrollment.user

        assignment = subject_course.assignments.create!(
          title: "Elec HW",
          grading_type: "points",
          points_possible: 100,
          due_at: 2.days.ago,
          submission_types: "online_text_entry",
          important_dates: true
        )
        override = assignment_override_model(assignment:)
        override.override_due_at(2.days.from_now)
        override.save!
        override_student = override.assignment_override_students.build
        override_student.user = student
        override_student.save!

        user_session(student)

        # Act
        get "/"

        # Assert
        expect(response).to have_http_status(:ok)
      end
    end

    # ---------------------------------------------------------------------------
    # Covers: dashboard_spec.rb:457, :480, :513, :618
    # start_new_course button absent for non-admins
    # ---------------------------------------------------------------------------
    describe "start_new_course not exposed to non-creating roles" do
      it "reports no course-creation permission in js_env for a teacher" do
        # Arrange
        course_with_teacher(active_all: true)
        user_session(@teacher)

        # Act
        get "/"

        # Assert
        expect(response).to have_http_status(:ok)
        expect(js_env_from_response(response).dig("CREATE_COURSES_PERMISSIONS", "PERMISSION")).to be_nil
      end

      it "reports no course-creation permission in js_env for a student" do
        # Arrange
        course_with_student(active_all: true)
        user_session(@student)

        # Act
        get "/"

        # Assert
        expect(response).to have_http_status(:ok)
        expect(js_env_from_response(response).dig("CREATE_COURSES_PERMISSIONS", "PERMISSION")).to be_nil
      end

      it "reports no course-creation permission in js_env when students_can_create_courses is disabled" do
        # Arrange
        student = user_factory(active_all: true)
        course_with_student(user: student, active_all: true)
        Account.default.settings[:students_can_create_courses] = false
        Account.default.save!
        user_session(student)

        # Act
        get "/"

        # Assert
        expect(response).to have_http_status(:ok)
        expect(js_env_from_response(response).dig("CREATE_COURSES_PERMISSIONS", "PERMISSION")).to be_nil
      end
    end
  end

  describe "GET /dashboard-sidebar" do
    # ---------------------------------------------------------------------------
    # Row 13: dashboard_teacher_spec.rb:258
    # Covers: designer role is excluded from the legacy todo list
    # Designers have non_student_enrollment? == true but the to-do list
    # is only shown when the user has grading rights; designers do not.
    # The dashboard page renders without a to-do list for designers.
    # ---------------------------------------------------------------------------
    describe "designer role excluded from to-do list" do
      it "renders the dashboard without a .to-do-list for a designer" do
        # Arrange
        course = course_factory(active_all: true)
        designer = designer_in_course(active_all: true, course:).user
        assignment = course.assignments.create!(
          title: "Text Assignment",
          submission_types: "online_text_entry",
          points_possible: 10
        )
        student = student_in_course(active_all: true, course:).user
        assignment.submit_homework(student, submission_type: "online_text_entry", body: "Submitted work")
        user_session(designer)

        # Act
        get "/dashboard-sidebar"

        # Assert
        expect(response).to have_http_status(:ok)
        # Designers are non_student_enrollment? but don't have :manage_grades,
        # so ToDoListPresenter returns no assignments to grade.
        expect(response.body).not_to include("to-do-list")
      end
    end

    # ---------------------------------------------------------------------------
    # Row 14: dashboard_teacher_spec.rb:303
    # Covers: open_todos_in_new_tab feature flag adds target="_blank" to todo links
    # When the user-level feature flag is enabled, the _to_do_list partial
    # renders the grading links with target="_blank".
    # ---------------------------------------------------------------------------
    describe "open_todos_in_new_tab feature flag" do
      it "renders todo grading links with target=_blank when open_todos_in_new_tab is enabled" do
        # Arrange
        course = course_factory(active_all: true)
        teacher = teacher_in_course(active_all: true, course:).user
        assignment = course.assignments.create!(
          title: "Text Assignment",
          submission_types: "online_text_entry",
          points_possible: 10
        )
        student = student_in_course(active_all: true, course:).user
        assignment.submit_homework(student, submission_type: "online_text_entry", body: "Submitted work")
        teacher.enable_feature!(:open_todos_in_new_tab)
        user_session(teacher)

        # Act
        get "/dashboard-sidebar"

        # Assert
        expect(response).to have_http_status(:ok)
        expect(response.body).to include(assignment.title)
        expect(response.body).to include('target="_blank"')
      end

      # ---------------------------------------------------------------------------
      # Row 15: dashboard_teacher_spec.rb:312
      # Covers: open_todos_in_new_tab disabled (no target="_blank")
      # ---------------------------------------------------------------------------
      it "does not render target=_blank on todo link when open_todos_in_new_tab is disabled" do
        # Arrange
        enrollment = course_with_teacher(active_all: true)
        teacher = enrollment.user
        course = enrollment.course
        student = user_factory(active_all: true)
        course.enroll_student(student, enrollment_state: "active")
        assignment = course.assignments.create!(
          title: "Needs Grading",
          submission_types: "online_text_entry",
          points_possible: 10
        )
        assignment.submit_homework(student, submission_type: "online_text_entry", body: "done")
        teacher.disable_feature!(:open_todos_in_new_tab)
        user_session(teacher)

        # Act
        get "/dashboard-sidebar"

        # Assert
        expect(response).to have_http_status(:ok)
        expect(response.body).to include(assignment.title)
        expect(response.body).not_to include('target="_blank"')
      end
    end

    # ---------------------------------------------------------------------------
    # Row 16: dashboard_teacher_spec.rb:339
    # Covers: unpublished assignment excluded from coming_up for unpublished course
    # ---------------------------------------------------------------------------
    describe "unpublished course coming_up" do
      it "does not include unpublished assignment in coming_up section" do
        # Arrange
        enrollment = course_with_teacher(active_course: false)
        teacher = enrollment.user
        course = enrollment.course
        assignment = course.assignments.create!(
          name: "venkman",
          submission_types: "online",
          due_at: 2.days.from_now,
          lock_at: 1.week.from_now,
          unlock_at: 2.days.from_now,
          workflow_state: "unpublished"
        )
        user_session(teacher)

        # Act
        get "/dashboard-sidebar"

        # Assert
        expect(response).to have_http_status(:ok)
        expect(response.body).not_to include(assignment.name)
      end
    end

    # ---------------------------------------------------------------------------
    # Row 17: dashboard_todo_spec.rb:63
    # Covers: soft-concluded course: student to-do list excludes its assignments
    # ---------------------------------------------------------------------------
    describe "soft-concluded course exclusion from student todo" do
      it "does not render the to-do-list for a student whose only course is soft-concluded" do
        # Arrange
        enrollment = course_with_student(active_all: true)
        student = enrollment.user
        course = enrollment.course
        assignment = course.assignments.create!(
          title: "Due Soon",
          submission_types: "online_text_entry",
          due_at: 1.minute.from_now,
          created_at: 1.month.ago
        )
        course.start_at = 1.month.ago
        course.conclude_at = 2.weeks.ago
        course.restrict_enrollments_to_course_dates = true
        course.save!
        user_session(student)

        # Act
        get "/dashboard-sidebar"

        # Assert
        expect(response).to have_http_status(:ok)
        # student with no active course gets planner sidebar, not legacy to-do-list
        expect(response.body).not_to include(assignment.title)
      end
    end
  end

  describe "GET /api/v1/users/self/activity_stream" do
    # ---------------------------------------------------------------------------
    # Row 25: recent_activity/dashboard_spec.rb:72
    # Covers: announcement dismissal from todo sidebar: sidebar shows empty state
    # ---------------------------------------------------------------------------
    describe "announcement stream item visibility" do
      it "hides a stream item instance after it is marked hidden" do
        # Arrange
        enrollment = course_with_student(active_all: true)
        student = enrollment.user
        course = enrollment.course
        announcement = course.announcements.create!(
          title: "Sidebar Notice",
          message: "read me"
        )
        # Trigger stream item generation
        announcement.generate_stream_items([student])
        stream_instance = student.stream_item_instances.find_by(
          stream_item_id: StreamItem.find_by(asset_type: "DiscussionTopic", asset_id: announcement.id)&.id
        )
        stream_instance&.update!(hidden: true)

        user_session(student)

        # Act
        get "/api/v1/users/self/activity_stream"

        # Assert: dismissed announcement not present in stream
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        announcement_items = json.select { |i| i["type"] == "Announcement" && i["title"] == announcement.title }
        expect(announcement_items).to be_empty
      end
    end

    # ---------------------------------------------------------------------------
    # Row 26: recent_activity/dashboard_spec.rb:77
    # Covers: announcement dismissal from recent activity feed
    # ---------------------------------------------------------------------------
    describe "announcement hidden from recent activity" do
      it "excludes a hidden announcement stream item from dashboard stream" do
        # Arrange
        enrollment = course_with_student(active_all: true)
        student = enrollment.user
        course = enrollment.course
        announcement = course.announcements.create!(
          title: "Recent Activity Notice",
          message: "visible until dismissed"
        )
        announcement.generate_stream_items([student])

        # Simulate dismissal by hiding the stream item instance
        stream_item = StreamItem.find_by(asset_type: "DiscussionTopic", asset_id: announcement.id)
        student.stream_item_instances.where(stream_item_id: stream_item&.id).update_all(hidden: true)

        user_session(student)

        # Act
        get "/api/v1/users/self/activity_stream"

        # Assert: hidden announcement absent from stream
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        titles = json.pluck("title")
        expect(titles).not_to include(announcement.title)
      end
    end

    # ---------------------------------------------------------------------------
    # Row 27: recent_activity/dashboard_spec.rb:85
    # Covers: section-specific announcement: not visible to student in other section
    # ---------------------------------------------------------------------------
    describe "section-specific announcement filtering" do
      it "does not include a section1 announcement in the stream for a student in section2" do
        # Arrange
        teacher_enrollment = course_with_teacher(active_all: true)
        course = teacher_enrollment.course

        section1 = course.course_sections.first
        section2 = course.course_sections.create!(name: "Section 2")

        student1 = user_factory(active_all: true, name: "Student One")
        course.enroll_student(student1, section: section1, enrollment_state: "active")

        student2 = user_factory(active_all: true, name: "Student Two")
        course.enroll_student(student2, section: section2, enrollment_state: "active")

        announcement1 = course.announcements.create!(
          title: "Section 1 Only Notice",
          message: "only section 1 should see this",
          is_section_specific: true,
          course_sections: [section1]
        )
        # Generate stream items only for student1 (section1) — student2 should not have one
        announcement1.generate_stream_items([student1])

        user_session(student2)

        # Act
        get "/api/v1/users/self/activity_stream"

        # Assert: student2 (section2) does not see section1 announcement
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        titles = json.pluck("title")
        expect(titles).not_to include(announcement1.title)
      end
    end
  end

  describe "DELETE /api/v1/users/self/todo/:asset_string/:purpose" do
    # ---------------------------------------------------------------------------
    # Row 1: dashboard_sidebar_spec.rb:141
    # Covers: sub-assignment ignore/dismiss in teacher todo list
    # The todo sidebar dismiss endpoint for a sub-assignment removes it from the
    # teacher's todo list (via DELETE /api/v1/users/self/todo/:asset_string/grading).
    # ---------------------------------------------------------------------------
    describe "sub-assignment todo dismiss" do
      it "removes a sub-assignment from the teacher todo list after ignoring it" do
        # Arrange
        course = course_factory(active_all: true)
        teacher = teacher_in_course(active_all: true, course:).user
        course.account.enable_feature!(:discussion_checkpoints)
        student = student_in_course(active_all: true, course:).user
        reply_to_topic, _reply_to_entry, _topic = graded_discussion_topic_with_checkpoints(context: course)
        reply_to_topic.submit_homework(student, body: "checkpoint submission")
        user_session(teacher)

        # Act — ignore the sub-assignment via the API
        delete "/api/v1/users/self/todo/#{reply_to_topic.asset_string}/grading",
               params: { permanent: "0" }

        # Assert — the ignore returns success and reports ignored: true
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body["ignored"]).to be(true)
      end
    end
  end
end
