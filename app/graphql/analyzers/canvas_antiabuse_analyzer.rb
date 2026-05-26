# frozen_string_literal: true

#
# Copyright (C) 2025 - present Instructure, Inc.
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

module Analyzers
  class CanvasAntiabuseAnalyzer < BaseAnalyzer
    def initialize(subject)
      super
      @alias_count = 0
      @directive_count = 0
      @mutation_count = 0
    end

    def on_leave_field(node, _parent, _visitor)
      @alias_count += 1 if node.alias
      @directive_count += node.directives.length unless node.directives.empty?
    end

    def on_enter_operation_definition(node, _parent, _visitor)
      if node.operation_type == "mutation"
        @mutation_count += node.selections.length
      end
    end

    def result
      if @alias_count > GraphQLTuning.max_query_aliases
        InstStatsd::Statsd.distribution("graphql.excessive_alias_count", @alias_count)
        return GraphQL::AnalysisError.new("max query aliases exceeded")
      end

      if @directive_count > GraphQLTuning.max_query_directives
        InstStatsd::Statsd.distribution("graphql.excessive_directive_count", @directive_count)
        return GraphQL::AnalysisError.new("max query directives exceeded")
      end

      if @mutation_count > GraphQLTuning.max_mutations
        InstStatsd::Statsd.distribution("graphql.excessive_mutation_count", @mutation_count)
        if Account.site_admin.feature_enabled?(:graphql_mutation_limit)
          GraphQL::AnalysisError.new("max mutations per request exceeded")
        end
      end
    end
  end
end
