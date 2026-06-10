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
    VALID_LEVELS = %i[raise report count log ignore].freeze
    # The lenient classes are needed for general backwards compatibility during the transition period with
    # existing code.
    # {:principal_as_user} is needed for general backwards compatibility, but should be the first one
    # investigated and fixed as it uses `method_missing` and thus has a more significant performance impact.
    # The other non-lenient classes are indications that you missed a callsite when converting some code
    # to use principals, and should be fixed as part of the conversion, but is still allowed to work in
    # production in case specs miss it.
    VALID_CLASSES = %i[default
                       nested_principal
                       nil_principal
                       principal_as_user
                       principal_as_user_lenient
                       user_as_principal
                       user_as_principal_lenient].freeze

    DEFAULT_DEPRECATION_CONFIG = if Rails.env.production?
                                   Hash.new(:ignore).freeze
                                 else
                                   Hash.new(:log).merge(
                                     {
                                       nested_principal: :raise,
                                       nil_principal: :raise,
                                       user_as_principal: :raise
                                     }
                                   ).freeze
                                 end

    DeprecationFailure = Class.new(StandardError)

    class << self
      def deprecation_config
        reset unless instance_variable_defined?(:@deprecation_config)
        @deprecation_config
      end

      def deprecation_check(deprecation_class, actual: Principal, expected: ::User)
        current_level = deprecation_config[deprecation_class]

        return if current_level == :ignore

        message = "AdheresToPolicy: The caller is treating a #{actual} as a #{expected}"
        raise DeprecationFailure, message if current_level == :raise

        # only log/count/report each unique (within the last 6 stackframes) callsite once per request
        locations = caller(2, 6)
        RequestCache.cache([:adheres_to_policy_deprecation_warnings, locations]) do
          sentry_event = nil
          if current_level == :report
            Sentry.with_scope do |scope|
              scope.set_tags(deprecation_class: deprecation_class.to_s)

              sentry_event = Sentry.capture_message(message, level: :warning)
            end
          end

          if %i[report count].include?(current_level)
            tags = Utils::InstStatsdUtils::Tags.tags_for(::Shard.current)
                                               .merge(::Canvas::ExecutionContext.to_h)
                                               .merge(deprecation_class: deprecation_class.to_s)
            tags[:sentry_event_id] = sentry_event.event_id if sentry_event

            InstStatsd::Statsd.event(
              message,
              locations.join("\n"),
              type: :adheres_to_policy_deprecation,
              alert_type: :warning,
              tags:
            )
          end

          Rails.logger.warn("#{message}: #{locations.join("\n")}")
        end
      end

      private

      def reset
        settings = YAML.safe_load(::DynamicSettings.find(tree: :private)["adheres_to_policy.yml", failsafe: nil] || "{}")
        @deprecation_config = if settings["deprecation"]
                                config = settings["deprecation"].to_h { |k, v| [k.to_sym, v.to_sym] }
                                config.default = config[:default] || DEFAULT_DEPRECATION_CONFIG[:default]
                                config
                              else
                                DEFAULT_DEPRECATION_CONFIG
                              end
        unless (extra_classes = @deprecation_config.keys - VALID_CLASSES).empty?
          Rails.logger.error("Invalid adheres_to_policy deprecation classes: #{extra_classes.join(", ")}; using defaults")
          @deprecation_config = DEFAULT_DEPRECATION_CONFIG
          return
        end
        @deprecation_config.each do |k, v|
          next if VALID_LEVELS.include?(v)

          Rails.logger.error("Invalid adheres_to_policy deprecation level for #{k}: #{v}; using default")
          @deprecation_config = DEFAULT_DEPRECATION_CONFIG
          break
        end
        @deprecation_config.freeze
      end
    end

    ::Canvas::Reloader.on_reload { reset }

    module InstanceMethods
      def check_right?(user, ...)
        if !user.is_a?(Principal) &&
           (user.is_a?(::User) ||
            (Rails.env.test? &&
            user.is_a?(RSpec::Mocks::InstanceVerifyingDouble) &&
            user.instance_variable_get(:@doubled_module).send(:object) == ::User))
          AdheresToPolicy::Canvas.deprecation_check(:user_as_principal_lenient, actual: ::User, expected: Principal)
          # Uses RequestCache to avoid re-creating UserPrincipal objects for the same user repeatedly within a single
          # request, which is a common case when transitioning because permission checks are still passing only a user.
          user = RequestCache.cache(user) do
            # If the request already has a Principal for this user (e.g. a MasqueradingPrincipal),
            # reuse it so masquerade restrictions etc. apply.
            current = ::Canvas::AdheresToPolicy::Current.principal
            next current if current && current.user.equal?(user)

            # Avoid User#principal, since it's fairly likely that `user` will be a double
            ::Canvas::AdheresToPolicy::UserPrincipal.new(user)
          end
        end
        super
      end
    end

    module Principal
      module ClassMethods
        def method_missing(...)
          AdheresToPolicy::Canvas.deprecation_check(:principal_as_user)
          ::User.__send__(...)
        end

        def respond_to_missing?(method_name, include_private = false)
          ::User.respond_to?(method_name, include_private) || super
        end
      end

      def method_missing(method, ...)
        return super unless user
        return super if %i[encode_with init_with].include?(method)

        AdheresToPolicy::Canvas.deprecation_check(:principal_as_user)
        user.__send__(method, ...)
      end

      def respond_to_missing?(method_name, include_private = false)
        return super unless user
        return super if %i[encode_with init_with].include?(method_name)

        user.respond_to?(method_name, include_private) || super
      end

      # Compare against another Principal (matches when their underlying users match) or directly
      # against the underlying user. Lets `given` blocks written as `self.user == user` continue
      # to work when `user` is now a Principal-wrapped representation of the same underlying user.
      def ==(other)
        if other.is_a?(::User)
          AdheresToPolicy::Canvas.deprecation_check(:principal_as_user_lenient)
          return user == other
        end

        super
      end

      def is_a?(klass)
        if klass == ::User
          AdheresToPolicy::Canvas.deprecation_check(:principal_as_user_lenient)
          return true
        end

        super
      end

      delegate :to_param, to: :user
    end

    module Shard
      module ClassMethods
        def integral_id_for(any_id)
          if any_id.is_a?(AdheresToPolicy::Principal)
            AdheresToPolicy::Canvas.deprecation_check(:principal_as_user_lenient)
            any_id = any_id.user
          end
          super
        end
      end
    end

    module ActiveRecord
      module BelongsToAssociation
        def replace(record)
          if record.is_a?(AdheresToPolicy::Principal)
            AdheresToPolicy::Canvas.deprecation_check(:principal_as_user_lenient)
            record = record.user
          end
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
        if other.is_a?(AdheresToPolicy::Principal)
          AdheresToPolicy::Canvas.deprecation_check(:user_as_principal_lenient,
                                                    actual: ::User,
                                                    expected: Principal)
          return super(other.user)
        end

        super
      end

      def user
        AdheresToPolicy::Canvas.deprecation_check(:user_as_principal,
                                                  actual: ::User,
                                                  expected: Principal)
        self
      end
    end
  end
end

AdheresToPolicy::InstanceMethods.prepend(AdheresToPolicy::Canvas::InstanceMethods)
AdheresToPolicy::Principal.prepend(AdheresToPolicy::Canvas::Principal)
# makes sure MasqueradingPrincipal doesn't hide the overridden #==
AdheresToPolicy::MasqueradingPrincipal.prepend(AdheresToPolicy::Canvas::Principal)
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
      # NOTE: we don't currently have a controller handler for this case (see
      # ApplicationController#authorized_action_handle_justification).
      AdheresToPolicy::JustifiedFailure.new(:not_for_masquerading)
    end
  end
end
