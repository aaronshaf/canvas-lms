# frozen_string_literal: true

#
# Copyright (C) 2016 - present Instructure, Inc.
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
      # most of this has been stolen from:
      # https://github.com/nevir/rubocop-rspec/blob/master/lib/rubocop/rspec/top_level_describe.rb
      # https://github.com/nevir/rubocop-rspec/blob/9aa33ee7014e8d6d580b12fe2651b32ccdaa7a92/lib/rubocop/cop/rspec/file_path.rb
      class EnsureSpecExtension < Base
        include RuboCop::Cop::FileMeta

        MSG = "Spec files need to end with \"_spec.rb\" for rspec to find and run them."

        METHODS = [:context, :describe].freeze

        def on_send(node)
          return if named_as_spec?
          return unless top_level_describe?(node)

          add_offense node, message: MSG
        end

        private

        def top_level_describe?(node)
          _receiver, method_name, *_args = *node
          return false unless METHODS.include?(method_name)

          top_level_nodes.include?(node)
        end

        def top_level_nodes
          top_level_statements.filter_map do |statement|
            # A bare `describe Foo` send (without a block).
            next statement if describe_statement?(statement)

            # A `describe Foo do ... end` (or `RSpec.describe Foo do ... end`) block.
            # We only consider the block's own send node -- we deliberately do not
            # descend into the block body, since describe/context nested inside a
            # different DSL (e.g. `shared_examples`/`shared_context`) is not a top
            # level spec definition.
            next statement.children[0] if statement.type == :block && describe_statement?(statement.children[0])

            nil
          end
        end

        # The statements at the top level of the file. When the file has more than
        # one top level statement they are wrapped in a `begin` node; otherwise the
        # single statement is the root itself.
        def top_level_statements
          (root_node.type == :begin) ? node_children(root_node) : [root_node]
        end

        def describe_statement?(node)
          node.type == :send && METHODS.include?(node.children[1])
        end

        def node_children(node)
          node.children.grep(Parser::AST::Node)
        end

        def root_node
          processed_source.ast
        end
      end
    end
  end
end
