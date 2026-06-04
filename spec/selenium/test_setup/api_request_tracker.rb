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

require "json"
require "uri"

# Tracks the Canvas API requests the browser issues while a Selenium test
# runs, using the Chrome DevTools Protocol.
#
# Set API_REQUEST_TRACKER=1 to enable.
#
# Works by using the Network.requestWillBeSent event
# (https://chromedevtools.github.io/devtools-protocol/tot/Network/#event-requestWillBeSent)
# and then saving the result a hash, then writes the hash to a json file in
# log/selenium_api_requests.json.
#
module ApiRequestTracker
  # We only want to log requests that went to an api endpoint. Use this regex to look for urls
  # that start with /api/. We can ignore other requests, like images and CSS files.
  API_PATH = %r{/api/}

  class << self
    def output_path
      ENV["TRACK_API_REQUESTS_PATH"].presence || Rails.root.join("log/selenium_api_requests.json").to_s
    end

    # Attach the CDP Network listener to the given driver.
    def attach(driver)
      return if driver.nil? || @attached_to.equal?(driver)

      devtools = driver.devtools
      devtools.network.enable
      devtools.network.on(:request_will_be_sent) { |params| record(params) }
      @attached_to = driver
    rescue => e
      # Fail silently for now.
      warn "ApiRequestTracker: could not attach CDP listener (#{e.class}: #{e.message}); tracking disabled"
    end

    # Begin recording for a new example, discarding anything buffered from a
    # prior one. This does mean that, if the test exits very quickly, we may miss an API call made
    # at the very end of the test. This is fine for v1.
    #
    # Specify app_host here so that we can ignore requests to any other host.
    def start_recording(app_host)
      @app_host = app_host
      @buffer = []
    end

    # Stop recording and add request log to the report.
    def finish_example(example)
      requests = (@buffer || []).dup

      return if requests.empty?

      report << {
        full_description: example.full_description,
        location: example.location,
        requests:,
      }
    end

    def write_report
      return if report.empty?

      File.write(output_path, JSON.pretty_generate(examples: report))
      report.sum { |e| e[:requests].size }
    end

    private

    def record(params)
      request = params["request"] || {}
      url = request["url"]
      return unless api_request?(url)

      (@buffer ||= []) << {
        method: request["method"],
        url:,
        type: params["type"], # This will be "Fetch" if the request was made with fetch(),
        # or XHR if the request was made with XMLHttpRequest(). The
        # frontend arch guild was interested in converting everything
        # to fetch(); they may find this useful.
      }
    end

    # Returns true if url is for an API call. We're defining an API call as anything made
    # to the local test server (created in selenium_driver_setup.rb), where the URL path
    # starts with /api.
    def api_request?(url)
      return false if url.nil?

      uri = URI.parse(url)
      return false unless uri.path&.match?(API_PATH)
      return false if @app_host && uri.host && "#{uri.host}:#{uri.port}" != @app_host

      true
    rescue URI::InvalidURIError
      false
    end

    def report
      @report ||= []
    end
  end
end
