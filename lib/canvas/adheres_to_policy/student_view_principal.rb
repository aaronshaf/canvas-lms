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

module Canvas
  module AdheresToPolicy
    class StudentViewPrincipal < ::AdheresToPolicy::MasqueradePrincipal
      def initialize(effective_principal, real_principal)
        raise ArgumentError, "effective_principal must be a fake user" unless effective_principal.user.fake_student?

        super
      end

      # we bypasss the extra masquerading permission checks, since a student view user can technically do things
      # a teacher/admin can't do (submit assignments)
      delegate :cache_key, to: :effective_principal
      def grants_right?(_resource, _right) = true
    end
  end
end
