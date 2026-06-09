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

module CanvasOperations
  module BaseConcerns
    module Schema
      AR_ARG_SUFFIX = "_id"

      Argument = Data.define(:name, :type, :required, :title, :description, :default, :example) do
        def initialize(**)
          super
          unless active_record_type? || type.is_a?(Symbol)
            raise ArgumentError, "Argument type for `#{name}` must be a Symbol or ActiveRecord::Base subclass"
          end
        end

        def active_record_type?
          type.is_a?(Class) && type < ActiveRecord::Base
        end

        def property_name
          active_record_type? ? :"#{name}#{AR_ARG_SUFFIX}" : name
        end

        def to_property
          {
            type: active_record_type? ? "string" : type.to_s,
            title:,
            description:,
            default:,
          }.compact
        end
      end

      def argument(name, type:, required: false, title: nil, description: nil, default: nil, example: nil)
        arguments << Argument.new(name:, type:, required:, title:, description:, default:, example:)
      end

      def operation_schema
        @operation_schema ||= {
          id: operation_name,
          title: operation_title,
          supports_shards: supports_shards?,
          description:,
          schema: json_schema,
          ui_schema:,
        }
      end

      # Canvas operations accept AR instances for convenince in programatic use
      #
      # Operation schemas instead expose a string and _id arguments for users to
      # specify the global ID of an AR instance. (See the Argument data struct)
      #
      # This parse_args method does the translation of _id arguments into the
      # AR instance arguments the operation initializer expects.
      def resolve_args(arg_hash)
        arg_hash.each_with_object({}) do |(k, v), hash|
          if k.ends_with?(AR_ARG_SUFFIX)
            unless Shard.global_id?(v)
              raise ArgumentError, "Non-global ID given for argument `#{k}`. IDs for ActiveRecord arguments must be global to avoid ambiguity."
            end

            arg_name = k.delete_suffix(AR_ARG_SUFFIX).to_sym
            arg = arguments.find { it.name == arg_name }
            raise ArgumentError, "Unknown ActiveRecord argument `#{k}`" unless arg&.active_record_type?

            hash[arg_name] = arg.type.find(v)
          else
            hash[k.to_sym] = v
          end
        end
      end

      private

      # True for subclasses where the operation is intended to run on each shard.
      #
      # This value has no impact on the behavior of the operation in Canvas. Instead it
      # is a hint to schema consumers what form elements for shard selection should
      # be presented to the user.
      def supports_shards? = false

      def description(value = nil)
        @description = value unless value.nil?
        @description
      end

      def arguments
        @arguments ||= []
      end

      # UI hints for schema consumers.
      #
      # Some hints are derived automatically from the operation so individual
      # operations don't have to repeat them:
      #
      #   * "DescriptionHelper:short" defaults to the operation's description.
      #   * "SourceCodeField:examples" is built from any argument `example:`
      #     values (see #source_code_examples).
      #
      # Pass a hint to override a default or to add additional hints.
      def ui_schema(hints = nil)
        @ui_schema ||= {}
        @ui_schema.merge!(hints) if hints

        derived = {
          "DescriptionHelper:short" => description,
          "SourceCodeField:examples" => source_code_examples.presence,
        }.compact

        derived.merge(@ui_schema)
      end

      def source_code_examples
        payload = arguments.each_with_object({}) do |arg, hash|
          hash[arg.property_name] = arg.example unless arg.example.nil?
        end

        return [] if payload.empty?

        [{ title: operation_title, payload: }]
      end

      def json_schema
        {
          type: "object",
          properties: arguments.to_h { |arg| [arg.property_name, arg.to_property] },
          required: arguments.select(&:required).map(&:property_name),
          additionalProperties: false,
        }
      end
    end
  end
end
