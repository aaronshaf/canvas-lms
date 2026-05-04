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

require "adheres_to_policy"

module AdheresToPolicy
  # These are temporary wrappers to facilitate transitioning from using {User} objects for permission checks to using
  # {AdheresToPolicy::Principal} objects, which allow for more flexible permission checks.
  module Canvas
    module InstanceMethods
      def check_right?(user, ...)
        if !user.is_a?(Principal) &&
           (user.is_a?(::User) ||
            (Rails.env.test? &&
            user.is_a?(RSpec::Mocks::InstanceVerifyingDouble) &&
            user.instance_variable_get(:@doubled_module).send(:object) == ::User))
          # Uses RequestCache to avoid re-creating UserPrincipal objects for the same user repeatedly within a single
          # request, which is a common case when transitioning because permission checks are still passing only a user.
          user = RequestCache.cache(user) do
            ::Canvas::AdheresToPolicy::UserPrincipal.new(user)
          end
        end
        super
      end
    end

    module Principal
      module ClassMethods
        def method_missing(...)
          ::User.__send__(...)
        end

        def respond_to_missing?(method_name, include_private = false)
          ::User.respond_to?(method_name, include_private) || super
        end
      end

      def method_missing(...)
        return super unless user

        user.__send__(...)
      end

      def respond_to_missing?(method_name, include_private = false)
        return super unless user

        user.respond_to?(method_name, include_private) || super
      end

      # Compare against another Principal (matches when their underlying users match) or directly
      # against the underlying user. Lets `given` blocks written as `self.user == user` continue
      # to work when `user` is now a Principal-wrapped representation of the same underlying user.
      def ==(other)
        return user == other if other.is_a?(::User)

        super
      end

      def is_a?(klass)
        return true if klass == ::User

        super
      end

      delegate :to_param, to: :user
    end

    module Shard
      module ClassMethods
        def integral_id_for(any_id)
          any_id = any_id.user if any_id.is_a?(AdheresToPolicy::Principal)
          super
        end
      end
    end

    module ActiveRecord
      module BelongsToAssociation
        def replace(record)
          record = record.user if record.is_a?(AdheresToPolicy::Principal)
          super
        end
      end
    end

    # A User got passed somewhere that's expecting a Principal
    # that's _not_ AdheresToPolicy code (which will directly detect it in {InstanceMethods} above,
    # and re-wrap it properly, so we don't need to implement the full Principal interface)
    module User
      # Compare against an AdheresToPolicy::Principal by recursing on the wrapped user, so `given`
      # blocks written as `self.user == user` keep working when `user` arrives as a Principal.
      def ==(other)
        return super(other.user) if other.is_a?(AdheresToPolicy::Principal)

        super
      end

      def user
        self
      end
    end
  end
end

AdheresToPolicy::InstanceMethods.prepend(AdheresToPolicy::Canvas::InstanceMethods)
AdheresToPolicy::Principal.prepend(AdheresToPolicy::Canvas::Principal)
AdheresToPolicy::Principal.singleton_class.prepend(AdheresToPolicy::Canvas::Principal::ClassMethods)
Switchman::Shard.singleton_class.prepend(AdheresToPolicy::Canvas::Shard::ClassMethods)
ActiveRecord::Associations::BelongsToAssociation.prepend(AdheresToPolicy::Canvas::ActiveRecord::BelongsToAssociation)
ActiveRecord::Base.singleton_class.include(AdheresToPolicy::ClassMethods)
Autoextend.hook(:User, AdheresToPolicy::Canvas::User, method: :prepend)

AdheresToPolicy.configure do |config|
  config.blacklist = ["discussion_entry.reply"]
  config.override_proc = lambda do |user, sought_right|
    # != false is intentional here. nil means the permissions check wasn't run against @current_user,
    # so we don't know that they're not masquerading, and therefore can't allow the action
    user = user.user if user.is_a?(AdheresToPolicy::Principal)
    if user.try(:impersonated) != false && Permissions.not_for_masquerading?(sought_right)
      AdheresToPolicy::JustifiedFailure.new(:not_for_masquerading)
    end
  end
end
