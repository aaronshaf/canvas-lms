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

class NotebookController < ApplicationController
  before_action :require_context
  before_action :require_user

  def index
    not_found unless @context.account.feature_enabled?(:notebook)
    return unless authorized_action(@context, current_principal, :participate_as_student)

    set_active_tab "notebook"
    add_crumb t("#crumbs.notebook", "Notebook")
    @page_title = t("#page_title.notebook", "Notebook")

    js_env({
             COURSE_ID: @context.id,
           })
    js_env[:FEATURES] ||= {}
    js_env[:FEATURES][:notebook] = true
    js_bundle :notebook_index
    render html: view_context.content_tag(:div, nil, id: "notebook_index_mount_point"), layout: true
  end
end
