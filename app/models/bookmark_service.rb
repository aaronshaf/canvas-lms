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

require "nokogiri"

class BookmarkService < UserService
  def post_bookmark(opts)
    url = opts[:url]
    return unless url

    opts[:title] || t(:default_title, "No Title")
    opts[:comments] || ""
    opts[:tags] || ["instructure"]
    begin
      raise "Unknown bookmark service: #{service}"
    rescue
      # Should probably save the data to try again if it fails... at least one more try
    end
  end

  def find_bookmarks
    bookmark_search(self)
  end

  def bookmark_search(service)
    raise "Unknown bookmark service: #{service.service}"
  end
end
