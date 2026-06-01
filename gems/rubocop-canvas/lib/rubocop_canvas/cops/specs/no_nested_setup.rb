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

module RuboCop
  module Cop
    module Specs
      # Bans nested `before` / `let` / `subject` composition: a hook-bearing
      # example group may not contain another hook-bearing example group.
      # Pure-grouping nested describes/contexts (no hooks) remain allowed.
      #
      # Why: when hooks live at multiple nesting levels, the reader has to
      # compose them outside-in across ancestors, and composition errors don't
      # point at any single hook. Every setup-related flake fix in Canvas
      # request/controller specs over the last ~2 years involved interaction
      # across composed layers; the clearest pattern is `let`-memoization
      # after a deeper `before` mutates the value. Stock `RSpec/NestedGroups`
      # caps depth without distinguishing hook-bearing groups from pure-
      # grouping ones, so it can't target this.
      #
      #   # Flagged
      #   describe "courses" do
      #     let(:course) { course_factory }
      #     context "when published" do
      #       before { course.publish! }
      #       it "..." do; end
      #     end
      #   end
      #
      #   # Allowed (single-level)
      #   describe "courses (published)" do
      #     let(:course) { course_factory.tap(&:publish!) }
      #     it "..." do; end
      #   end
      #
      # Disabled by default; opt in per-directory via scoped `.rubocop.yml`
      class NoNestedSetup < Base
        MSG = "Do not declare `before`/`let`/`subject` inside a nested example " \
              "group when an ancestor group also declares one."

        HOOK_METHODS = %i[before let let! subject subject!].freeze
        GROUP_METHODS = %i[describe context feature example_group xdescribe xcontext fdescribe fcontext].freeze
        # Shared-group DSLs are inert until `include_examples` / `include_context`
        # composes them at a call site we can't resolve statically, so we treat
        # them as scope-breakers: hooks inside don't compose with the lexically
        # enclosing example group.
        SHARED_GROUP_METHODS = %i[shared_examples shared_examples_for shared_context].freeze

        def on_block(node)
          return unless hook_call?(node)

          found_self_group = false
          ancestor_has_hook = false

          node.each_ancestor(:block) do |ancestor|
            return if shared_group?(ancestor)
            next unless example_group?(ancestor)

            unless found_self_group
              found_self_group = true
              next
            end

            if direct_hook?(ancestor)
              ancestor_has_hook = true
              break
            end
          end

          return unless found_self_group

          add_offense(node, severity: :warning) if ancestor_has_hook
        end

        private

        def hook_call?(block_node)
          send_node = block_node.send_node
          return false unless send_node.receiver.nil?

          HOOK_METHODS.include?(send_node.method_name)
        end

        def example_group?(block_node)
          group_method?(block_node, GROUP_METHODS)
        end

        def shared_group?(block_node)
          group_method?(block_node, SHARED_GROUP_METHODS)
        end

        def group_method?(block_node, methods)
          send_node = block_node.send_node
          return false unless send_node.is_a?(::RuboCop::AST::SendNode)

          methods.include?(send_node.method_name)
        end

        # Does this group directly declare any hook (not via a nested group)?
        def direct_hook?(group)
          body = group.body
          return false unless body

          if body.begin_type?
            body.children.any? { |child| hook_block?(child) }
          else
            hook_block?(body)
          end
        end

        def hook_block?(node)
          node.is_a?(::RuboCop::AST::BlockNode) && hook_call?(node)
        end
      end
    end
  end
end
