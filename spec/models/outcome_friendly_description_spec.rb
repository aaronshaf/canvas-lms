# frozen_string_literal: true

#
# Copyright (C) 2020 - present Instructure, Inc.
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

describe OutcomeFriendlyDescription do
  let_once(:account) { account_model }
  let_once(:outcome) { outcome_model }
  let(:description) { "description" }
  let(:creation_params) { { context: account, description:, learning_outcome: outcome } }

  it_behaves_like "soft deletion" do
    subject { OutcomeFriendlyDescription }

    let(:creation_arguments) { [creation_params, creation_params.merge(context: course_model)] }
  end

  describe "sanitization" do
    it "strips script tags from description on save" do
      desc = OutcomeFriendlyDescription.create!(creation_params.merge(description: "<script>alert('xss')</script>safe"))
      expect(desc.description).not_to include("<script>")
      expect(desc.description).to include("safe")
    end

    it "strips onerror attributes from description on save" do
      desc = OutcomeFriendlyDescription.create!(creation_params.merge(description: '<img src="x" onerror="alert(1)">'))
      expect(desc.description).not_to include("onerror")
    end

    it "strips javascript: hrefs from description on save" do
      desc = OutcomeFriendlyDescription.create!(creation_params.merge(description: '<a href="javascript:alert(1)">click</a>'))
      expect(desc.description).not_to include("javascript:")
    end

    it "preserves safe HTML in description on save" do
      desc = OutcomeFriendlyDescription.create!(creation_params.merge(description: "<p>Hello <strong>world</strong></p>"))
      expect(desc.description).to include("<strong>world</strong>")
    end

    it "also sanitizes on update" do
      desc = OutcomeFriendlyDescription.create!(creation_params)
      desc.update!(description: '<img onerror="xss()" src="x">')
      expect(desc.reload.description).not_to include("onerror")
    end
  end

  describe "root_account_id" do
    subject { OutcomeFriendlyDescription.create!(description: "A", context: @context, learning_outcome: outcome_model) }

    before do
      @root_account = account_model
    end

    context "sets root account from course context" do
      before do
        @context = course_model(account: @root_account)
      end

      it { expect(subject.root_account_id).to eq(@context.root_account_id) }
    end

    context "sets root account from account context" do
      before do
        @context = account_model(parent_account: @root_account)
      end

      it { expect(subject.root_account_id).to eq(@context.root_account_id) }
    end
  end
end
