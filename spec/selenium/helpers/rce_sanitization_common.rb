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

require_relative "../common"

module RCESanitizationCommon
  def xss_payloads
    <<~HTML
      <script>alert("xss_script")</script>
      <img src="x" id="xss-img" onerror="alert('xss_img')" />
      <a id="xss-link" href="javascript:void(0)">click me</a>
      <div id="xss-div" style="position:fixed;top:0;left:0;width:100%;height:100%">overlay</div>
    HTML
  end

  def xss_script_tag   = "<script"
  def xss_onerror_attr = /onerror/i
  def xss_js_protocol  = /javascript:/i
  def xss_css_overlay  = /position\s*:\s*fixed/i
end
