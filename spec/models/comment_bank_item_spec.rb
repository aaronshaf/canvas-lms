# frozen_string_literal: true

#
# Copyright (C) 2021 - present Instructure, Inc.
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

describe CommentBankItem do
  let(:course) { course_model }
  let(:user) { user_model }
  let(:comment) { "comment" }
  let(:creation_params) { { course:, comment:, user: } }

  it_behaves_like "soft deletion" do
    subject { CommentBankItem }

    let(:creation_arguments) { [creation_params] }
  end

  describe "root_account_id" do
    subject { CommentBankItem.create!(comment: "A", course: @course, user:) }

    before do
      root_account = account_model
      @course = course_model(account: root_account)
    end

    it "sets root account from course" do
      expect(subject.root_account_id).to eq(@course.root_account_id)
    end
  end

  describe "permissions" do
    subject { CommentBankItem.create!(comment: "A", course:, user:) }

    describe "read/update/delete" do
      it "is allowed for the creator" do
        aggregate_failures do
          %i[read update delete].each do |permission|
            expect(subject.grants_right?(user, permission)).to be(true)
          end
        end
      end

      it "is not allowed for other users" do
        user2 = user_model
        %i[read update delete].each do |permission|
          expect(subject.grants_right?(user2, permission)).to be(false)
        end
      end
    end

    describe "create" do
      let(:user) { account_admin_user }

      it "requires manage_grades permissions" do
        expect(subject.grants_right?(user, :create)).to be(true)
        user = account_admin_user_with_role_changes(user:, role_changes: { manage_grades: false })
        expect(subject.grants_right?(user, :create)).to be(false)
      end
    end
  end

  describe "associations" do
    it "accepts a PeerReviewSubAssignment as assignment" do
      peer_review_sub_assignment = peer_review_model(course:)
      item = CommentBankItem.create!(course:, user:, comment:, assignment: peer_review_sub_assignment)
      expect(item.assignment).to eql(peer_review_sub_assignment)
    end
  end

  describe "comment (plain-text contract)" do
    def create_item(text)
      CommentBankItem.create!(course:, user:, comment: text)
    end

    # The Comment Library compose UI is a plain InstUI <TextArea>; the
    # field stores plain text. Persistence is verbatim. HTML escape is
    # the render layer's job (React auto-escape in the tray; htmlEscape
    # per line in the RCE-Lite insertion path).

    it "stores plain text verbatim" do
      item = create_item("just a comment")
      expect(item.reload.comment).to eq "just a comment"
    end

    it "preserves bare ampersand verbatim" do
      item = create_item("Hello & welcome")
      expect(item.reload.comment).to eq "Hello & welcome"
    end

    it "preserves NBSP verbatim" do
      nbsp_text = "Hello world"
      item = create_item(nbsp_text)
      expect(item.reload.comment).to eq nbsp_text
    end

    it "preserves angle brackets in math-style text" do
      item = create_item("5 < 10 and 20 > 5")
      expect(item.reload.comment).to eq "5 < 10 and 20 > 5"
    end

    it "preserves angle-bracketed placeholder tokens like <your student id>" do
      item = create_item("Your answer is <your student id> followed by <your initials>")
      expect(item.reload.comment).to eq "Your answer is <your student id> followed by <your initials>"
    end

    it "stores HTML-shaped input verbatim (the model is not the XSS perimeter)" do
      # Rendering layers (React <Text>{comment}> auto-escape, RCE-Lite
      # insertion via pureTextCommentToRCEComment's htmlEscape) handle
      # safe display. The model just stores the bytes it received.
      item = create_item("<script>alert(1)</script>safe")
      expect(item.reload.comment).to eq "<script>alert(1)</script>safe"
    end

    it "stores event-handler attribute strings verbatim" do
      item = create_item('<a href="#" onclick="alert(1)">click me</a>')
      expect(item.reload.comment).to eq '<a href="#" onclick="alert(1)">click me</a>'
    end

    describe "render-side defense (the actual XSS contract)" do
      # Verify the helper that bridges plain-text comments into the
      # RCE-Lite editor html-escapes correctly. This is the closest
      # thing to an HTML sink in the Comment Library flow.

      it "format_message escapes <script> tags to inert text" do
        helper = Class.new { include HtmlTextHelper }.new
        rendered = helper.format_message("<script>alert(1)</script>safe").first
        expect(rendered).to include("&lt;script&gt;")
        expect(rendered).not_to include("<script>")
      end

      it "format_message single-escapes ampersand (no double-encoding)" do
        helper = Class.new { include HtmlTextHelper }.new
        rendered = helper.format_message("Hello & welcome").first
        expect(rendered).to eq "Hello &amp; welcome"
      end

      it "format_message preserves NBSP" do
        helper = Class.new { include HtmlTextHelper }.new
        nbsp_text = "Hello world"
        rendered = helper.format_message(nbsp_text).first
        expect(rendered).to eq nbsp_text
      end
    end
  end
end
