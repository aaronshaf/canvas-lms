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

describe StudyAssist::Service do
  before :once do
    course_with_student(active_all: true)
    @course.enable_feature!(:study_assist)
  end

  let(:page) { @course.wiki_pages.create!(title: "Hello", body: "<p>Hello <b>world</b></p>") }
  let(:page_state) { { "pageID" => page.url } }

  def stub_cedar(response_text)
    CedarClient.prompt_results = [Struct.new(:response, :response_id).new(response_text, "r1")]
  end

  def call_service(prompt: "Summarize", state: page_state, regenerate: false)
    described_class.call(
      course: @course,
      user: @student,
      prompt:,
      state:,
      locale: "en",
      regenerate:
    )
  end

  before do
    Rails.cache.clear
    stub_const("CedarClient", Class.new do
      class << self
        attr_accessor :prompt_results
      end
      self.prompt_results = []

      def self.prompt(*)
        value = (prompt_results.size > 1) ? prompt_results.shift : prompt_results.first
        raise value if value.is_a?(Exception)

        value
      end

      def self.enabled?
        true
      end
    end)
    stub_cedar("A summary")
  end

  describe ".tool_key_for" do
    it "returns :chips for blank prompt" do
      expect(described_class.tool_key_for("")).to eq(:chips)
    end

    it "matches summarize variants" do
      expect(described_class.tool_key_for("Summarize")).to eq(:summarize)
      expect(described_class.tool_key_for("summarize this")).to eq(:summarize)
    end

    it "matches quiz chip and regenerate prompts" do
      expect(described_class.tool_key_for("Quiz me")).to eq(:quiz)
      expect(described_class.tool_key_for("Generate quiz")).to eq(:quiz)
    end

    it "matches flashcards chip and regenerate prompts" do
      expect(described_class.tool_key_for("Flashcards")).to eq(:flashcards)
      expect(described_class.tool_key_for("Flash cards")).to eq(:flashcards)
      expect(described_class.tool_key_for("Generate flashcards")).to eq(:flashcards)
    end

    it "returns :unknown for unmatched prompts" do
      expect(described_class.tool_key_for("hello there")).to eq(:unknown)
    end
  end

  describe "prompt dispatch" do
    it "returns chips when prompt is blank" do
      result = call_service(prompt: "", state: {})
      expect(result[:chips]).to be_an(Array)
    end

    it "raises InvalidPrompt for unsupported prompts" do
      expect { call_service(prompt: "hello there") }.to raise_error(StudyAssist::InvalidPrompt)
    end
  end

  describe "chips" do
    it "returns all chips when all per-tool flags are enabled" do
      result = call_service(prompt: "", state: {})
      expect(result[:chips].pluck(:chip)).to eq(["Summarize", "Quiz me", "Flashcards"])
    end

    it "includes the tool kind on each chip" do
      result = call_service(prompt: "", state: {})
      expect(result[:chips].pluck(:kind)).to eq(%w[summarize quiz flashcards])
    end

    it "omits a chip when its per-tool flag is disabled" do
      @course.disable_feature!(:study_assist_quiz_me)
      result = call_service(prompt: "", state: {})
      expect(result[:chips].pluck(:chip)).to eq(["Summarize", "Flashcards"])
    end

    it "returns an empty list when all tool flags are disabled" do
      @course.disable_feature!(:study_assist_summarize)
      @course.disable_feature!(:study_assist_quiz_me)
      @course.disable_feature!(:study_assist_flashcards)
      result = call_service(prompt: "", state: {})
      expect(result[:chips]).to eq([])
    end

    it "localizes the chip display while keeping the prompt in English for routing" do
      allow(I18n).to receive(:t).and_call_original
      allow(I18n).to receive(:t).with("study_assist.chips.summarize", default: "Summarize").and_return("Resumir")
      allow(I18n).to receive(:t).with("study_assist.chips.quiz_me", default: "Quiz me").and_return("Examinarme")
      allow(I18n).to receive(:t).with("study_assist.chips.flashcards", default: "Flashcards").and_return("Tarjetas")

      result = call_service(prompt: "", state: {})

      expect(result[:chips]).to eq([
                                     { chip: "Resumir", prompt: "Summarize", kind: "summarize" },
                                     { chip: "Examinarme", prompt: "Quiz me", kind: "quiz" },
                                     { chip: "Tarjetas", prompt: "Flashcards", kind: "flashcards" }
                                   ])
    end
  end

  describe "summarize" do
    it "returns the raw summary text" do
      expect(call_service(prompt: "Summarize")).to eq({ response: "A summary" })
    end

    it "sends the page prompt for page content" do
      expect(CedarClient).to receive(:prompt).with(hash_including(prompt: a_string_starting_with("Summarize this page."))).and_call_original
      call_service(prompt: "Summarize")
    end

    it "sends the file prompt for file content" do
      attachment = attachment_model(
        context: @course,
        content_type: "text/plain",
        uploaded_data: stub_file_data("notes.txt", "file material", "text/plain")
      )
      expect(CedarClient).to receive(:prompt).with(hash_including(prompt: a_string_starting_with("Summarize this file."))).and_call_original
      call_service(prompt: "Summarize", state: { "fileID" => attachment.id.to_s })
    end

    it "appends a no-preamble instruction to the prompt" do
      expect(CedarClient).to receive(:prompt).with(hash_including(prompt: a_string_including("Start directly"))).and_call_original
      call_service(prompt: "Summarize")
    end

    it "substitutes the locale into the prompt" do
      expect(CedarClient).to receive(:prompt).with(
        hash_including(prompt: a_string_matching(%r{<locale>English[^<]*</locale>}))
      ).and_call_original
      call_service(prompt: "Summarize")
    end

    it "falls back to English when the locale is not recognized" do
      expect(CedarClient).to receive(:prompt).with(
        hash_including(prompt: a_string_including("<locale>English</locale>"))
      ).and_call_original
      described_class.call(course: @course, user: @student, prompt: "Summarize", state: page_state, locale: "xx-not-a-locale")
    end

    it "returns the response text verbatim (stripping only whitespace)" do
      stub_cedar("  The actual summary begins here.  ")
      expect(call_service(prompt: "Summarize")[:response]).to eq("The actual summary begins here.")
    end

    it "passes content as a Cedar txt document" do
      expect(CedarClient).to receive(:prompt).with(
        hash_including(document: hash_including(format: "txt"))
      ).and_call_original
      call_service(prompt: "Summarize")
    end

    it "raises ToolDisabled when the per-tool feature flag is off" do
      @course.disable_feature!(:study_assist_summarize)
      expect { call_service(prompt: "Summarize") }.to raise_error(StudyAssist::ToolDisabled)
    end

    it "raises ToolDisabled when the master study_assist flag is off" do
      @course.disable_feature!(:study_assist)
      expect { call_service(prompt: "Summarize") }.to raise_error(StudyAssist::ToolDisabled)
    end

    it "raises CedarUnavailable when Cedar returns a blank response" do
      stub_cedar("   ")
      expect { call_service(prompt: "Summarize") }.to raise_error(StudyAssist::CedarUnavailable)
    end

    it "raises RateLimited when Cedar signals rate limit" do
      CedarClient.prompt_results = [
        InstructureMiscPlugin::Extensions::CedarClient::CedarLimitReachedError.new("limit")
      ]
      expect { call_service(prompt: "Summarize") }.to raise_error(StudyAssist::RateLimited)
    end
  end

  describe "quiz" do
    let(:quiz_payload) { [{ question: "Q1", options: %w[a b c d], result: 2 }].to_json }

    before { stub_cedar(quiz_payload) }

    it "returns parsed quiz items mapping Journey shape to Canvas shape" do
      result = call_service(prompt: "Quiz me")
      item = result[:quizItems].first
      expect(item[:question]).to eq("Q1")
      expect(item[:answers]).to match_array(%w[a b c d])
      expect(item[:answers][item[:correctAnswerIndex]]).to eq("c")
    end

    it "raises ToolDisabled when the per-tool flag is off" do
      @course.disable_feature!(:study_assist_quiz_me)
      expect { call_service(prompt: "Quiz me") }.to raise_error(StudyAssist::ToolDisabled)
    end

    it "handles the 'Generate quiz' regenerate prompt" do
      result = call_service(prompt: "Generate quiz")
      expect(result[:quizItems]).to be_an(Array)
    end

    it "substitutes the locale into the prompt" do
      expect(CedarClient).to receive(:prompt).with(
        hash_including(prompt: a_string_matching(%r{<locale>English[^<]*</locale>}))
      ).and_call_original
      call_service(prompt: "Quiz me")
    end

    it "raises CedarUnavailable when a quiz item is malformed" do
      stub_cedar([{ question: "Q", options: [] }].to_json)
      expect { call_service(prompt: "Quiz me") }.to raise_error(StudyAssist::CedarUnavailable)
    end

    it "extracts the JSON array even when surrounded by prose" do
      wrapped = "Here you go: #{[{ question: "Q1", options: %w[a b c d], result: 0 }].to_json} hope that helps!"
      stub_cedar(wrapped)
      item = call_service(prompt: "Quiz me")[:quizItems].first
      expect(item[:answers][item[:correctAnswerIndex]]).to eq("a")
    end

    it "limits to 10 quiz items even if Cedar returns more" do
      many = Array.new(20) { |i| { question: "Q#{i}", options: %w[a b c d], result: 0 } }
      stub_cedar(many.to_json)
      expect(call_service(prompt: "Quiz me")[:quizItems].size).to eq(10)
    end

    it "shuffles clustered correct answers while keeping the text aligned" do
      items = Array.new(10) { |i| { question: "Q#{i}", options: %w[correct wrong1 wrong2 wrong3], result: 0 } }
      stub_cedar(items.to_json)
      srand(12_345)

      quiz_items = call_service(prompt: "Quiz me")[:quizItems]

      expect(quiz_items.pluck(:correctAnswerIndex).uniq.size).to be > 1
      quiz_items.each do |item|
        expect(item[:answers]).to match_array(%w[correct wrong1 wrong2 wrong3])
        expect(item[:answers][item[:correctAnswerIndex]]).to eq("correct")
      end
    ensure
      srand
    end

    it "raises CedarUnavailable when result is out of range" do
      stub_cedar([{ question: "Q", options: %w[a b c d], result: 9 }].to_json)
      expect { call_service(prompt: "Quiz me") }.to raise_error(StudyAssist::CedarUnavailable)
    end
  end

  describe "flashcards" do
    let(:flashcards_payload) { [{ question: "Q", answer: "A" }].to_json }

    before { stub_cedar(flashcards_payload) }

    it "returns parsed flashcards" do
      expect(call_service(prompt: "Flashcards")[:flashCards]).to eq([{ question: "Q", answer: "A" }])
    end

    it "raises ToolDisabled when the per-tool flag is off" do
      @course.disable_feature!(:study_assist_flashcards)
      expect { call_service(prompt: "Flashcards") }.to raise_error(StudyAssist::ToolDisabled)
    end

    it "handles the 'Generate flashcards' regenerate prompt" do
      result = call_service(prompt: "Generate flashcards")
      expect(result[:flashCards]).to be_an(Array)
    end

    it "substitutes the locale into the prompt" do
      expect(CedarClient).to receive(:prompt).with(
        hash_including(prompt: a_string_matching(%r{<locale>English[^<]*</locale>}))
      ).and_call_original
      call_service(prompt: "Flashcards")
    end

    it "raises CedarUnavailable when flashcards payload is empty" do
      stub_cedar("[]")
      expect { call_service(prompt: "Flashcards") }.to raise_error(StudyAssist::CedarUnavailable)
    end

    it "limits to 10 flashcards even if Cedar returns more" do
      many = Array.new(30) { |i| { question: "Q#{i}", answer: "A#{i}" } }
      stub_cedar(many.to_json)
      expect(call_service(prompt: "Flashcards")[:flashCards].size).to eq(10)
    end
  end

  describe "content resolution" do
    it "strips HTML from page bodies" do
      # Bust any cached page summarization that might return "A summary"
      call_service(prompt: "Summarize") # baseline call to populate cache
      expect(CedarClient).to receive(:prompt).with(
        hash_including(document: hash_including(base64Source: Base64.strict_encode64("Hello world")))
      ).and_call_original
      Rails.cache.clear
      call_service(prompt: "Summarize")
    end

    it "raises ContentUnavailable when the page is missing" do
      expect do
        call_service(prompt: "Summarize", state: { "pageID" => "no-such-page" })
      end.to raise_error(StudyAssist::ContentUnavailable)
    end

    it "raises ContentUnavailable when the student cannot read the page" do
      unpublished = @course.wiki_pages.create!(title: "Hidden", body: "secret", workflow_state: "unpublished")
      expect do
        call_service(prompt: "Summarize", state: { "pageID" => unpublished.url })
      end.to raise_error(StudyAssist::ContentUnavailable, /access denied/)
    end

    it "raises ContentUnavailable when no pageID or fileID is provided" do
      expect do
        call_service(prompt: "Summarize", state: {})
      end.to raise_error(StudyAssist::ContentUnavailable)
    end

    it "raises UnsupportedContentType for image attachments" do
      attachment = attachment_model(context: @course, content_type: "image/png", filename: "x.png")
      expect do
        call_service(prompt: "Summarize", state: { "fileID" => attachment.id.to_s })
      end.to raise_error(StudyAssist::UnsupportedContentType)
    end

    it "returns text for a plain text attachment" do
      attachment = attachment_model(
        context: @course,
        content_type: "text/plain",
        uploaded_data: stub_file_data("notes.txt", "lorem ipsum", "text/plain")
      )
      expect(CedarClient).to receive(:prompt).with(
        hash_including(document: hash_including(base64Source: Base64.strict_encode64("lorem ipsum")))
      ).and_call_original
      call_service(prompt: "Summarize", state: { "fileID" => attachment.id.to_s })
    end

    it "clamps oversized page content to MAX_CONTENT_CHARS instead of raising" do
      huge_page = @course.wiki_pages.create!(title: "Huge", body: "x" * (described_class::MAX_CONTENT_CHARS + 1_000))
      content = nil
      allow(CedarClient).to receive(:prompt) do |args|
        content = Base64.strict_decode64(args[:document][:base64Source])
        Struct.new(:response, :response_id).new("A summary", "r1")
      end
      call_service(prompt: "Summarize", state: { "pageID" => huge_page.url })
      expect(content.length).to be <= described_class::MAX_CONTENT_CHARS
    end

    it "raises ContentTooLarge when a file directly exceeds the cap" do
      huge_attachment = attachment_model(
        context: @course,
        content_type: "text/plain",
        uploaded_data: stub_file_data("huge.txt", "x" * (described_class::MAX_CONTENT_CHARS + 1), "text/plain")
      )
      expect do
        call_service(prompt: "Summarize", state: { "fileID" => huge_attachment.id.to_s })
      end.to raise_error(StudyAssist::ContentTooLarge)
    end

    it "raises ContentUnavailable when the student cannot read the file" do
      attachment = attachment_model(
        context: @course,
        content_type: "text/plain",
        uploaded_data: stub_file_data("notes.txt", "content", "text/plain")
      )
      allow_any_instance_of(Attachment).to receive(:grants_right?).with(@student, :read).and_return(false)
      expect do
        call_service(prompt: "Summarize", state: { "fileID" => attachment.id.to_s })
      end.to raise_error(StudyAssist::ContentUnavailable, /access denied/)
    end

    it "raises ContentUnavailable when the file is locked for the student" do
      attachment = attachment_model(
        context: @course,
        content_type: "text/plain",
        uploaded_data: stub_file_data("notes.txt", "content", "text/plain")
      )
      allow_any_instance_of(Attachment).to receive(:locked_for?)
        .with(@student, check_policies: true)
        .and_return({ lock_type: "date_lock" })
      expect do
        call_service(prompt: "Summarize", state: { "fileID" => attachment.id.to_s })
      end.to raise_error(StudyAssist::ContentUnavailable, /locked/)
    end

    it "rejects fileIDs belonging to a different course" do
      original_course = @course
      other_course = course_model(name: "Other Course")
      other_attachment = attachment_model(
        context: other_course,
        content_type: "text/plain",
        uploaded_data: stub_file_data("other.txt", "cross-course content", "text/plain")
      )
      @course = original_course
      expect do
        call_service(prompt: "Summarize", state: { "fileID" => other_attachment.id.to_s })
      end.to raise_error(StudyAssist::ContentUnavailable)
    end

    describe "embedded file content in pages" do
      let(:file_attachment) do
        attachment_model(
          context: @course,
          content_type: "text/plain",
          uploaded_data: stub_file_data("doc.txt", "The Iliad content goes here", "text/plain")
        )
      end

      def captured_cedar_content(&)
        content = nil
        allow(CedarClient).to receive(:prompt) do |args|
          content = Base64.strict_decode64(args[:document][:base64Source])
          Struct.new(:response, :response_id).new("A summary", "r1")
        end
        yield
        content
      end

      it "appends embedded file text to page content" do
        p = @course.wiki_pages.create!(
          title: "Page with PDF",
          body: "<a class=\"instructure_file_link instructure_scribd_file\" href=\"/courses/#{@course.id}/files/#{file_attachment.id}?wrap=1\">doc.txt</a>",
          saving_user: @student
        )
        content = captured_cedar_content { call_service(prompt: "Summarize", state: { "pageID" => p.url }) }
        expect(content).to include("The Iliad content goes here")
      end

      it "appends embedded file text from iframe embeds" do
        p = @course.wiki_pages.create!(
          title: "Page with iframe",
          body: "<iframe src=\"/courses/#{@course.id}/files/#{file_attachment.id}?wrap=1\"></iframe>",
          saving_user: @student
        )
        content = captured_cedar_content { call_service(prompt: "Summarize", state: { "pageID" => p.url }) }
        expect(content).to include("The Iliad content goes here")
      end

      it "skips embedded files the student cannot read" do
        p = @course.wiki_pages.create!(
          title: "Page with unreadable file",
          body: "<p>Page text.</p><a class=\"instructure_file_link\" href=\"/courses/#{@course.id}/files/#{file_attachment.id}?wrap=1\">doc.txt</a>",
          saving_user: @student
        )
        allow_any_instance_of(Attachment).to receive(:grants_right?).with(@student, :download).and_return(false)
        content = captured_cedar_content { call_service(prompt: "Summarize", state: { "pageID" => p.url }) }
        expect(content).not_to include("The Iliad content goes here")
      end

      it "skips embedded files that are locked for the student" do
        p = @course.wiki_pages.create!(
          title: "Page with locked file",
          body: "<p>Page text.</p><a class=\"instructure_file_link\" href=\"/courses/#{@course.id}/files/#{file_attachment.id}?wrap=1\">doc.txt</a>",
          saving_user: @student
        )
        allow_any_instance_of(Attachment).to receive(:locked_for?).and_return({ lock_type: "module_lock" })
        content = captured_cedar_content { call_service(prompt: "Summarize", state: { "pageID" => p.url }) }
        expect(content).not_to include("The Iliad content goes here")
      end

      it "preserves non-Canvas anchor text in page text" do
        p = @course.wiki_pages.create!(
          title: "Page with external link",
          body: '<p>See <a href="https://example.com">this article</a>.</p>',
          saving_user: @student
        )
        content = captured_cedar_content { call_service(prompt: "Summarize", state: { "pageID" => p.url }) }
        expect(content).to include("this article")
      end

      it "includes each embedded file's text exactly once when linked multiple times" do
        body = "<a class=\"instructure_file_link\" href=\"/courses/#{@course.id}/files/#{file_attachment.id}?wrap=1\">link1</a>" \
               "<a class=\"instructure_file_link\" href=\"/courses/#{@course.id}/files/#{file_attachment.id}?wrap=1\">link2</a>"
        p = @course.wiki_pages.create!(title: "Duplicate links page", body:, saving_user: @student)
        content = captured_cedar_content { call_service(prompt: "Summarize", state: { "pageID" => p.url }) }
        expect(content.scan("The Iliad content goes here").size).to eq(1)
      end

      it "strips canvas file link metadata from page text so skipped files leave no noise" do
        image = attachment_model(context: @course, content_type: "image/png", filename: "img.png")
        p = @course.wiki_pages.create!(
          title: "Page with skipped file",
          body: "<p>Some context.</p><a class=\"instructure_file_link\" href=\"/courses/#{@course.id}/files/#{image.id}?wrap=1\">img.png</a>",
          saving_user: @student
        )
        content = captured_cedar_content { call_service(prompt: "Summarize", state: { "pageID" => p.url }) }
        expect(content).to include("Some context")
        expect(content).not_to include("/courses/#{@course.id}/files/#{image.id}")
        expect(content).not_to include("img.png")
      end

      it "skips embedded files of unsupported types without raising" do
        image = attachment_model(context: @course, content_type: "image/png", filename: "img.png")
        p = @course.wiki_pages.create!(
          title: "Page with image link",
          body: "<p>Some context.</p><a class=\"instructure_file_link\" href=\"/courses/#{@course.id}/files/#{image.id}?wrap=1\">img.png</a>",
          saving_user: @student
        )
        expect { call_service(prompt: "Summarize", state: { "pageID" => p.url }) }.not_to raise_error
      end

      it "raises ContentUnavailable when all embedded files are skipped and the page has no other text" do
        image = attachment_model(context: @course, content_type: "image/png", filename: "img.png")
        p = @course.wiki_pages.create!(
          title: "Image only page",
          body: "<a class=\"instructure_file_link\" href=\"/courses/#{@course.id}/files/#{image.id}?wrap=1\">img.png</a>",
          saving_user: @student
        )
        expect do
          call_service(prompt: "Summarize", state: { "pageID" => p.url })
        end.to raise_error(StudyAssist::ContentUnavailable, /No readable content/)
      end

      it "raises ContentUnavailable when the only embedded file is locked and the page has no other text" do
        allow_any_instance_of(Attachment).to receive(:locked_for?).and_return({ lock_type: "date_lock" })
        p = @course.wiki_pages.create!(
          title: "Locked-only page",
          body: "<a class=\"instructure_file_link\" href=\"/courses/#{@course.id}/files/#{file_attachment.id}?wrap=1\">doc.txt</a>",
          saving_user: @student
        )
        expect do
          call_service(prompt: "Summarize", state: { "pageID" => p.url })
        end.to raise_error(StudyAssist::ContentUnavailable, /No readable content/)
      end

      it "skips an embedded file without raising when grants_right? raises unexpectedly" do
        p = @course.wiki_pages.create!(
          title: "DB error page",
          body: "<p>Good text.</p><a class=\"instructure_file_link\" href=\"/courses/#{@course.id}/files/#{file_attachment.id}?wrap=1\">doc.txt</a>",
          saving_user: @student
        )
        allow_any_instance_of(Attachment).to receive(:grants_right?).with(@student, :download).and_raise(ActiveRecord::StatementInvalid, "DB error")
        content = captured_cedar_content { call_service(prompt: "Summarize", state: { "pageID" => p.url }) }
        expect(content).not_to include("The Iliad content goes here")
        expect(content).to include("Good text")
      end

      it "includes text from a cross-shard embedded file when the shard resolves" do
        allow(Shard).to receive(:lookup).and_call_original
        allow(Shard).to receive(:lookup).with(99).and_return(Shard.current)
        p = @course.wiki_pages.create!(
          title: "Cross-shard page",
          body: "<a class=\"instructure_file_link\" href=\"/courses/#{@course.id}/files/99~#{file_attachment.id}?wrap=1\">doc.txt</a>",
          saving_user: @student
        )
        content = captured_cedar_content { call_service(prompt: "Summarize", state: { "pageID" => p.url }) }
        expect(content).to include("The Iliad content goes here")
      end

      it "skips a cross-shard embedded file when the shard database is unreachable" do
        p = @course.wiki_pages.create!(
          title: "Dead shard page",
          body: "<p>Page text.</p><a class=\"instructure_file_link\" href=\"/courses/#{@course.id}/files/99~999999?wrap=1\">doc.txt</a>",
          saving_user: @student
        )
        dead_shard = instance_double(Shard, id: 99)
        allow(dead_shard).to receive(:==).and_return(false)
        allow(dead_shard).to receive(:activate).and_raise(Switchman::Errors::NonExistentShardError)
        allow(Shard).to receive(:lookup).and_call_original
        allow(Shard).to receive(:lookup).with(99).and_return(dead_shard)
        expect { call_service(prompt: "Summarize", state: { "pageID" => p.url }) }.not_to raise_error
      end

      it "skips a cross-shard embedded file when the shard cannot be resolved" do
        allow(Shard).to receive(:lookup).and_call_original
        allow(Shard).to receive(:lookup).with(99).and_return(nil)
        p = @course.wiki_pages.create!(
          title: "Unknown shard page",
          body: "<p>Page text.</p><a class=\"instructure_file_link\" href=\"/courses/#{@course.id}/files/99~999999?wrap=1\">doc.txt</a>",
          saving_user: @student
        )
        expect { call_service(prompt: "Summarize", state: { "pageID" => p.url }) }.not_to raise_error
      end

      it "excludes cross-shard file content when the student lacks read access" do
        original_course = @course
        foreign_attachment = attachment_model(
          context: course_model,
          content_type: "text/plain",
          uploaded_data: stub_file_data("foreign.txt", "foreign secret", "text/plain")
        )
        @course = original_course
        p = @course.wiki_pages.create!(
          title: "Cross-shard foreign-course page",
          body: "<p>Page text.</p><a class=\"instructure_file_link\" href=\"/courses/#{@course.id}/files/99~#{foreign_attachment.id}?wrap=1\">foreign.txt</a>",
          saving_user: @student
        )
        mock_shard = instance_double(Shard, id: 99)
        allow(mock_shard).to receive(:==).and_return(false)
        allow(mock_shard).to receive(:activate).and_yield
        allow(Shard).to receive(:lookup).and_call_original
        allow(Shard).to receive(:lookup).with(99).and_return(mock_shard)
        allow_any_instance_of(Attachment).to receive(:grants_right?).with(@student, :download).and_return(false)
        content = captured_cedar_content { call_service(prompt: "Summarize", state: { "pageID" => p.url }) }
        expect(content).not_to include("foreign secret")
      end

      context "cross-shard ownership checks" do
        specs_require_sharding

        it "excludes cross-shard embedded files whose course context does not match" do
          other_att = @shard1.activate do
            other_account = Account.create!(name: "Shard1 account")
            other_course = other_account.courses.create!
            attachment_model(
              context: other_course,
              content_type: "text/plain",
              uploaded_data: stub_file_data("secret.txt", "cross-shard secret", "text/plain")
            )
          end
          allow_any_instance_of(Attachment).to receive(:grants_right?).with(@student, :download).and_return(true)
          allow_any_instance_of(Attachment).to receive(:locked_for?).with(@student, check_policies: true).and_return(false)
          p = @course.wiki_pages.create!(
            title: "Cross-shard course-mismatch page",
            body: "<p>Page text.</p><a class=\"instructure_file_link\" href=\"/courses/#{@course.id}/files/#{@shard1.id}~#{other_att.id}?wrap=1\">secret.txt</a>",
            saving_user: @student
          )
          content = captured_cedar_content { call_service(prompt: "Summarize", state: { "pageID" => p.url }) }
          expect(content).not_to include("cross-shard secret")
        end

        it "skips cross-shard embedded files whose context_type is not Course" do
          user_att = @shard1.activate do
            attachment_model(
              context: user_model,
              content_type: "text/plain",
              uploaded_data: stub_file_data("user-file.txt", "user secret", "text/plain")
            )
          end
          allow_any_instance_of(Attachment).to receive(:grants_right?).with(@student, :download).and_return(true)
          allow_any_instance_of(Attachment).to receive(:locked_for?).with(@student, check_policies: true).and_return(false)
          p = @course.wiki_pages.create!(
            title: "User-file cross-shard page",
            body: "<p>Page text.</p><a class=\"instructure_file_link\" href=\"/courses/#{@course.id}/files/#{@shard1.id}~#{user_att.id}?wrap=1\">user-file.txt</a>",
            saving_user: @student
          )
          content = captured_cedar_content { call_service(prompt: "Summarize", state: { "pageID" => p.url }) }
          expect(content).not_to include("user secret")
        end
      end

      it "does not include content from embedded files belonging to another course" do
        original_course = @course
        other_course = course_model
        other_attachment = attachment_model(
          context: other_course,
          content_type: "text/plain",
          uploaded_data: stub_file_data("secret.txt", "secret content", "text/plain")
        )
        @course = original_course
        p = @course.wiki_pages.create!(
          title: "Cross-course page",
          body: "<p>Page text.</p><a href=\"/courses/#{other_course.id}/files/#{other_attachment.id}?wrap=1\">secret.txt</a>",
          saving_user: @student
        )
        content = captured_cedar_content { call_service(prompt: "Summarize", state: { "pageID" => p.url }) }
        expect(content).not_to include("secret content")
      end

      it "ignores module progressions from other courses when checking embedded file locks" do
        original_course = @course
        other_course = course_model
        @course = original_course
        mod = other_course.context_modules.create!(name: "Locked Module")
        mod.content_tags.create!(content: file_attachment, context: other_course, content_type: "Attachment")
        ContextModuleProgression.create!(context_module: mod, user: @student, workflow_state: "locked")

        p = @course.wiki_pages.create!(
          title: "Cross-course progression page",
          body: "<a class=\"instructure_file_link\" href=\"/courses/#{@course.id}/files/#{file_attachment.id}?wrap=1\">doc.txt</a>",
          saving_user: @student
        )
        content = captured_cedar_content { call_service(prompt: "Summarize", state: { "pageID" => p.url }) }
        expect(content).to include("The Iliad content goes here")
      end

      it "includes text from all embedded files" do
        second_attachment = attachment_model(
          context: @course,
          content_type: "text/plain",
          uploaded_data: stub_file_data("doc2.txt", "Second file content", "text/plain")
        )
        p = @course.wiki_pages.create!(
          title: "Page with two files",
          body: "<a class=\"instructure_file_link\" href=\"/courses/#{@course.id}/files/#{file_attachment.id}?wrap=1\">doc.txt</a>" \
                "<a class=\"instructure_file_link\" href=\"/courses/#{@course.id}/files/#{second_attachment.id}?wrap=1\">doc2.txt</a>",
          saving_user: @student
        )
        content = captured_cedar_content { call_service(prompt: "Summarize", state: { "pageID" => p.url }) }
        expect(content).to include("The Iliad content goes here")
        expect(content).to include("Second file content")
      end

      it "skips a file that raises during extraction and still includes subsequent files" do
        bad_file = attachment_model(
          context: @course,
          content_type: "text/plain",
          uploaded_data: stub_file_data("bad.txt", "bad content", "text/plain")
        )
        allow_any_instance_of(described_class).to receive(:extract_attachment_text).and_wrap_original do |m, att|
          raise Attachment::FailedResponse, "simulated extraction error" if att.id == bad_file.id

          m.call(att)
        end
        p = @course.wiki_pages.create!(
          title: "Page with bad then good file",
          body: "<a class=\"instructure_file_link\" href=\"/courses/#{@course.id}/files/#{bad_file.id}?wrap=1\">bad.txt</a>" \
                "<a class=\"instructure_file_link\" href=\"/courses/#{@course.id}/files/#{file_attachment.id}?wrap=1\">doc.txt</a>",
          saving_user: @student
        )
        content = captured_cedar_content { call_service(prompt: "Summarize", state: { "pageID" => p.url }) }
        expect(content).not_to include("bad content")
        expect(content).to include("The Iliad content goes here")
      end

      it "propagates StudyAssist::Error raised during embedded file extraction" do
        p = @course.wiki_pages.create!(
          title: "Rate limited page",
          body: "<a class=\"instructure_file_link\" href=\"/courses/#{@course.id}/files/#{file_attachment.id}?wrap=1\">doc.txt</a>",
          saving_user: @student
        )
        allow_any_instance_of(described_class).to receive(:extract_attachment_text)
          .and_raise(StudyAssist::RateLimited, "rate limit hit")
        expect do
          call_service(prompt: "Summarize", state: { "pageID" => p.url })
        end.to raise_error(StudyAssist::RateLimited, /rate limit hit/)
      end

      it "skips embedded files that exceed MAX_FILE_BYTES" do
        allow(file_attachment).to receive(:size).and_return(described_class::MAX_FILE_BYTES + 1)
        allow_any_instance_of(Attachment).to receive(:size).and_return(described_class::MAX_FILE_BYTES + 1)
        p = @course.wiki_pages.create!(
          title: "Page with oversized file",
          body: "<p>Page text.</p><a class=\"instructure_file_link\" href=\"/courses/#{@course.id}/files/#{file_attachment.id}?wrap=1\">doc.txt</a>",
          saving_user: @student
        )
        content = captured_cedar_content { call_service(prompt: "Summarize", state: { "pageID" => p.url }) }
        expect(content).not_to include("The Iliad content goes here")
      end

      context "char budget / short-circuit" do
        let(:long_attachment) do
          attachment_model(
            context: @course,
            content_type: "text/plain",
            uploaded_data: stub_file_data("long.txt", "A" * 60_000, "text/plain")
          )
        end

        def page_with_links(*atts)
          links = atts.map do |a|
            "<a class=\"instructure_file_link\" href=\"/courses/#{@course.id}/files/#{a.id}?wrap=1\">#{a.display_name}</a>"
          end.join
          @course.wiki_pages.create!(
            title: "Budget test page",
            body: "<p>Budget test.</p>#{links}",
            saving_user: @student
          )
        end

        it "truncates the last file to stay within MAX_CONTENT_CHARS" do
          second = attachment_model(
            context: @course,
            content_type: "text/plain",
            uploaded_data: stub_file_data("second.txt", "B" * 60_000, "text/plain")
          )
          p = page_with_links(long_attachment, second)
          content = captured_cedar_content { call_service(prompt: "Summarize", state: { "pageID" => p.url }) }
          expect(content.length).to be <= described_class::MAX_CONTENT_CHARS
          expect(content).to include("A")
          expect(content).to include("B")
        end

        it "does not extract files beyond the budget" do
          # First file is 110k — larger than MAX_CONTENT_CHARS (100k) — so after
          # it is truncated to fill the budget, remaining drops below zero and the
          # second file is skipped entirely.
          huge = attachment_model(
            context: @course,
            content_type: "text/plain",
            uploaded_data: stub_file_data("huge.txt", "A" * 110_000, "text/plain")
          )
          second = attachment_model(
            context: @course,
            content_type: "text/plain",
            uploaded_data: stub_file_data("second.txt", "B" * 10_000, "text/plain")
          )
          extracted_ids = []
          allow_any_instance_of(described_class).to receive(:extract_attachment_text).and_wrap_original do |_m, att|
            extracted_ids << att.id
            "A" * 110_000
          end
          p = page_with_links(huge, second)
          call_service(prompt: "Summarize", state: { "pageID" => p.url })
          expect(extracted_ids).to include(huge.id)
          expect(extracted_ids).not_to include(second.id)
        end
      end
    end
  end

  describe "caching" do
    before { allow(Rails).to receive(:cache).and_return(ActiveSupport::Cache::MemoryStore.new) }

    it "caches a successful response and reuses it" do
      expect(CedarClient).to receive(:prompt).once.and_call_original
      2.times { call_service(prompt: "Summarize") }
    end

    it "bypasses cache when regenerate is true" do
      expect(CedarClient).to receive(:prompt).twice.and_call_original
      call_service(prompt: "Summarize")
      call_service(prompt: "Summarize", regenerate: true)
    end

    it "scopes the cache key by locale" do
      expect(CedarClient).to receive(:prompt).twice.and_call_original
      described_class.call(course: @course, user: @student, prompt: "Summarize", state: page_state, locale: "en")
      described_class.call(course: @course, user: @student, prompt: "Summarize", state: page_state, locale: "es")
    end

    it "treats 'Generate quiz' as an implicit regenerate, busting the cache" do
      stub_cedar([{ question: "Q1", options: %w[a b c d], result: 0 }].to_json)
      expect(CedarClient).to receive(:prompt).twice.and_call_original
      call_service(prompt: "Quiz me")
      call_service(prompt: "Generate quiz")
    end

    it "treats 'Generate flashcards' as an implicit regenerate, busting the cache" do
      stub_cedar([{ question: "Q", answer: "A" }].to_json)
      expect(CedarClient).to receive(:prompt).twice.and_call_original
      call_service(prompt: "Flashcards")
      call_service(prompt: "Generate flashcards")
    end

    it "busts the file text cache when the attachment md5 changes" do
      attachment = attachment_model(
        context: @course,
        content_type: "text/plain",
        uploaded_data: stub_file_data("notes.txt", "version 1", "text/plain")
      )
      expect(CedarClient).to receive(:prompt).twice.and_call_original
      call_service(prompt: "Summarize", state: { "fileID" => attachment.id.to_s })
      attachment.update_columns(md5: "new-hash-after-content-change")
      call_service(prompt: "Summarize", state: { "fileID" => attachment.id.to_s })
    end

    it "falls back gracefully when attachment md5 is nil" do
      attachment = attachment_model(
        context: @course,
        content_type: "text/plain",
        uploaded_data: stub_file_data("notes.txt", "content", "text/plain")
      )
      allow_any_instance_of(Attachment).to receive(:md5).and_return(nil)
      expect { call_service(prompt: "Summarize", state: { "fileID" => attachment.id.to_s }) }.not_to raise_error
    end

    it "builds shard-safe cache keys referencing the page's global_id" do
      expect(Rails.cache).to receive(:fetch) do |key, **_opts, &blk|
        expect(key).to include(page.global_id.to_s)
        blk.call
      end.at_least(:once).and_call_original
      call_service(prompt: "Summarize")
    end

    it "does not cache a malformed Cedar response (cache-poisoning regression)" do
      stub_cedar("not a valid quiz array")
      expect(CedarClient).to receive(:prompt).twice.and_call_original
      expect { call_service(prompt: "Quiz me") }.to raise_error(StudyAssist::CedarUnavailable)
      expect { call_service(prompt: "Quiz me") }.to raise_error(StudyAssist::CedarUnavailable)
    end
  end
end
