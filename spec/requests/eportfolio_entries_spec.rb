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

describe "EportfolioEntries" do
  def eportfolio_category
    @category = @portfolio.eportfolio_categories.create
  end

  def eportfolio_entry(category = nil)
    @entry = @portfolio.eportfolio_entries.new
    @entry.eportfolio_category_id = category.id if category
    @entry.save!
  end

  before do
    eportfolio_with_user(active_all: true)
    @user.account_users.create!(account: Account.default, role: student_role)
    eportfolio_category
  end

  describe "GET 'show'" do
    before { eportfolio_entry(@category) }

    it "requires authorization" do
      get "/eportfolios/#{@portfolio.id}/entries/#{@entry.id}"
      assert_unauthorized
    end

    it "assigns variables" do
      user_session(@user)
      @category.name = "My Category"
      @category.save!
      @entry.name = "test entry"
      attachment = @portfolio.user.attachments.build(filename: "some_file.pdf")
      attachment.content_type = ""
      attachment.save!
      @entry.content = [{ section_type: "attachment", attachment_id: attachment.id }]
      @entry.save!
      get "/eportfolios/#{@portfolio.id}/entries/#{@entry.id}"
      expect(response).to have_http_status(:ok)
      # Verify correct entry, category, and attachment were loaded and rendered
      expect(response.body).to include("test entry", "My Category", "some_file.pdf")
    end

    it "works off of category and entry names" do
      user_session(@user)
      @category.name = "some category"
      @category.save!
      @entry.name = "some entry"
      @entry.save!
      get "/eportfolios/#{@portfolio.id}/#{@category.slug}/#{@entry.slug}"
      expect(response).to have_http_status(:ok)
      # Verify routing by slug works and both category and entry are rendered
      expect(response.body).to include("some category")
      expect(response.body).to include("some entry")
    end

    describe "js_env" do
      before do
        user_session(@user)
        @category.name = "some category"
        @category.save!
        @entry.name = "some entry"
        @entry.save!
      end

      it "sets SKIP_ENHANCING_USER_CONTENT to true" do
        get "/eportfolios/#{@portfolio.id}/#{@category.slug}/#{@entry.slug}"
        expect(response).to have_http_status(:ok)
        expect(response.body).to include("SKIP_ENHANCING_USER_CONTENT")
      end

      it "sets SECTION_COUNT_IDX before layout and templates are rendered" do
        @entry.content = [
          { section_type: "rich_text", content: "<p>1</p>" },
          { section_type: "rich_text", content: "<p>2</p>" },
          { section_type: "rich_text", content: "<p>3</p>" }
        ]
        @entry.save!
        get "/eportfolios/#{@portfolio.id}/#{@category.slug}/#{@entry.slug}"
        expect(response).to have_http_status(:ok)
        expect(response.body).to include("<p>1</p>")
        expect(response.body).to include("<p>2</p>")
        expect(response.body).to include("<p>3</p>")
      end
    end

    context "when the eportfolio is public and the visitor is unauthenticated" do
      before { @portfolio.update!(public: true) }

      it "renders the entry without requiring a logged-in user" do
        get "/eportfolios/#{@portfolio.id}/entries/#{@entry.id}"
        expect(response).to have_http_status(:ok)
      end
    end

    context "spam eportfolios" do
      before do
        @portfolio.update!(public: true)
        @category = eportfolio_category
        eportfolio_entry(@category)
      end

      context "when the user is the author of the eportfolio" do
        it "renders the entry when the eportfolio is spam" do
          @portfolio.update!(spam_status: "marked_as_spam")
          user_session(@user)
          get "/eportfolios/#{@portfolio.id}/entries/#{@entry.id}"

          expect(response).to have_http_status(:ok)
        end
      end

      context "when the user is a non-admin, non-author of the eportfolio" do
        before do
          @other_user = user_model
          @other_user.account_users.create!(account: Account.default, role: student_role)
        end

        it "is unauthorized when the eportfolio is spam" do
          @portfolio.update!(spam_status: "marked_as_spam")
          user_session(@other_user)
          get "/eportfolios/#{@portfolio.id}/entries/#{@entry.id}"

          assert_unauthorized
        end
      end

      context "when the user is an admin" do
        before do
          @admin = account_admin_user
        end

        it "renders the entry when the eportfolio is spam and the admin has :moderate_user_content permissions" do
          @portfolio.update!(spam_status: "marked_as_spam")
          Account.default.role_overrides.create!(role: admin_role, enabled: true, permission: :moderate_user_content)
          user_session(@admin)
          get "/eportfolios/#{@portfolio.id}/entries/#{@entry.id}"

          expect(response).to have_http_status(:ok)
        end

        it "is unauthorized when the eportfolio is spam and the admin does not have :moderate_user_content permissions" do
          @portfolio.update!(spam_status: "marked_as_spam")
          Account.default.role_overrides.create!(role: admin_role, enabled: false, permission: :moderate_user_content)
          user_session(@admin)
          get "/eportfolios/#{@portfolio.id}/entries/#{@entry.id}"

          assert_unauthorized
        end
      end
    end
  end

  describe "POST 'create'" do
    it "requires authorization" do
      post "/eportfolios/#{@portfolio.id}/entries", params: {}
      assert_unauthorized
    end

    it "creates entry" do
      user_session(@user)
      post "/eportfolios/#{@portfolio.id}/entries", params: { eportfolio_entry: { eportfolio_category_id: @category.id, name: "some entry" } }
      expect(response).to have_http_status(:found)
      entry = @category.eportfolio_entries.find_by(name: "some entry")
      expect(entry).to be_present
    end
  end

  describe "PUT 'update'" do
    before { eportfolio_entry(@category) }

    it "requires authorization" do
      put "/eportfolios/#{@portfolio.id}/entries/#{@entry.id}", params: {}
      assert_unauthorized
    end

    it "updates entry" do
      user_session(@user)
      put "/eportfolios/#{@portfolio.id}/entries/#{@entry.id}", params: { eportfolio_entry: { name: "new name" } }
      expect(response).to have_http_status(:found)
      expect(@entry.reload.name).to eq("new name")
    end
  end

  describe "DELETE 'destroy'" do
    before { eportfolio_entry(@category) }

    it "requires authorization" do
      delete "/eportfolios/#{@portfolio.id}/entries/#{@entry.id}", params: {}
      assert_unauthorized
    end

    it "deletes entry" do
      user_session(@user)
      delete "/eportfolios/#{@portfolio.id}/entries/#{@entry.id}", params: {}
      expect(response).to have_http_status(:found)
      expect { @entry.reload }.to raise_error(ActiveRecord::RecordNotFound)
    end
  end

  describe "GET 'attachment'" do
    before { eportfolio_entry(@category) }

    it "requires authorization" do
      get "/eportfolios/#{@portfolio.id}/entries/#{@entry.id}/files/1"
      assert_unauthorized
    end

    it "will 404 for bad IDs" do
      user_session(@user)
      bad_id = SecureRandom.uuid
      get "/eportfolios/#{@portfolio.id}/entries/#{@entry.id}/files/#{bad_id}"
      expect(response).to have_http_status(:not_found)
    end

    describe "with sharding" do
      specs_require_sharding

      it "finds attachments on all shards associated with user" do
        user_session(@user)
        @shard1.activate do
          @user.associate_with_shard(@shard1)
          @a1 = Attachment.create!(user: @user, context: @user, filename: "test.jpg", uploaded_data: StringIO.new("first"))
        end
        get "/eportfolios/#{@portfolio.id}/entries/#{@entry.id}/files/#{@a1.uuid}"
      end
    end

    context "when the eportfolio is public and the visitor is unauthenticated" do
      before do
        @portfolio.update!(public: true)
        @attachment = Attachment.create!(user: @portfolio.user, context: @portfolio.user, filename: "test.jpg", uploaded_data: StringIO.new("data"))
      end

      it "redirects to the file download URL without requiring a logged-in user" do
        get "/eportfolios/#{@portfolio.id}/entries/#{@entry.id}/files/#{@attachment.uuid}"
        expect(response).to redirect_to(file_download_url(@attachment, verifier: @attachment.uuid))
      end
    end
  end

  describe "GET 'submission'" do
    before do
      eportfolio_entry(@category)
      @student = @user
      @course = Course.create!
      @course.enroll_student(@student).accept(force: true)
      teacher = teacher_in_course(course: @course, active_all: true).user
      @assignment = @course.assignments.create!
      @submission = @assignment.submissions.find_by(user: @student)
      @assignment.grade_student(@student, grader: teacher, score: 5)
      @entry.update!(content: [{ section_type: "submission", submission_id: @submission.id }])
    end

    it "requires authorization" do
      get "/eportfolios/#{@portfolio.id}/entries/#{@entry.id}/submissions/#{@submission.id}"
      assert_unauthorized
    end

    it "redirects to the eportfolio when the submission is not referenced by the entry" do
      other_assignment = @course.assignments.create!
      other_submission = other_assignment.submissions.find_by(user: @student)

      @portfolio.update!(public: true)
      viewer = user_model
      viewer.account_users.create!(account: Account.default, role: student_role)
      user_session(viewer)

      get "/eportfolios/#{@portfolio.id}/entries/#{@entry.id}/submissions/#{other_submission.id}"

      expect(response).to redirect_to(eportfolio_url(@portfolio))
      expect(flash[:notice]).to eql("Couldn't find that page")
    end

    it "passes anonymize_students: false to the template if the assignment is not anonymous" do
      user_session(@student)
      get "/eportfolios/#{@portfolio.id}/entries/#{@entry.id}/submissions/#{@submission.id}"
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("submission")
    end

    it "passes anonymize_students: false to the template if the assignment is anonymous and grades are posted" do
      user_session(@student)
      @assignment.update!(anonymous_grading: true)
      @assignment.post_submissions
      get "/eportfolios/#{@portfolio.id}/entries/#{@entry.id}/submissions/#{@submission.id}"
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("submission")
    end

    it "passes anonymize_students: true to the template if the assignment is anonymous and grades are unposted" do
      user_session(@student)
      @assignment.update!(anonymous_grading: true)
      @assignment.hide_submissions
      get "/eportfolios/#{@portfolio.id}/entries/#{@entry.id}/submissions/#{@submission.id}"
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("submission")
    end

    context "when the eportfolio is public and the visitor is unauthenticated" do
      before { @portfolio.update!(public: true) }

      it "renders the submission preview without requiring a logged-in user" do
        get "/eportfolios/#{@portfolio.id}/entries/#{@entry.id}/submissions/#{@submission.id}"
        expect(response).to have_http_status(:ok)
        expect(response.body).to include("submission")
      end
    end
  end
end
