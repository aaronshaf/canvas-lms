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

describe EportfolioCategoriesController, type: :request do
  describe "GET 'index'" do
    it "redirects" do
      eportfolio_with_user(active_all: true)
      @user.account_users.create!(account: Account.default, role: student_role)
      user_session(@user)
      get "/eportfolios/#{@portfolio.id}/categories"
      expect(response).to redirect_to(eportfolio_url(@portfolio))
    end

    context "as an unauthenticated user" do
      it "redirects to the eportfolio when it is public" do
        eportfolio_with_user(active_all: true)
        portfolio = @portfolio
        portfolio.update!(public: true)

        get "/eportfolios/#{portfolio.id}/categories"

        expect(response).to redirect_to(eportfolio_url(portfolio))
      end

      it "redirects to login when the eportfolio is private" do
        eportfolio_with_user(active_all: true)
        get "/eportfolios/#{@portfolio.id}/categories"

        expect(response).to redirect_to(login_url)
      end
    end
  end

  describe "GET 'show'" do
    it "requires authorization" do
      eportfolio_with_user(active_all: true)
      @user.account_users.create!(account: Account.default, role: student_role)
      get "/eportfolios/#{@portfolio.id}/categories/1"
      expect(response).to redirect_to(login_url)
    end

    context "as an unauthenticated user" do
      it "renders the category when the eportfolio is public" do
        eportfolio_with_user(active_all: true)
        category = @portfolio.eportfolio_categories.create(name: "some name")
        entry = @portfolio.eportfolio_entries.new
        entry.eportfolio_category_id = category.id
        entry.save!
        @portfolio.update!(public: true)

        get "/eportfolios/#{@portfolio.id}/categories/#{category.id}"

        expect(response).to have_http_status(:ok)
        expect(response.body).to include("some name")
      end

      it "redirects to login when the eportfolio is private" do
        eportfolio_with_user(active_all: true)
        category = @portfolio.eportfolio_categories.create(name: "some name")
        get "/eportfolios/#{@portfolio.id}/categories/#{category.id}"

        expect(response).to redirect_to(login_url)
      end
    end

    it "renders the category with variables" do
      eportfolio_with_user(active_all: true)
      @user.account_users.create!(account: Account.default, role: student_role)
      category = @portfolio.eportfolio_categories.create(name: "some name")
      user_session(@user)
      get "/eportfolios/#{@portfolio.id}/categories/#{category.id}"
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("some name")
    end

    it "responds to named category request" do
      eportfolio_with_user(active_all: true)
      @user.account_users.create!(account: Account.default, role: student_role)
      category = @portfolio.eportfolio_categories.create(name: "some name")
      user_session(@user)
      get "/eportfolios/#{@portfolio.id}/#{category.slug}"
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("some name")
    end

    context "with active submissions by owner" do
      it "renders the category without error" do
        eportfolio_with_user(active_all: true)
        category = @portfolio.eportfolio_categories.create(name: "some name")
        course = course_model
        att = attachment_model(filename: "submission.doc", context: @portfolio.user)
        assignment = course.assignments.create!(title: "some assignment", submission_types: "online_upload")
        assignment.submit_homework(@portfolio.user, submission_type: "online_upload", attachments: [att])
        user_session(@portfolio.user)
        get "/eportfolios/#{@portfolio.id}/#{category.slug}"
        expect(response).to have_http_status(:ok)
        expect(response.body).to include("some name")
      end

      it "does not show submissions for unpublished assignments" do
        eportfolio_with_user(active_all: true)
        category = @portfolio.eportfolio_categories.create(name: "some name")
        course = course_model
        att = attachment_model(filename: "submission.doc", context: @portfolio.user)
        assignment = course.assignments.create!(title: "some assignment", submission_types: "online_upload")
        assignment.submit_homework(@portfolio.user, submission_type: "online_upload", attachments: [att])
        assignment.unpublish
        user_session(@portfolio.user)
        get "/eportfolios/#{@portfolio.id}/#{category.slug}"
        expect(response).to have_http_status(:ok)
        expect(response.body).to include("some name")
      end

      it "does not show submissions for unpublished courses" do
        eportfolio_with_user(active_all: true)
        category = @portfolio.eportfolio_categories.create(name: "some name")
        course = course_model
        att = attachment_model(filename: "submission.doc", context: @portfolio.user)
        assignment = course.assignments.create!(title: "some assignment", submission_types: "online_upload")
        assignment.submit_homework(@portfolio.user, submission_type: "online_upload", attachments: [att])
        course.update!(workflow_state: "claimed")
        user_session(@portfolio.user)
        get "/eportfolios/#{@portfolio.id}/#{category.slug}"
        expect(response).to have_http_status(:ok)
        expect(response.body).to include("some name")
      end
    end

    context "spam eportfolios" do
      context "when the user is the author of the eportfolio" do
        it "renders the category when the eportfolio is spam" do
          eportfolio_with_user(active_all: true)
          @user.account_users.create!(account: Account.default, role: student_role)
          category = @portfolio.eportfolio_categories.create(name: "some name")
          @portfolio.update!(public: true)
          @portfolio.eportfolio_entries.create!(eportfolio_category: category, name: "new page")
          @portfolio.update!(spam_status: "marked_as_spam")
          user_session(@user)
          get "/eportfolios/#{@portfolio.id}/#{category.slug}"

          expect(response).to have_http_status(:ok)
          expect(response.body).to include("some name")
        end
      end

      context "when the user is a non-admin, non-author of the eportfolio" do
        it "is unauthorized when the eportfolio is spam" do
          eportfolio_with_user(active_all: true)
          category = @portfolio.eportfolio_categories.create(name: "some name")
          @portfolio.update!(public: true)
          @portfolio.eportfolio_entries.create!(eportfolio_category: category, name: "new page")
          other_user = user_model
          other_user.account_users.create!(account: Account.default, role: student_role)
          @portfolio.update!(spam_status: "marked_as_spam")
          user_session(other_user)
          get "/eportfolios/#{@portfolio.id}/#{category.slug}"

          expect(response).to have_http_status(:unauthorized)
        end
      end

      context "when the user is an admin" do
        it "renders the category when the eportfolio is spam and the admin has :moderate_user_content permissions" do
          eportfolio_with_user(active_all: true)
          category = @portfolio.eportfolio_categories.create(name: "some name")
          @portfolio.update!(public: true)
          @portfolio.eportfolio_entries.create!(eportfolio_category: category, name: "new page")
          admin = account_admin_user
          @portfolio.update!(spam_status: "marked_as_spam")
          Account.default.role_overrides.create!(role: admin_role, enabled: true, permission: :moderate_user_content)
          user_session(admin)
          get "/eportfolios/#{@portfolio.id}/#{category.slug}"

          expect(response).to have_http_status(:ok)
          expect(response.body).to include("some name")
        end

        it "is unauthorized when the eportfolio is spam and the admin does not have :moderate_user_content permissions" do
          eportfolio_with_user(active_all: true)
          category = @portfolio.eportfolio_categories.create(name: "some name")
          @portfolio.update!(public: true)
          @portfolio.eportfolio_entries.create!(eportfolio_category: category, name: "new page")
          admin = account_admin_user
          @portfolio.update!(spam_status: "marked_as_spam")
          Account.default.role_overrides.create!(role: admin_role, enabled: false, permission: :moderate_user_content)
          user_session(admin)
          get "/eportfolios/#{@portfolio.id}/#{category.slug}"

          expect(response).to have_http_status(:unauthorized)
        end
      end
    end
  end

  describe "POST 'create'" do
    it "requires authorization" do
      eportfolio_with_user(active_all: true)
      @user.account_users.create!(account: Account.default, role: student_role)
      post "/eportfolios/#{@portfolio.id}/categories", params: { eportfolio_category: { name: "some portfolio" } }
      expect(response).to redirect_to(login_url)
    end

    it "creates eportfolio category" do
      eportfolio_with_user(active_all: true)
      @user.account_users.create!(account: Account.default, role: student_role)
      user_session(@user)
      post "/eportfolios/#{@portfolio.id}/categories", params: { eportfolio_category: { name: "some category" } }
      expect(response).to have_http_status(:found)
    end
  end

  describe "PUT 'update'" do
    it "requires authorization" do
      eportfolio_with_user(active_all: true)
      @user.account_users.create!(account: Account.default, role: student_role)
      category = @portfolio.eportfolio_categories.create(name: "some name")
      put "/eportfolios/#{@portfolio.id}/categories/#{category.id}", params: { eportfolio_category: { name: "new name" } }
      expect(response).to redirect_to(login_url)
    end

    it "updates eportfolio category" do
      eportfolio_with_user(active_all: true)
      @user.account_users.create!(account: Account.default, role: student_role)
      category = @portfolio.eportfolio_categories.create(name: "some name")
      user_session(@user)
      put "/eportfolios/#{@portfolio.id}/categories/#{category.id}", params: { eportfolio_category: { name: "new name" } }
      expect(category.reload.name).to eq("new name")
    end
  end

  describe "DELETE 'destroy'" do
    it "requires authorization" do
      eportfolio_with_user(active_all: true)
      @user.account_users.create!(account: Account.default, role: student_role)
      category = @portfolio.eportfolio_categories.create(name: "some name")
      delete "/eportfolios/#{@portfolio.id}/categories/#{category.id}"
      expect(response).to redirect_to(login_url)
    end

    it "deletes eportfolio category" do
      eportfolio_with_user(active_all: true)
      @user.account_users.create!(account: Account.default, role: student_role)
      user_session(@user)
      category = @portfolio.eportfolio_categories.create(name: "some name")
      category_id = category.id
      delete "/eportfolios/#{@portfolio.id}/categories/#{category_id}"
      expect(EportfolioCategory.find_by(id: category_id)).to be_frozen
    end
  end

  describe "GET 'pages'" do
    it "requires authorization" do
      eportfolio_with_user(active_all: true)
      @user.account_users.create!(account: Account.default, role: student_role)
      category = @portfolio.eportfolio_categories.create(name: "some name")
      get "/eportfolios/#{@portfolio.id}/categories/#{category.id}/pages"
      expect(response).to redirect_to(login_url)
    end

    context "as an unauthenticated user" do
      it "returns the pages json when the eportfolio is public" do
        eportfolio_with_user(active_all: true)
        category = @portfolio.eportfolio_categories.create(name: "some name")
        entry = @portfolio.eportfolio_entries.new
        entry.eportfolio_category_id = category.id
        entry.save!
        @portfolio.update!(public: true)

        get "/eportfolios/#{@portfolio.id}/categories/#{category.id}/pages"

        expect(response).to have_http_status(:ok)
        expect(response.parsed_body.length).to be(1)
        expect(response.parsed_body.first["id"]).to eql(entry.id)
      end

      it "redirects to login when the eportfolio is private" do
        eportfolio_with_user(active_all: true)
        category = @portfolio.eportfolio_categories.create(name: "some name")
        get "/eportfolios/#{@portfolio.id}/categories/#{category.id}/pages"

        expect(response).to redirect_to(login_url)
      end
    end

    it "returns pages as json" do
      eportfolio_with_user(active_all: true)
      @user.account_users.create!(account: Account.default, role: student_role)
      category = @portfolio.eportfolio_categories.create(name: "some name")
      entry = @portfolio.eportfolio_entries.new
      entry.eportfolio_category_id = category.id
      entry.save!
      user_session(@user)
      get "/eportfolios/#{@portfolio.id}/categories/#{category.id}/pages"

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json.length).to be(1)
      expect(json[0]["id"]).to eql(entry.id)
    end
  end
end
