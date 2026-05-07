# frozen_string_literal: true

#
# Copyright (C) 2025 - present Instructure, Inc.
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

describe DiscussionEntryVersion do
  describe "#message_intro" do
    let(:user) { user_model }
    let(:course) { course_model }
    let(:topic) { course.discussion_topics.create!(title: "Test Topic", message: "Test message") }
    let(:entry) { topic.discussion_entries.create!(user:, message: "Initial message") }
    let(:version) { entry.discussion_entry_versions.first }

    it "strips HTML tags from message" do
      version.update!(message: "<p>Hello <strong>world</strong></p>")
      expect(version.message_intro).to eq("Hello world")
    end

    it "truncates message at 300 characters" do
      long_message = "a" * 400
      version.update!(message: long_message)
      expect(version.message_intro.length).to eq(301) # 0..300 inclusive
      expect(version.message_intro).to eq("a" * 301)
    end

    it "returns full message when shorter than 300 characters" do
      short_message = "This is a short message"
      version.update!(message: short_message)
      expect(version.message_intro).to eq(short_message)
    end

    it "strips HTML tags before truncating" do
      # Create a message with HTML that would be >300 chars with tags but <300 without
      content = "a" * 250
      version.update!(message: "<p>#{content}</p><strong>more text here</strong>")
      result = version.message_intro
      expect(result).not_to include("<p>")
      expect(result).not_to include("</p>")
      expect(result).not_to include("<strong>")
      expect(result.length).to be <= 301
    end

    it "handles message with nested HTML tags" do
      version.update!(message: "<div><p>Hello <em>beautiful</em> <strong>world</strong></p></div>")
      expect(version.message_intro).to eq("Hello beautiful world")
    end

    it "handles empty message" do
      version.update!(message: "")
      expect(version.message_intro).to eq("")
    end

    it "truncates at exactly MESSAGE_INTRO_TRUNCATE_LENGTH" do
      expect(DiscussionEntryVersion::MESSAGE_INTRO_TRUNCATE_LENGTH).to eq(300)
      message = "x" * 500
      version.update!(message:)
      # 0..300 means 301 characters (indices 0 through 300 inclusive)
      expect(version.message_intro.length).to eq(301)
      expect(version.message_intro).to eq("x" * 301)
    end
  end

  describe "message sanitization on write" do
    let(:user) { user_model }
    let(:course) { course_model }
    let(:topic) { course.discussion_topics.create!(title: "t", message: "m") }
    let(:entry) { topic.discussion_entries.create!(user:, message: "Initial message") }
    let(:version) { entry.discussion_entry_versions.first }

    it "strips disallowed elements when assigned via the writer" do
      version.update!(message: "<script>alert(1)</script>safe text")
      expect(version.read_attribute(:message)).not_to include("<script>")
      expect(version.read_attribute(:message)).to include("safe text")
    end

    it "strips disallowed attributes when assigned via the writer" do
      version.update!(message: '<p onclick="alert(1)">x</p>')
      expect(version.read_attribute(:message)).not_to include("onclick")
    end

    it "strips disallowed elements on create" do
      v = entry.discussion_entry_versions.create!(
        root_account: entry.root_account,
        user:,
        version: 99,
        message: "<script>alert(1)</script>safe text"
      )
      expect(v.read_attribute(:message)).not_to include("<script>")
      expect(v.read_attribute(:message)).to include("safe text")
    end

    it "strips id from non-anchor elements (parity with DiscussionEntry)" do
      version.update!(message: '<p id="leak">x</p><div id="other">y</div>')
      stored = version.read_attribute(:message)
      expect(stored).not_to include('id="leak"')
      expect(stored).not_to include('id="other"')
    end

    it "preserves id on inline media comment anchors" do
      link = '<a class="instructure_inline_media_comment" ' \
             'id="media_comment_xyz" href="/media">media</a>'
      version.update!(message: link)
      stored = version.read_attribute(:message)
      expect(stored).to include('class="instructure_inline_media_comment"')
      expect(stored).to include('id="media_comment_xyz"')
    end

    it "strips id from anchors without the inline-media-comment class" do
      version.update!(message: '<a id="not_media" href="/x">link</a>')
      expect(version.read_attribute(:message)).not_to include('id="not_media"')
    end

    it "preserves typical formatted content unchanged" do
      safe = "<p>Hello <strong>world</strong> — see <em>this</em>.</p>"
      version.update!(message: safe)
      expect(version.read_attribute(:message)).to eq(safe)
    end
  end

  describe "sanitization parity with DiscussionEntry" do
    let(:user) { user_model }
    let(:course) { course_model }
    let(:topic) { course.discussion_topics.create!(title: "t", message: "m") }
    let(:entry) { topic.discussion_entries.create!(user:, message: "Initial") }

    it "produces identical sanitized output for entry and its newest version" do
      risky = '<p id="leak" onclick="alert(1)">hello</p>' \
              '<a class="instructure_inline_media_comment" id="m1" href="/x">m</a>' \
              "<script>x</script>"
      entry.update!(message: risky)

      latest = entry.discussion_entry_versions.order(version: :desc).first
      expect(latest.message).to eq(entry.message)
    end

    it "is idempotent — re-saving a version does not further mutate the message" do
      entry.update!(message: "<p>safe <strong>html</strong></p>")
      version = entry.discussion_entry_versions.order(version: :desc).first
      before = version.read_attribute(:message)
      version.save!
      expect(version.read_attribute(:message)).to eq(before)
    end
  end

  describe "#message reader" do
    let(:user) { user_model }
    let(:course) { course_model }
    let(:topic) { course.discussion_topics.create!(title: "t", message: "m") }
    let(:entry) { topic.discussion_entries.create!(user:, message: "Initial message") }
    let(:version) { entry.discussion_entry_versions.first }

    it "strips disallowed attributes when the column was persisted unsanitized" do
      version.update_columns(message: '<object onerror="alert(1)">x</object>')
      expect(version.reload.message).not_to include("onerror")
      expect(version.message).not_to include("alert(1)")
    end

    it "strips disallowed elements when the column was persisted unsanitized" do
      version.update_columns(message: "<script>alert(1)</script>safe text")
      expect(version.reload.message).not_to include("<script>")
      expect(version.message).not_to include("alert(1)")
      expect(version.message).to include("safe text")
    end

    it "strips object data attributes pointing at javascript URIs" do
      version.update_columns(message: '<object data="javascript:alert(1)"></object>')
      expect(version.reload.message).not_to include("javascript:")
    end

    it "preserves allowed HTML on read" do
      version.update_columns(message: "<p>hello <strong>world</strong></p>")
      expect(version.reload.message).to eql("<p>hello <strong>world</strong></p>")
    end

    it "leaves nil unchanged on read" do
      version.update_columns(message: nil)
      expect(version.reload.message).to be_nil
    end
  end
end
