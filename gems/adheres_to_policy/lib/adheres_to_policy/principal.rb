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

# rubocop:disable Rails/Delegate

module AdheresToPolicy
  # Represents any sort of principal (e.g. user, group, service, etc.) that can be granted permissions by a policy,
  # while having methods necessary to allow the framework to easily support expanded use cases.
  #
  # @abstract
  class Principal
    # @return [Object, nil]
    def user = nil

    # Returns a cache key to identify this principal when caching policy results
    #
    # @abstract
    # @return [String]
    def cache_key
      raise NotImplementedError
    end

    # Method called by {InstanceMethods#check_right} to determine if this principal has additional
    # restrictions on top of the policy's grants. For example, a {WrappedPrincipal} subclass might
    # check session state, and only allow access to specific pages if the session is limited somehow.
    #
    # The result of this method is _not_ cached, so implementations should be mindful of performance.
    # Ideally it should be able a simple check with objects already in memory associated with the
    # specific principal, or it should make sure anything it calls is cached -- such as chaining to
    # other permission checks. This enables the implementation to control cache-busting itself, rather
    # than rely on framework-level caching that can be difficult or impossible to invalidate.
    #
    # @param resource [Object] The resource for which the right is being checked
    # @param right [Symbol] The right being checked
    #
    # @return [true, false, Result]
    def grants_right?(_resource, _right)
      true
    end

    def eql?(other)
      (other.instance_of?(self.class) && user.nil? && other.user.nil?) || (!user.nil? && user.eql?(other.user))
    end

    def hash
      [self.class, user].hash
    end

    def ==(other)
      other.instance_of?(self.class) && user == other.user
    end

    def !=(other)
      !(self == other) # rubocop:disable Style/InverseMethods
    end
  end

  # Represents the most basic type of principal: a user.
  class UserPrincipal < Principal
    # @return [Object]
    attr_reader :user

    # @param user [Object]
    def initialize(user)
      super()

      @user = user
    end

    # Delegates to the user. Will "just work" if the user is an ActiveRecord model.
    # Otherwise you'll likely need to inherit and override.
    def cache_key = user.cache_key
  end

  # Abstract class for any sort of restriction on access on top of another Principal.
  #
  # @abstract
  class WrappedPrincipal < Principal
    # @return [Principal]
    attr_reader :wrapped_principal

    # @param wrapped_principal [Principal]
    def initialize(wrapped_principal)
      super()

      @wrapped_principal = wrapped_principal
    end

    def user = wrapped_principal&.user
    def cache_key = wrapped_principal&.cache_key

    def eql?(other)
      other.instance_of?(self.class) && wrapped_principal.eql?(other.wrapped_principal)
    end

    def hash
      [self.class, wrapped_principal].hash
    end

    def ==(other)
      other.instance_of?(self.class) && wrapped_principal == other.wrapped_principal
    end
  end

  # A wrapped Principal for one principal acting on behalf of another.
  class MasqueradePrincipal < WrappedPrincipal
    # @return [Principal]
    attr_reader :real_principal
    alias_method :effective_principal, :wrapped_principal

    def initialize(effective_principal, real_principal)
      super(MasqueradedPrincipal.new(effective_principal))
      @real_principal = MasqueradingPrincipal.new(real_principal)
    end

    # Distinct from the effective principal's cache_key: a `given` block can recursively call
    # `grants_right?`, which re-applies the masquerade restriction on the nested call. The cached
    # outer result therefore depends on both principals, not just the effective one.
    def cache_key = "masq/#{effective_principal.cache_key}/#{real_principal.cache_key}"

    # @return []
    def grants_right?(resource, right)
      resource.grants_right?(real_principal, right, with_justifications: true)
    end

    def eql?(other)
      other.instance_of?(self.class) &&
        effective_principal.eql?(other.effective_principal) &&
        real_principal.eql?(other.real_principal)
    end

    def hash
      [self.class, effective_principal, real_principal].hash
    end

    def ==(other)
      other.instance_of?(self.class) &&
        effective_principal == other.effective_principal &&
        real_principal == other.real_principal
    end
  end

  # A marker principal for when MasqueradePrincipal is in use
  class MasqueradedPrincipal < WrappedPrincipal
    def cache_key = "masqe/#{super}"
  end

  # A marker principal for when MasqueradePrincipal is in use
  class MasqueradingPrincipal < WrappedPrincipal
    def cache_key = "masqr/#{super}"
  end
end

# rubocop:enable Rails/Delegate
