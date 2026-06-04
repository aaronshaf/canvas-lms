# frozen_string_literal: true

#
# Copyright (C) 2014 - present Instructure, Inc.
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

require "active_support/core_ext/enumerable"

module AdheresToPolicy
  module InstanceMethods
    # Gets the requested rights granted to a principal.
    #
    # @param principal [Principal, nil] The principal for which to get the rights.
    # @param session [Hash, nil] The session to use if the rights are dependent upon the session.
    # @param rights [Symbol] The rights to get the status for.
    #
    # @example
    #   granted_rights(principal, :read)
    #   # => [ :read ]
    #
    #   granted_rights(principal, :read, :update)
    #   # => [ :read, :update ]
    #
    #   granted_rights(principal, session, :update, :delete)
    #   # => [ :update ]
    #
    # @return [<Symbol>] An array of rights granted to the principal.
    def granted_rights(principal, *rights)
      session, sought_rights = parse_args(rights)
      sought_rights ||= []
      sought_rights = self.class.policy.available_rights if sought_rights.empty?
      sought_rights.select do |r|
        check_right?(principal, session, r)
      end
    end
    # alias so its backwards compatible.
    alias_method :check_policy, :granted_rights

    # Gets the requested rights and their status for a principal.
    #
    # @param principal [Principal, nil] The principal for which to get the rights.
    # @param session [Hash, nil] The session to use if the rights are dependent upon the session.
    # @param rights [Symbol] The rights to get the status for.
    #
    # @example
    #   rights_status(principal, :read)
    #   # => { :read => true }
    #
    #   rights_status(principal, session, :update, :delete)
    #   # => { :update => true, :delete => false }
    #
    # @return [{ Symbol => true, false }] A hash with the requested rights and their status.
    def rights_status(principal, *rights)
      session, sought_rights = parse_args(rights)
      sought_rights ||= []
      sought_rights = self.class.policy.available_rights if sought_rights.empty?
      sought_rights.index_with do |r|
        check_right?(principal, session, r)
      end
    end

    # Checks any of the rights passed in for a principal.
    #
    # @param principal [Principal, nil] The principal for which to determine the right.
    # @param session [Hash, nil] The session to use if the rights are dependent upon the session.
    # @param rights [Symbol] The rights to get the status for.  Will return true if the principal is granted any of the
    #   rights provided.
    # @param with_justifications [true, false] Controls how detailed of a return value the caller prefers.
    #
    # @example
    #   grants_any_right?(principal, :read)
    #   # => true
    #
    #   grants_any_right?(principal, session, :delete)
    #   # => false
    #
    #   grants_any_right?(principal, session, :update, :delete)
    #   # => true
    #
    # @return [true, false, Result] If `with_justifications` is false, it return `true` if any of the
    #   provided rights are granted to the principal, and `false` if none of them are. Otherwise it returns a {Failure}
    #   (or one of it subclasses) object with details on the result.
    def grants_any_right?(principal, *rights, with_justifications: false)
      session, sought_rights = parse_args(rights)
      check_results = sought_rights.map do |sought_right|
        result = check_right?(principal, session, sought_right, with_justifications: true)
        # short circuit if we succeed so we don't process unnecessary permissions
        return with_justifications ? result : true if result.success?

        result
      end

      # Justifications must be resolvable without knowledge of the specific check they happened
      # to fail on, so just return the unique justifications
      with_justifications ? JustifiedFailures.new(check_results.flat_map(&:justifications).uniq) : false
    end

    # Checks all of the rights passed in for a principal.
    #
    # @param principal [Principal, nil] The principal for which to determine the right.
    # @param session [Hash, nil] The session to use if the rights are dependent upon the session.
    # @param rights [Symbol] The rights to get the status for.  Will return true if the principal is granted all of the
    #   rights provided.
    # @param with_justifications [true, false] Controls how detailed of a return value the caller prefers.
    #
    # @example
    #   grants_all_rights?(principal, :read)
    #   # => true
    #
    #   grants_all_rights?(principal, session, :delete)
    #   # => false
    #
    #   grants_all_rights?(principal, session, :update, :delete)
    #   # => false
    #
    # @return [true, false, Result] If `with_justifications` is false, it return `true` if all of the
    #   provided rights are granted to the principal, and `false` if none of them are. Otherwise it returns a {Failure}
    #   (or one of it subclasses) object with details on the result.
    def grants_all_rights?(principal, *rights, with_justifications: false)
      session, sought_rights = parse_args(rights)
      return with_justifications ? Failure.instance : false if sought_rights.empty?

      sought_rights.map do |sought_right|
        result = check_right?(principal, session, sought_right, with_justifications: true)
        # short circuit if we fail so we don't process unnecessary permissions
        return with_justifications ? result : false unless result.success?

        result
      end

      # At this point we must have succeeded on all checks
      with_justifications ? Success.instance : true
    end

    # Checks the right passed in for a principal.
    #
    # @param principal [Principal, nil] The principal for which to determine the right.
    # @param session [Hash, nil] The session to use if the rights are dependent upon the session.
    # @param right [Symbol] The right to get the status for.
    # @param with_justifications [true, false] Controls how detailed of a return value the caller prefers.
    #
    # @example
    #   grants_right?(principal, :read)
    #   # => true
    #
    #   grants_right?(principal, session, :delete)
    #   # => false
    #
    #   grants_right?(principal, session, :update)
    #   # => true
    #
    # @return [true, false, Result] If `with_justifications` is false, it return `true` if the provided
    #   right is granted to the principal, and `false` if none of them are. Otherwise it returns a {Failure}
    #   (or one of it subclasses) object with details on the result.
    def grants_right?(principal, *rights, with_justifications: false)
      session, sought_rights = parse_args(rights)
      raise ArgumentError if sought_rights.length > 1

      check_right?(principal, session, sought_rights.first, with_justifications:)
    end

    # Clears the cached permission states for the user.
    #
    # @param principal [Principal, nil] The principal for which to clear the rights.
    # @param session [Hash, nil] The session to use if the rights are dependent upon the session.
    #
    # @example
    #   clear_permissions_cache(user)
    #   # => nil
    #
    #   clear_permissions_cache(user, session)
    #   # => nil
    #
    def clear_permissions_cache(principal, session = nil)
      return if respond_to?(:new_record?) && new_record?

      Cache.clear
      self.class.policy.available_rights.each do |available_right|
        Rails.cache.delete(permission_cache_key_for(principal, session, available_right))
      end
    end

    private

    # Parses the arguments passed in for a session and sought rights array.
    #
    # @param args [Array] The args containing the session and sought rights.
    #
    # Examples
    #
    #   parse_args([ session, :read, :write ])
    #   # => session, [ :read, :write ]
    #
    #   parse_args([ nil, :read, :write ])
    #   # => nil, [ :read, :write ]
    #
    # @return [(Hash, nil), <Symbol>] a session object which is nil if it was not provided and an array of the sought
    #   rights.
    def parse_args(args)
      session = nil
      unless args[0].is_a? Symbol
        session = args.shift
      end
      args.compact!
      args.uniq!

      [session, args]
    end

    # Checks the right for a principal based on session.
    #
    # @param principal [Principal, nil] The principal to base the right check from.
    # @param session [Hash, nil] The session to use when checking the right status.
    # @param sought_right [Symbol] The right to check its status.
    # @param with_justifications [true, false] Controls how detailed of a return value the caller prefers.
    #
    # Examples
    #
    #   check_right?(principal, session, :read)
    #   # => true, :read
    #
    #   check_right?(principal, nil, :delete)
    #   # => false, :delete
    #
    # @return [true, false, Success, Result] If `with_justifications` is false, it return `true` if the provided
    #   right is granted to the principal, and `false` if none of them are. Otherwise it returns a {Failure}
    #   (or one of it subclasses) object with details on the result.
    def check_right?(principal, session, sought_right, with_justifications: false)
      raise ArgumentError, "principal must be a Principal" if principal && !principal.is_a?(Principal)

      return with_justifications ? Failure.instance : false unless sought_right

      config = AdheresToPolicy.configuration
      override = config.override_proc&.call(principal, sought_right)
      return with_justifications ? override : override.success? if override

      if Thread.current[:primary_permission_under_evaluation].nil?
        Thread.current[:primary_permission_under_evaluation] = true
      end

      sought_right_cookie = "#{self.class.name&.underscore}.#{sought_right}"

      blacklist = config.blacklist

      use_rails_cache = !blacklist.include?(sought_right_cookie) &&
                        (Thread.current[:primary_permission_under_evaluation] || config.cache_intermediate_permissions)

      was_primary_permission, Thread.current[:primary_permission_under_evaluation] =
        Thread.current[:primary_permission_under_evaluation], false

      # Check the cache for the sought_right.  If it exists in the cache its
      # state (true or false) will be returned.  Otherwise we calculate the
      # state and cache it.
      value, _how_it_got_it = Cache.fetch(
        permission_cache_key_for(principal, session, sought_right),
        use_rails_cache:
      ) do
        conditions = self.class.policy.conditions[sought_right]
        next Failure.instance unless conditions

        failure_justifications = []

        # Loop through all the conditions until we find the first one that
        # grants us the sought_right.
        result = conditions.any? do |condition|
          start_time = Time.now
          condition_applies = condition.applies?(self, principal, session)
          elapsed_time = Time.now - start_time

          if condition_applies.is_a?(JustifiedFailure)
            failure_justifications << condition_applies
            condition_applies = false
          end

          if condition_applies.is_a?(JustifiedFailures)
            failure_justifications += condition_applies.justifications
            condition_applies = false
          end

          if condition_applies
            # Since the condition is true we can loop through all the rights
            # that belong to it and cache them.  This will short circut the above
            # Rails.cache.fetch for future checks that we won't have to do again.
            condition.rights.each do |condition_right|
              # Skip the condition_right if its the one we are looking for.
              # The Rails.cache.fetch will take care of caching it for us.
              next unless condition_right != sought_right

              Thread.current[:last_cache_generate] = elapsed_time # so we can record it in the logs
              # Cache the condition_right since we already know they have access.
              Cache.write(
                permission_cache_key_for(principal, session, condition_right),
                Success.instance,
                use_rails_cache: false
              )
            end

            true
          end
        end

        result ? Success.instance : JustifiedFailures.new(failure_justifications)
      end

      value = principal.grants_right?(self, sought_right) if value == Success.instance && principal
      value = Success.instance if value == true
      value = Failure.instance if value == false
      value = JustifiedFailures.new([value]) if value.is_a?(JustifiedFailure)

      with_justifications ? value : value.success?
    ensure
      Thread.current[:primary_permission_under_evaluation] = was_primary_permission
    end

    # Gets the cache key for the principal and right.
    #
    # @param principal [Principal, nil] The principal to derive the cache key from.
    # @param session [Hash, nil] The session to pull session specific key information from.
    # @param right [Symbol] The right to derive the cache key from.
    #
    # Examples
    #
    #   permission_cache_key_for(principal, :read)
    #   # => '42/read'
    #
    #   permission_cache_key_for(principal, { :permissions_key => 'student' }, :read)
    #   # => '42/read'
    #
    # Returns a string to use as a permissions cache key in the context of the
    # provided user and/or right.
    def permission_cache_key_for(principal, session, right)
      return nil if respond_to?(:new_record?) && new_record?

      # If you're going to add something to the user session that
      # affects permissions, you'd durn well better a :permissions_key
      # on the session as well
      permissions_key = session ? (session[:permissions_key] || "default") : nil # no session != no permissions_key
      ["permissions2", self, principal&.cache_key, permissions_key, right].compact
                                                                          .map { |element| ActiveSupport::Cache.expand_cache_key(element) }
                                                                          .to_param
    end
  end
end
