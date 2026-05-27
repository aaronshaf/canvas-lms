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

# This class is used to count how many times a request is made to each API
# endpoints while our tests are running.
# If tests are running in parallel (as they do in Jenkins), each worker
# will have its own separate count and its own separate output.
# EndpointHitCounter::Formatter is an rspec formatter that will print out
# the count of each worker when tests are done running.
# (We may want to aggregate these. Perhaps go with outputting a JSON
# object later, so that they can more easily be merged?)
module EndpointHitCounter
  @counts = {}

  class << self
    attr_reader :counts

    def record(method, url)
      method = method.to_s.upcase
      @counts[url] ||= {}
      @counts[url][method] = 0 unless @counts[url][method]
      @counts[url][method] += 1
    end
  end

  module Tracker
    %i[get post put delete].each do |verb|
      define_method(verb) do |path, **args|
        super(path, **args)
      ensure
        pattern = request.route_uri_pattern
        EndpointHitCounter.record(verb, request.route_uri_pattern) if pattern
      end
    end
  end

  class Formatter
    ::RSpec::Core::Formatters.register self, :close

    def initialize(output)
      @output = output
    end

    def close(_notification)
      return if EndpointHitCounter.counts.empty?

      sorted = EndpointHitCounter.counts.sort_by { |_url, verbs| -verbs.values.sum }

      @output.puts
      @output.puts "=== Endpoint hit counts for #{sorted.size} unique endpoints ==="
      sorted.each do |endpoint, verbs|
        total = verbs.values.sum
        @output.puts format("%6d  %s", total, endpoint)
        %w[GET POST PUT DELETE PATCH].each do |verb|
          count = verbs[verb]
          next unless count

          @output.puts format("  %6d %-6s", count, verb)
        end
      end
    end
  end
end
