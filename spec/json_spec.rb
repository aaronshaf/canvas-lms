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

describe "JSON" do
  it "escapes HTML tags in JSON" do
    # just for sanity checking. we use this in views, and we have so many
    # JSON gems active we want to make sure this behavior isn't changing somehow
    expect({ foo: "</script>" }.to_json).to eql '{"foo":"\\u003c/script\\u003e"}'
  end
end
