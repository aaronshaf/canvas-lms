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
#

describe ExternalFeedEntry do
  describe "save-time sanitization of message" do
    before do
      course_factory
      @feed = external_feed_model(context: @course)
    end

    # Reads the raw column value, bypassing any reader override that could
    # mask a broken before-save sanitize_field callback.
    def persisted_message(entry)
      entry.reload[:message]
    end

    it "strips script tags on create" do
      entry = @feed.external_feed_entries.create!(
        message: "<p>safe</p><script>alert(1)</script>"
      )
      expect(persisted_message(entry)).not_to include("<script>")
      expect(persisted_message(entry)).not_to include("alert(1)")
      expect(persisted_message(entry)).to include("<p>safe</p>")
    end

    it "strips disallowed attributes on update" do
      entry = @feed.external_feed_entries.create!(message: "<p>placeholder</p>")
      entry.update!(message: '<p onmouseover="alert(1)">x</p>')
      expect(persisted_message(entry)).not_to include("onmouseover")
      expect(persisted_message(entry)).not_to include("alert(1)")
    end
  end

  describe "reader override sanitization of message" do
    before do
      course_factory
      @feed = external_feed_model(context: @course)
    end

    it "strips XSS payload on direct read even when dirty data is in the DB" do
      entry = @feed.external_feed_entries.create!(message: "<p>safe</p>")
      entry.update_column(:message, "<p>safe</p><script>alert('xss')</script>")
      entry.reload
      expect(entry.message).not_to include("<script>")
      expect(entry.message).not_to include("alert(")
      expect(entry.message).to include("<p>safe</p>")
    end
  end
end
