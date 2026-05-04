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

describe Canvas::AdheresToPolicy::UserPrincipal do
  let_once(:user) { user_with_pseudonym }
  let(:principal) { Canvas::AdheresToPolicy::UserPrincipal.new(user) }

  describe "#initialize" do
    it "infers user from pseudonym" do
      principal = Canvas::AdheresToPolicy::UserPrincipal.new(user.pseudonyms.first)
      expect(principal.user).to eq user
      expect(principal.pseudonym).to eq user.pseudonyms.first
    end

    it "allows pseudonym-less users" do
      expect(principal.pseudonym).to be_nil
    end
  end
end
