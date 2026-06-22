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

# Shared builders for New Quizzes availability & timing request specs
# (spec/requests/integration/nq_availability_timing_spec.rb). These construct
# the New Quizzes external tool, an external-tool assignment carrying Canvas
# date constraints, and read back the date custom params Canvas pushes to the
# New Quizzes service through a sessionless LTI launch.
#
# Cross-service contract: Canvas resolves the effective (override-aware) dates,
# blocks the student launch when the assignment is locked, and expands
# unlock_at/lock_at/due_at into the custom_canvas_assignment_* launch params
# that quiz_lti enforces its lock window with and forwards to quiz_api for
# auto-submit and session capping.
require_relative "nq_helpers"

module NQAvailabilityTimingHelpers
  include NQHelpers

  # This cluster overrides the shared tool registration: it needs custom fields
  # that expand the assignment's effective dates into the launch payload, which
  # the domain-only NQHelpers#create_nq_tool does not carry.
  def create_nq_tool(course)
    tool = course.context_external_tools.new(
      name: "Quizzes 2",
      consumer_key: "test_key",
      shared_secret: "test_secret",
      tool_id: "Quizzes 2",
      url: "http://www.example.com/basic_lti",
      privacy_level: "public"
    )
    # Field names mirror the real "Quizzes 2" registration: Canvas prefixes each
    # with "custom_", so these expand into custom_canvas_assignment_unlock_at /
    # _lock_at / _due_at — the exact launch params quiz_lti's ParamsService reads.
    tool.settings["custom_fields"] = {
      "canvas_assignment_unlock_at" => "$Canvas.assignment.unlockAt.iso8601",
      "canvas_assignment_lock_at" => "$Canvas.assignment.lockAt.iso8601",
      "canvas_assignment_due_at" => "$Canvas.assignment.dueAt.iso8601"
    }
    tool.save!
    tool
  end

  # Reuses the shared external-tool assignment builder, layering on the Canvas
  # date constraints under test. The tag points at the tool's own launch url
  # (tool.url) rather than the domain default, since this cluster's tool is
  # registered by url.
  def create_nq_assignment(course, tool, title: "NQ Quiz", unlock_at: nil, lock_at: nil, due_at: nil)
    create_nq_external_tool_assignment(
      course,
      tool,
      title:,
      launch_url: tool.url,
      unlock_at:,
      lock_at:,
      due_at:
    )
  end

  # The sessionless-launch JSON only returns a URL containing a verifier; the
  # expanded launch payload (including the date custom params) is cached in
  # Redis under that verifier. This reads it back the way the launch endpoint
  # would, returning the tool_settings hash that carries the custom params.
  def read_launch_tool_settings(course, launch_url)
    verifier = Rack::Utils.parse_query(URI(launch_url).query)["verifier"]
    redis_key = "#{course.class.name}:#{Lti::RedisMessageClient::SESSIONLESS_LAUNCH_PREFIX}#{verifier}"
    JSON.parse(Canvas.redis.get(redis_key))["tool_settings"]
  end

  # The native New Quizzes launch (NewQuizzesController#launch, gated by the
  # new_quizzes_native_experience flag) does not round-trip through Redis like the
  # sessionless launch. It renders the app shell and exposes the expanded launch
  # payload as ENV.NEW_QUIZZES.params. This reads back the same custom_canvas_*
  # date params from that payload, so the native path can be asserted with the
  # same custom_canvas_assignment_* keys read_launch_tool_settings uses for the
  # sessionless path. Requires RequestHelper (included for type: :request).
  def read_native_launch_params(response)
    js_env_from_response(response).dig("NEW_QUIZZES", "params") || {}
  end
end
