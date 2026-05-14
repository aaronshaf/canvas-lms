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

require_relative "../shared_constants"
require_relative "../shared_linter_examples"

describe TatlTael::Linters::Simple::NoControllerSpecsLinter do
  let(:config) { TatlTael::Linters.config_for_linter(described_class) }

  context "new controller spec added" do
    it_behaves_like "comments",
                    [{ path: "spec/controllers/foo_controller_spec.rb", status: "added" }]
  end

  context "new plugin controller spec added" do
    it_behaves_like "comments",
                    [{ path: "gems/plugins/myplugin/spec/controllers/foo_spec.rb", status: "added" }]
  end

  context "controller spec modified (not added)" do
    it_behaves_like "does not comment",
                    [{ path: "spec/controllers/foo_controller_spec.rb", status: "modified" }]
  end

  context "controller spec deleted" do
    it_behaves_like "does not comment",
                    [{ path: "spec/controllers/foo_controller_spec.rb", status: "deleted" }]
  end

  context "deeply nested controller spec added" do
    it_behaves_like "comments",
                    [{ path: "spec/controllers/api/v1/foo_controller_spec.rb", status: "added" }]
  end

  context "non-controller spec added" do
    it_behaves_like "does not comment",
                    [{ path: "spec/models/user_spec.rb", status: "added" }]
  end
end
