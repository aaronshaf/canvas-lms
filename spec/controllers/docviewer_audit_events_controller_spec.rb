# frozen_string_literal: true

#
# Copyright (C) 2018 - present Instructure, Inc.
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

describe "DocviewerAuditEvents", type: :request do
  # Build a fresh set of course/users/attachment/canvadoc records for each test.
  # Called inline inside every `it` body so setup is self-documenting.
  def build_docviewer_context
    encoded_secret = "c2Vrcml0"
    secret         = Base64.decode64(encoded_secret)
    course         = Course.create!(name: "a course")
    student        = student_in_course(name: "Student", course:, enrollment_state: :active).user
    teacher        = teacher_in_course(name: "teacher", course:, enrollment_state: :active).user
    attachment     = student.attachments.create!(
      course:, content_type: "text/plain", filename: "attachment.txt"
    )
    canvadoc = Canvadoc.create!(
      document_id: "abc123#{attachment.id}", attachment_id: attachment.id
    )
    { encoded_secret:, secret:, course:, student:, teacher:, attachment:, canvadoc: }
  end

  # Returns the base params hash for a docviewer audit event POST.
  # Callers may deep_merge additional keys as needed.
  def docviewer_params(token:, canvas_user_id:, document_id:)
    {
      docviewer_audit_event: {
        annotation_body: { color: "", content: "", created_at: "", modified_at: "", page: "", type: "" },
        event_type: "highlight_created",
        related_annotation_id: 1
      },
      token:,
      canvas_user_id:,
      document_id:
    }
  end

  # Stubs DynamicSettings so the canvadoc JWT secret resolves without hitting
  # external infrastructure.  Must be called inside each `it` body.
  def stub_canvadoc_secret(encoded_secret)
    allow(DynamicSettings).to receive(:find).and_return(DynamicSettings::FallbackProxy.new)
    allow(DynamicSettings).to receive(:find)
      .with(service: "canvadoc", default_ttl: 5.minutes)
      .and_return({ "secret" => encoded_secret })
  end

  def post_audit_event(submission, params)
    post "/submissions/#{submission.id}/docviewer_audit_events.json", params:, as: :json
  end

  describe "status codes" do
    it "renders status unauthorized if not passed a correct jwt auth token" do
      # Arrange
      ctx = build_docviewer_context
      stub_canvadoc_secret(ctx[:encoded_secret])
      assignment = Assignment.create!(course: ctx[:course], name: "anonymous", anonymous_grading: true)
      submission = assignment.submit_homework(
        ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
      )
      params = docviewer_params(
        token: "wrong token",
        canvas_user_id: ctx[:teacher].id,
        document_id: ctx[:canvadoc].document_id
      )

      # Act
      post_audit_event(submission, params)

      # Assert
      expect(response).to have_http_status(:unauthorized)
    end

    it "explains if not passed a correct jwt auth token" do
      # Arrange
      ctx = build_docviewer_context
      stub_canvadoc_secret(ctx[:encoded_secret])
      assignment = Assignment.create!(course: ctx[:course], name: "anonymous", anonymous_grading: true)
      submission = assignment.submit_homework(
        ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
      )
      params = docviewer_params(
        token: "wrong token",
        canvas_user_id: ctx[:teacher].id,
        document_id: ctx[:canvadoc].document_id
      )

      # Act
      post_audit_event(submission, params)

      # Assert
      expect(response.parsed_body.fetch("message")).to eq "JWT signature invalid"
    end

    it "renders status bad_request if param values are missing" do
      # Arrange
      ctx = build_docviewer_context
      stub_canvadoc_secret(ctx[:encoded_secret])
      assignment = Assignment.create!(course: ctx[:course], name: "anonymous", anonymous_grading: true)
      submission = assignment.submit_homework(
        ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
      )
      token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
      params = {
        token:,
        canvas_user_id: ctx[:teacher].id,
        document_id: ctx[:canvadoc].document_id
        # docviewer_audit_event intentionally omitted to trigger bad_request
      }

      # Act
      post_audit_event(submission, params)

      # Assert
      expect(response).to have_http_status(:bad_request)
    end

    it "renders status not_acceptable for a non-moderated, non-anonymous assignment" do
      # Arrange
      ctx = build_docviewer_context
      stub_canvadoc_secret(ctx[:encoded_secret])
      assignment = Assignment.create!(course: ctx[:course], name: "non-moderated and non-anonymous")
      submission = assignment.submit_homework(
        ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
      )
      token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
      params = docviewer_params(
        token:, canvas_user_id: ctx[:teacher].id, document_id: ctx[:canvadoc].document_id
      )

      # Act
      post_audit_event(submission, params)

      # Assert
      expect(response).to have_http_status(:not_acceptable)
      expect(response.parsed_body.fetch("message")).to eq "Assignment is neither anonymous nor moderated"
    end

    it "explains why it rendered status not_acceptable" do
      # Arrange
      ctx = build_docviewer_context
      stub_canvadoc_secret(ctx[:encoded_secret])
      assignment = Assignment.create!(course: ctx[:course], name: "non-moderated and non-anonymous")
      submission = assignment.submit_homework(
        ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
      )
      token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
      params = docviewer_params(
        token:, canvas_user_id: ctx[:teacher].id, document_id: ctx[:canvadoc].document_id
      )

      # Act
      post_audit_event(submission, params)

      # Assert
      expect(response.parsed_body.fetch("message")).to eq "Assignment is neither anonymous nor moderated"
    end

    it "renders status unprocessable_entity if passed an invalid event type" do
      # Arrange
      ctx = build_docviewer_context
      stub_canvadoc_secret(ctx[:encoded_secret])
      assignment = Assignment.create!(
        course: ctx[:course], name: "generally reasonable", anonymous_grading: true
      )
      submission = assignment.submit_homework(
        ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
      )
      token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
      params = docviewer_params(
        token:, canvas_user_id: ctx[:teacher].id, document_id: ctx[:canvadoc].document_id
      ).deep_merge(docviewer_audit_event: { event_type: "miscellaneous_annotation_created" })

      # Act
      post_audit_event(submission, params)

      # Assert
      expect(response).to have_http_status(:unprocessable_content)
    end

    it "renders status not_found if passed a document_id that does not match submission" do
      # Arrange
      ctx = build_docviewer_context
      stub_canvadoc_secret(ctx[:encoded_secret])
      assignment = Assignment.create!(
        course: ctx[:course], name: "generally reasonable", anonymous_grading: true
      )
      submission = assignment.submit_homework(
        ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
      )
      token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
      params = docviewer_params(
        token:,
        canvas_user_id: ctx[:teacher].id,
        document_id: "bad_string_#{ctx[:canvadoc].document_id}"
      )

      # Act
      post_audit_event(submission, params)

      # Assert
      expect(response).to have_http_status(:not_found)
    end

    it "associates document_id with annotatable_attachments when assignment is Student Annotation type" do
      # Arrange
      ctx = build_docviewer_context
      stub_canvadoc_secret(ctx[:encoded_secret])
      assignment = Assignment.create!(
        annotatable_attachment: ctx[:attachment],
        anonymous_grading: true,
        course: ctx[:course],
        name: "generally reasonable",
        submission_types: "student_annotation"
      )
      submission = assignment.submit_homework(
        ctx[:student],
        annotatable_attachment_id: ctx[:attachment].id,
        submission_type: "student_annotation"
      )
      token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
      params = docviewer_params(
        token:, canvas_user_id: ctx[:teacher].id, document_id: ctx[:canvadoc].document_id
      )

      # Act + Assert
      expect do
        post_audit_event(submission, params)
      end.to change {
        AnonymousOrModerationEvent.where(assignment:, submission:, user: ctx[:teacher]).count
      }.by(1)
    end

    it "associates document_id with annotatable_attachments when student annotation assignment has no attempts" do
      # Arrange
      ctx = build_docviewer_context
      stub_canvadoc_secret(ctx[:encoded_secret])
      student_in_course(active_all: true, course: ctx[:course])
      assignment = Assignment.create!(
        annotatable_attachment: ctx[:attachment],
        anonymous_grading: true,
        course: ctx[:course],
        name: "generally reasonable",
        submission_types: "student_annotation"
      )
      submission = assignment.submissions.find_by(user_id: ctx[:student].id)
      token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
      params = docviewer_params(
        token:, canvas_user_id: ctx[:teacher].id, document_id: ctx[:canvadoc].document_id
      )

      # Act + Assert
      expect do
        post_audit_event(submission, params)
      end.to change {
        AnonymousOrModerationEvent.where(assignment:, submission:, user: ctx[:teacher]).count
      }.by(1)
    end

    context "for a moderated assignment" do
      it "renders status ok if assignment has an open slot for moderating" do
        # Arrange
        ctx = build_docviewer_context
        stub_canvadoc_secret(ctx[:encoded_secret])
        first_ta = ta_in_course(name: "First Ta", course: ctx[:course], enrollment_state: :active).user
        assignment = Assignment.create!(
          course: ctx[:course],
          name: "moderated",
          moderated_grading: true,
          grader_count: 2,
          final_grader: ctx[:teacher]
        )
        submission = assignment.submit_homework(
          ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
        )
        token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
        params = docviewer_params(
          token:, canvas_user_id: first_ta.id, document_id: ctx[:canvadoc].document_id
        )

        # Act
        post_audit_event(submission, params)

        # Assert
        expect(response).to have_http_status(:ok)
      end

      it "renders status ok if assignment does not have an open slot for moderating but user is final grader" do
        # Arrange
        ctx = build_docviewer_context
        stub_canvadoc_secret(ctx[:encoded_secret])
        first_ta = ta_in_course(name: "First Ta", course: ctx[:course], enrollment_state: :active).user
        assignment = Assignment.create!(
          course: ctx[:course],
          name: "moderated",
          moderated_grading: true,
          grader_count: 1,
          final_grader: ctx[:teacher]
        )
        submission = assignment.submit_homework(
          ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
        )
        assignment.grade_student(ctx[:student], grade: 10, grader: first_ta, provisional: true)
        token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
        params = docviewer_params(
          token:, canvas_user_id: ctx[:teacher].id, document_id: ctx[:canvadoc].document_id
        )

        # Act
        post_audit_event(submission, params)

        # Assert
        expect(response).to have_http_status(:ok)
      end

      it "renders status forbidden if no open slot and user is not final grader" do
        # Arrange
        ctx       = build_docviewer_context
        stub_canvadoc_secret(ctx[:encoded_secret])
        first_ta  = ta_in_course(name: "First Ta",  course: ctx[:course], enrollment_state: :active).user
        second_ta = ta_in_course(name: "Second Ta", course: ctx[:course], enrollment_state: :active).user
        assignment = Assignment.create!(
          course: ctx[:course],
          name: "moderated",
          moderated_grading: true,
          grader_count: 1,
          final_grader: ctx[:teacher]
        )
        submission = assignment.submit_homework(
          ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
        )
        assignment.grade_student(ctx[:student], grade: 10, grader: first_ta, provisional: true)
        token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
        params = docviewer_params(
          token:, canvas_user_id: second_ta.id, document_id: ctx[:canvadoc].document_id
        )

        # Act
        post_audit_event(submission, params)

        # Assert
        expect(response).to have_http_status(:forbidden)
      end

      it "explains that user cannot be a moderation grader, if so" do
        # Arrange
        ctx = build_docviewer_context
        stub_canvadoc_secret(ctx[:encoded_secret])
        first_ta  = ta_in_course(name: "First Ta",  course: ctx[:course], enrollment_state: :active).user
        second_ta = ta_in_course(name: "Second Ta", course: ctx[:course], enrollment_state: :active).user
        assignment = Assignment.create!(
          course: ctx[:course],
          name: "moderated",
          moderated_grading: true,
          grader_count: 1,
          final_grader: ctx[:teacher]
        )
        submission = assignment.submit_homework(
          ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
        )
        assignment.grade_student(ctx[:student], grade: 10, grader: first_ta, provisional: true)
        token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
        params = docviewer_params(
          token:, canvas_user_id: second_ta.id, document_id: ctx[:canvadoc].document_id
        )

        # Act
        post_audit_event(submission, params)

        # Assert
        expect(response.parsed_body.fetch("message")).to eq "Reached maximum number of graders for assignment"
      end
    end

    context "for an anonymous assignment" do
      it "renders status ok" do
        # Arrange
        ctx = build_docviewer_context
        stub_canvadoc_secret(ctx[:encoded_secret])
        assignment = Assignment.create!(course: ctx[:course], name: "anonymous", anonymous_grading: true)
        submission = assignment.submit_homework(
          ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
        )
        token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
        params = docviewer_params(
          token:, canvas_user_id: ctx[:teacher].id, document_id: ctx[:canvadoc].document_id
        )

        # Act
        post_audit_event(submission, params)

        # Assert
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body).to have_key("anonymous_or_moderation_event")
      end
    end
  end

  it "allows students to annotate, if assignment is anonymous or moderated" do
    # Arrange
    ctx = build_docviewer_context
    stub_canvadoc_secret(ctx[:encoded_secret])
    assignment = Assignment.create!(course: ctx[:course], name: "anonymous", anonymous_grading: true)
    submission = assignment.submit_homework(
      ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
    )
    token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
    params = docviewer_params(
      token:, canvas_user_id: ctx[:student].id, document_id: ctx[:canvadoc].document_id
    )

    # Act + Assert
    expect do
      post_audit_event(submission, params)
    end.to change {
      AnonymousOrModerationEvent.where(assignment:, submission:).count
    }.by(1)
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to have_key("anonymous_or_moderation_event")
  end

  it "allows fake students to annotate, if assignment is anonymous or moderated" do
    # Arrange
    ctx = build_docviewer_context
    stub_canvadoc_secret(ctx[:encoded_secret])
    fake_student = course_with_user("StudentViewEnrollment", course: ctx[:course]).user
    fake_attachment = fake_student.attachments.create!(
      course: ctx[:course], content_type: "text/plain", filename: "attachment.txt"
    )
    fake_canvadoc = Canvadoc.create!(
      document_id: "abc123#{fake_attachment.id}", attachment_id: fake_attachment.id
    )
    assignment = Assignment.create!(course: ctx[:course], name: "anonymous", anonymous_grading: true)
    submission = assignment.submit_homework(
      fake_student, submission_type: "online_upload", attachments: [fake_attachment]
    )
    token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
    params = docviewer_params(
      token:, canvas_user_id: fake_student.id, document_id: fake_canvadoc.document_id
    )

    # Act + Assert
    expect do
      post_audit_event(submission, params)
    end.to change {
      AnonymousOrModerationEvent.where(assignment:, submission:).count
    }.by(1)
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to have_key("anonymous_or_moderation_event")
  end

  context "as an admin" do
    it "can annotate even if there are no slots available" do
      # Arrange
      ctx = build_docviewer_context
      stub_canvadoc_secret(ctx[:encoded_secret])
      first_ta = ta_in_course(name: "First Ta", course: ctx[:course], enrollment_state: :active).user
      admin    = account_admin_user
      assignment = Assignment.create!(
        course: ctx[:course],
        name: "moderated",
        moderated_grading: true,
        grader_count: 2,
        final_grader: ctx[:teacher]
      )
      submission = assignment.submit_homework(
        ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
      )
      assignment.grade_student(ctx[:student], grade: 10, grader: first_ta, provisional: true)
      assignment.update!(grader_count: 1) # fill all TA slots so admin bypass is exercised
      token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
      params = docviewer_params(
        token:, canvas_user_id: admin.id, document_id: ctx[:canvadoc].document_id
      )

      # Act + Assert
      expect do
        post_audit_event(submission, params)
      end.to change {
        AnonymousOrModerationEvent.where(assignment:, submission:).count
      }.by(1)
      expect(response).to have_http_status(:ok)
    end

    it "does not occupy a slot when annotating" do
      # Arrange
      ctx = build_docviewer_context
      stub_canvadoc_secret(ctx[:encoded_secret])
      first_ta = ta_in_course(name: "First Ta", course: ctx[:course], enrollment_state: :active).user
      admin    = account_admin_user
      assignment = Assignment.create!(
        course: ctx[:course],
        name: "moderated",
        moderated_grading: true,
        grader_count: 2,
        final_grader: ctx[:teacher]
      )
      submission = assignment.submit_homework(
        ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
      )
      assignment.grade_student(ctx[:student], grade: 10, grader: first_ta, provisional: true)
      slots_before = assignment.provisional_moderation_graders.count
      token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
      params = docviewer_params(
        token:, canvas_user_id: admin.id, document_id: ctx[:canvadoc].document_id
      )

      # Act
      post_audit_event(submission, params)

      # Assert
      expect(assignment.reload.provisional_moderation_graders.count).to eq slots_before
      expect(response).to have_http_status(:ok)
    end
  end

  it "updates an existing moderation grader to occupy slot, if it had not already" do
    # Arrange
    ctx = build_docviewer_context
    stub_canvadoc_secret(ctx[:encoded_secret])
    first_ta = ta_in_course(name: "First Ta", course: ctx[:course], enrollment_state: :active).user
    assignment = Assignment.create!(
      course: ctx[:course],
      name: "moderated",
      moderated_grading: true,
      grader_count: 2,
      final_grader: ctx[:teacher]
    )
    existing_grader = assignment.moderation_graders.create!(
      user: first_ta, anonymous_id: "12345", slot_taken: false
    )
    submission = assignment.submit_homework(
      ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
    )
    token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
    params = docviewer_params(
      token:, canvas_user_id: first_ta.id, document_id: ctx[:canvadoc].document_id
    )

    # Act
    post_audit_event(submission, params)

    # Assert
    expect(existing_grader.reload.slot_taken).to be true
  end

  it "handles canvadocs on older version submissions" do
    # Arrange
    ctx = build_docviewer_context
    stub_canvadoc_secret(ctx[:encoded_secret])
    second_attachment = ctx[:student].attachments.create!(
      course: ctx[:course], content_type: "text/plain", filename: "attachment.txt"
    )
    Canvadoc.create!(
      document_id: "abc123#{second_attachment.id}", attachment_id: second_attachment.id
    )
    assignment = Assignment.create!(course: ctx[:course], name: "anonymous", anonymous_grading: true)
    first_submission = assignment.submit_homework(
      ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
    )
    first_submission.update!(submitted_at: 1.hour.ago)
    submission = assignment.submit_homework(
      ctx[:student], submission_type: "online_upload", attachments: [second_attachment]
    )
    token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
    # Deliberately use the first attachment's canvadoc to verify older-version lookup
    params = docviewer_params(
      token:, canvas_user_id: ctx[:teacher].id, document_id: ctx[:canvadoc].document_id
    )

    # Act + Assert
    expect do
      post_audit_event(submission, params)
    end.to change {
      AnonymousOrModerationEvent.where(assignment:, submission:).count
    }.by(1)
  end

  it "creates a moderation grader" do
    # Arrange
    ctx = build_docviewer_context
    stub_canvadoc_secret(ctx[:encoded_secret])
    first_ta = ta_in_course(name: "First Ta", course: ctx[:course], enrollment_state: :active).user
    assignment = Assignment.create!(
      course: ctx[:course],
      name: "moderated",
      moderated_grading: true,
      grader_count: 2,
      final_grader: ctx[:teacher]
    )
    submission = assignment.submit_homework(
      ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
    )
    token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
    params = docviewer_params(
      token:, canvas_user_id: first_ta.id, document_id: ctx[:canvadoc].document_id
    )

    # Act
    post_audit_event(submission, params)

    # Assert
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to have_key("anonymous_or_moderation_event")
    expect(assignment.reload.moderation_graders.pluck(:user_id)).to include first_ta.id
  end

  it "creates a moderation grader even if full, if user is final grader" do
    # Arrange
    ctx = build_docviewer_context
    stub_canvadoc_secret(ctx[:encoded_secret])
    first_ta = ta_in_course(name: "First Ta", course: ctx[:course], enrollment_state: :active).user
    assignment = Assignment.create!(
      course: ctx[:course],
      name: "moderated",
      moderated_grading: true,
      grader_count: 1,
      final_grader: ctx[:teacher]
    )
    submission = assignment.submit_homework(
      ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
    )
    assignment.grade_student(ctx[:student], grade: 10, grader: first_ta, provisional: true)
    token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
    params = docviewer_params(
      token:, canvas_user_id: ctx[:teacher].id, document_id: ctx[:canvadoc].document_id
    )

    # Act
    post_audit_event(submission, params)

    # Assert
    expect(assignment.reload.moderation_graders.pluck(:user_id)).to include ctx[:teacher].id
  end

  it "allows any grader to annotate a moderated assignment if grades have been posted" do
    # Arrange
    ctx      = build_docviewer_context
    stub_canvadoc_secret(ctx[:encoded_secret])
    first_ta = ta_in_course(name: "First Ta", course: ctx[:course], enrollment_state: :active).user
    assignment = Assignment.create!(
      course: ctx[:course],
      name: "moderated",
      moderated_grading: true,
      grader_count: 1,
      final_grader: ctx[:teacher]
    )
    submission = assignment.submit_homework(
      ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
    )
    assignment.grade_student(ctx[:student], grade: 10, grader: ctx[:teacher], provisional: true)
    assignment.update!(grades_published_at: Time.zone.now)
    token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
    params = docviewer_params(
      token:, canvas_user_id: first_ta.id, document_id: ctx[:canvadoc].document_id
    )

    # Act + Assert
    expect do
      post_audit_event(submission, params)
    end.to change {
      AnonymousOrModerationEvent.where(
        assignment:, canvadoc: ctx[:canvadoc], submission:
      ).count
    }.by(1)
  end

  it "creates an AnonymousOrModerationEvent" do
    # Arrange
    ctx = build_docviewer_context
    stub_canvadoc_secret(ctx[:encoded_secret])
    assignment = Assignment.create!(course: ctx[:course], anonymous_grading: true, name: "anonymous")
    submission = assignment.submit_homework(
      ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
    )
    token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
    params = docviewer_params(
      token:, canvas_user_id: ctx[:teacher].id, document_id: ctx[:canvadoc].document_id
    )

    # Act + Assert
    expect do
      post_audit_event(submission, params)
    end.to change {
      AnonymousOrModerationEvent.where(
        assignment:, canvadoc: ctx[:canvadoc], submission:
      ).count
    }.by(1)
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to have_key("anonymous_or_moderation_event")
  end

  it "saves a copy of the annotation_body in the payload" do
    # Arrange
    ctx = build_docviewer_context
    stub_canvadoc_secret(ctx[:encoded_secret])
    assignment = Assignment.create!(course: ctx[:course], anonymous_grading: true, name: "anonymous")
    submission = assignment.submit_homework(
      ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
    )
    token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
    params = docviewer_params(
      token:, canvas_user_id: ctx[:teacher].id, document_id: ctx[:canvadoc].document_id
    ).deep_merge(docviewer_audit_event: { annotation_body: { type: "a type" } })

    # Act
    post_audit_event(submission, params)

    # Assert
    event = AnonymousOrModerationEvent.find_by!(
      assignment:, canvadoc: ctx[:canvadoc], submission:
    )
    expect(event.payload.fetch("annotation_body").fetch("type")).to eq "a type"
  end

  it "saves the annotation_id in the payload" do
    # Arrange
    ctx = build_docviewer_context
    stub_canvadoc_secret(ctx[:encoded_secret])
    annotation_id = 23
    assignment    = ctx[:course].assignments.create!(anonymous_grading: true, name: "anonymous")
    submission    = assignment.submit_homework(
      ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
    )
    token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
    params = docviewer_params(
      token:, canvas_user_id: ctx[:teacher].id, document_id: ctx[:canvadoc].document_id
    ).deep_merge(docviewer_audit_event: { annotation_id: })

    # Act
    post_audit_event(submission, params)

    # Assert
    event = AnonymousOrModerationEvent.find_by!(assignment:, submission:)
    expect(event.payload.fetch("annotation_id")).to eql annotation_id
  end

  it "saves the context in the payload" do
    # Arrange
    ctx = build_docviewer_context
    stub_canvadoc_secret(ctx[:encoded_secret])
    assignment = ctx[:course].assignments.create!(anonymous_grading: true, name: "anonymous")
    submission = assignment.submit_homework(
      ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
    )
    token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
    params = docviewer_params(
      token:, canvas_user_id: ctx[:teacher].id, document_id: ctx[:canvadoc].document_id
    ).deep_merge(docviewer_audit_event: { context: "a context" })

    # Act
    post_audit_event(submission, params)

    # Assert
    event = AnonymousOrModerationEvent.find_by!(assignment:, submission:)
    expect(event.payload.fetch("context")).to eq "a context"
  end

  it "saves the related_annotation_id in the payload" do
    # Arrange
    ctx = build_docviewer_context
    stub_canvadoc_secret(ctx[:encoded_secret])
    related_annotation_id = 23
    assignment            = Assignment.create!(
      course: ctx[:course], anonymous_grading: true, name: "anonymous"
    )
    submission = assignment.submit_homework(
      ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
    )
    token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
    params = docviewer_params(
      token:, canvas_user_id: ctx[:teacher].id, document_id: ctx[:canvadoc].document_id
    ).deep_merge(docviewer_audit_event: { related_annotation_id: })

    # Act
    post_audit_event(submission, params)

    # Assert
    event = AnonymousOrModerationEvent.find_by!(
      assignment:, canvadoc: ctx[:canvadoc], submission:
    )
    expect(event.payload["related_annotation_id"]).to eql related_annotation_id
  end

  it "renders a json representation of the event on successful creation" do
    # Arrange
    ctx = build_docviewer_context
    stub_canvadoc_secret(ctx[:encoded_secret])
    assignment = Assignment.create!(course: ctx[:course], anonymous_grading: true, name: "anonymous")
    submission = assignment.submit_homework(
      ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
    )
    token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
    params = docviewer_params(
      token:, canvas_user_id: ctx[:teacher].id, document_id: ctx[:canvadoc].document_id
    )

    # Act
    post_audit_event(submission, params)

    # Assert
    event = AnonymousOrModerationEvent.find_by!(
      assignment:, canvadoc: ctx[:canvadoc], submission:
    )
    expect(response.parsed_body.fetch("anonymous_or_moderation_event").fetch("id")).to eq event.id
  end

  it "is okay if related_annotation_id is not passed" do
    # Arrange
    ctx = build_docviewer_context
    stub_canvadoc_secret(ctx[:encoded_secret])
    assignment = Assignment.create!(course: ctx[:course], anonymous_grading: true, name: "anonymous")
    submission = assignment.submit_homework(
      ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
    )
    token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
    params = docviewer_params(
      token:, canvas_user_id: ctx[:teacher].id, document_id: ctx[:canvadoc].document_id
    )
    params[:docviewer_audit_event].delete(:related_annotation_id) # key absent is what's under test

    # Act
    post_audit_event(submission, params)

    # Assert
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to have_key("anonymous_or_moderation_event")
  end

  it "creates an event with 'docviewer_' prepended to the supplied event type" do
    # Arrange
    ctx = build_docviewer_context
    stub_canvadoc_secret(ctx[:encoded_secret])
    input_event_type    = "highlight_created"
    expected_event_type = "docviewer_highlight_created"
    assignment = Assignment.create!(course: ctx[:course], anonymous_grading: true, name: "zzzzz")
    submission = assignment.submit_homework(
      ctx[:student], submission_type: "online_upload", attachments: [ctx[:attachment]]
    )
    token  = Canvas::Security.create_jwt({}, nil, ctx[:secret], :HS512)
    params = docviewer_params(
      token:, canvas_user_id: ctx[:teacher].id, document_id: ctx[:canvadoc].document_id
    ).deep_merge(docviewer_audit_event: { event_type: input_event_type })

    # Act + Assert
    expect do
      post_audit_event(submission, params)
    end.to change {
      AnonymousOrModerationEvent.where(
        assignment:, submission:, event_type: expected_event_type
      ).count
    }.by(1)
  end
end
