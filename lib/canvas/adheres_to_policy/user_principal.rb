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
    class UserPrincipal < ::AdheresToPolicy::UserPrincipal
      class << self
        def new(user_or_pseudonym)
          # these are fail-safe backcompat measures in case things get swapped around during
          # a transition state
          case user_or_pseudonym
          when nil
            ::AdheresToPolicy::Canvas.deprecation_check(:nil_principal,
                                                        actual: NilClass,
                                                        expected: ::AdheresToPolicy::Principal)
            nil
          when ::AdheresToPolicy::Principal
            ::AdheresToPolicy::Canvas.deprecation_check(:nested_principal,
                                                        actual: ::AdheresToPolicy::Principal,
                                                        expected: self)
            user_or_pseudonym
          else
            super
          end
        end
      end

      # @return [Pseudonym, nil]
      attr_reader :pseudonym

      delegate :cache_key_with_version, to: :user

      def initialize(pseudonym_or_user)
        if pseudonym_or_user.is_a?(Pseudonym) || (
          Rails.env.test? && pseudonym_or_user.is_a?(RSpec::Mocks::InstanceVerifyingDouble) &&
            pseudonym_or_user.instance_variable_get(:@doubled_module).send(:object) == Pseudonym)
          @pseudonym = pseudonym_or_user
          super(pseudonym_or_user.user)
        elsif pseudonym_or_user.is_a?(User) || (
          Rails.env.test? && pseudonym_or_user.is_a?(RSpec::Mocks::InstanceVerifyingDouble) &&
            pseudonym_or_user.instance_variable_get(:@doubled_module).send(:object) == User)
          @pseudonym = nil
          super
        else
          raise ArgumentError, "Expected a Pseudonym or User, got #{pseudonym_or_user.class}"
        end
      end

      def cache_key(*args)
        ::AdheresToPolicy::Canvas.deprecation_check(:principal_as_user_lenient) unless args.empty?
        user.cache_key(*args)
      end

      def eql?(other)
        other.instance_of?(self.class) &&
          user == other.user &&
          pseudonym == other.pseudonym
      end

      def hash
        [self.class, user, pseudonym].hash
      end
    end
  end
end
