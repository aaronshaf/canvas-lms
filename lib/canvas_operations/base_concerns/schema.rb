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
      Argument = Data.define(:name, :type, :required, :title, :description, :default) do
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
          active_record_type? ? :"#{name}_id" : name
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

      def argument(name, type:, required: false, title: nil, description: nil, default: nil)
        arguments << Argument.new(name:, type:, required:, title:, description:, default:)
      end

      def operation_schema
        @operation_schema ||= {
          id: operation_name,
          title: operation_title,
          description:,
          schema: json_schema,
          ui_schema:,
        }
      end

      private

      def description(value = nil)
        @description = value unless value.nil?
        @description
      end

      def arguments
        @arguments ||= []
      end

      def ui_schema(hints = nil)
        @ui_schema ||= {}
        @ui_schema.merge!(hints) if hints
        @ui_schema
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
