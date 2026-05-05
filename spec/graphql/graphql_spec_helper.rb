# frozen_string_literal: true

#
# Copyright (C) 2019 - present Instructure, Inc.
#
# This file is part of Canvas.
#
# Canvas is free software: you can redistribute it and/or modify it under the
# terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
#

require_relative "../helpers/graphql_type_tester"

module GraphQLSpecHelper
  def gql_arguments(*args, **options)
    (args + options.map { |k, v| "#{k.to_s.camelize(:lower)}: #{v.to_json}" }).join(", ")
  end

  # Executes a GraphQL mutation against CanvasSchema and returns the result as a HashWithIndifferentAccess.
  #
  # If current_user is provided in the context, current_principal will be inferred.
  #
  # @param query [String, Hash] the GraphQL mutation string, or a Hash of options to pass to a
  #   spec-local `mutation_str` builder method
  # @param variables [Hash, nil] optional variables to pass alongside the query (for `$var: Type` arguments)
  # @param context [Hash] additional context keys (e.g. `domain_root_account:`, `session:`, `request:`)
  #   that override or supplement the defaults. Defaults: `request:` is an ActionDispatch::TestRequest
  #   and `session:` is an empty hash.
  # @return [ActiveSupport::HashWithIndifferentAccess]
  def run_mutation(query = nil, variables: nil, context: {}, **additional_context)
    query = mutation_str(**query) unless query.is_a?(String)
    context.reverse_merge!(
      request: ActionDispatch::TestRequest.create,
      session: {}
    ).merge!(additional_context)
    context[:current_principal] ||= context[:current_user] && Canvas::AdheresToPolicy::UserPrincipal.new(context[:current_user])

    CanvasSchema.execute(query, context:, variables:).to_h.with_indifferent_access
  end
end

RSpec.configure do |config|
  config.define_derived_metadata(file_path: %r{spec/graphql/}) do |metadata|
    metadata[:graphql] = true
  end

  config.include GraphQLSpecHelper, :graphql
end
