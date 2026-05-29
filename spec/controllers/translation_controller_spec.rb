# frozen_string_literal: true

# Copyright (C) 2024 - present Instructure, Inc.
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

describe TranslationController do
  let(:context) { instance_double(Course) }
  let(:params) do
    {
      text: "Hello world",
      src_lang: "en",
      tgt_lang: "es"
    }
  end

  before :once do
    @user = user_factory(active_all: true)
    @student = course_with_student(active_all: true).user
  end

  before do
    allow(InstStatsd::Statsd).to receive(:distributed_increment)
    allow(Account.site_admin).to receive(:feature_enabled?).and_return(false)
    allow_any_instance_of(Account).to receive(:feature_enabled?).and_return(true)
    user_session(@user)
  end

  describe "#translate" do
    before do
      allow(FeatureFlags::Hooks).to receive(:tier_1_visible_on_hook).and_return(true)
      @course.enable_feature!(:translation)
      allow(Translation).to receive_messages(available?: true, translate_html: "translated.")
      allow(controller).to receive(:user_can_read?).and_return(true)
    end

    context "when user is unauthorized" do
      it "renders unauthorized action" do
        allow(controller).to receive(:user_can_read?).and_return(false)
        post :translate, params: { course_id: @course.id, inputs: params }

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "feature is not enabled" do
      it "renders unauthorized action" do
        allow(Translation).to receive_messages(available?: false)
        post :translate, params: { course_id: @course.id, inputs: params }

        expect(response).to have_http_status(:unauthorized)
      end
    end

    it "responds with translated message" do
      post :translate, params: { course_id: @course.id, inputs: params }

      expect(response).to be_successful
      expect(response.parsed_body["translated_text"]).to eq("translated.")
    end
  end

  describe "#translate_paragraph" do
    before do
      allow(Translation).to receive_messages(available?: true, translate_text: "translated.")
    end

    context "feature is not enabled" do
      it "renders unauthorized action" do
        allow(Translation).to receive_messages(available?: false)
        post :translate_paragraph, params: { course_id: @course.id, inputs: params }

        expect(response).to have_http_status(:unauthorized)
      end
    end

    it "responds with translated message" do
      post :translate_paragraph, params: { course_id: @course.id, inputs: params }

      expect(response).to be_successful
      expect(response.parsed_body["translated_text"]).to eq("translated.")
    end
  end

  describe "#inbox_translation_feedback" do
    before do
      allow(Translation).to receive(:available?).and_return(true)
      # translation_feedback is a SiteAdmin-scoped flag, so it's checked on site admin
      allow(Account.site_admin).to receive(:feature_enabled?).with(:translation_feedback).and_return(true)
    end

    context "when inbox translation is not available" do
      it "renders unauthorized action" do
        allow(Translation).to receive(:available?).and_return(false)
        post :inbox_translation_feedback, params: { _action: "like", target_language: "es" }

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "when translation_feedback flag is disabled" do
      it "renders unauthorized action" do
        allow(Account.site_admin).to receive(:feature_enabled?).with(:translation_feedback).and_return(false)
        post :inbox_translation_feedback, params: { _action: "like", target_language: "es" }

        expect(response).to have_http_status(:unauthorized)
      end
    end

    it "returns bad request when target_language is missing" do
      post :inbox_translation_feedback, params: { _action: "like" }

      expect(response).to have_http_status(:bad_request)
    end

    it "returns bad request for an invalid action" do
      post :inbox_translation_feedback, params: { _action: "bogus", target_language: "es" }

      expect(response).to have_http_status(:bad_request)
    end

    it "creates a feedback row on like" do
      expect do
        post :inbox_translation_feedback, params: { _action: "like", target_language: "es" }
      end.to change { InboxTranslationFeedback.count }.by(1)

      expect(response).to be_successful
      expect(response.parsed_body["liked"]).to be true
      expect(response.parsed_body["disliked"]).to be false
      expect(response.parsed_body["id"]).to be_present
    end

    it "updates the same row when an id is provided" do
      post :inbox_translation_feedback, params: { _action: "like", target_language: "es" }
      id = response.parsed_body["id"]

      expect do
        post :inbox_translation_feedback, params: { _action: "reset_like", target_language: "es", id: }
      end.not_to change { InboxTranslationFeedback.count }

      expect(response.parsed_body["liked"]).to be false
      expect(response.parsed_body["disliked"]).to be false
    end

    it "persists notes on dislike" do
      post :inbox_translation_feedback, params: { _action: "dislike", target_language: "es", notes: "Awkward phrasing" }

      expect(response).to be_successful
      expect(response.parsed_body["disliked"]).to be true
      expect(InboxTranslationFeedback.last.feedback_notes).to eq("Awkward phrasing")
    end
  end

  describe "Exception Handling" do
    context "when Translation::SameLanguageTranslationError is raised" do
      before do
        error = Translation::SameLanguageTranslationError
        allow_any_instance_of(TranslationController).to receive(:translate).and_raise(error)
      end

      it "renders a same-language error response" do
        post :translate, params: { course_id: @course.id, inputs: params }

        expect(response).to have_http_status(:unprocessable_content)
        expect(response.parsed_body.deep_symbolize_keys).to eq({ translationError: { type: "error", message: "Translation is identical to source language." } })
      end
    end
  end
end
