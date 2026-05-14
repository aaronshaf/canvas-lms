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

describe WebMockHelpers do
  let(:webmock_config) { WebMock::Config.instance }

  around do |example|
    prior_allow_net_connect = webmock_config.allow_net_connect
    prior_allow_localhost = webmock_config.allow_localhost
    prior_allow = webmock_config.allow
    begin
      example.run
    ensure
      webmock_config.allow_net_connect = prior_allow_net_connect
      webmock_config.allow_localhost = prior_allow_localhost
      webmock_config.allow = prior_allow
    end
  end

  describe ".with_webmock_config_snapshot" do
    it "restores all three connect-state attrs after the block returns" do
      WebMock.disable_net_connect!(allow_localhost: true, allow: %w[fake-s3])
      WebMockHelpers.with_webmock_config_snapshot do
        WebMock.allow_net_connect!
        webmock_config.allow_localhost = false
        webmock_config.allow = %w[other]
      end
      expect(webmock_config.allow_net_connect).to be false
      expect(webmock_config.allow_localhost).to be true
      expect(webmock_config.allow).to eq(%w[fake-s3])
    end

    it "restores all three attrs when the block raises" do
      WebMock.disable_net_connect!(allow_localhost: true, allow: %w[fake-s3])
      expect do
        WebMockHelpers.with_webmock_config_snapshot do
          WebMock.allow_net_connect!
          webmock_config.allow_localhost = false
          webmock_config.allow = %w[other]
          raise "boom"
        end
      end.to raise_error("boom")
      expect(webmock_config.allow_net_connect).to be false
      expect(webmock_config.allow_localhost).to be true
      expect(webmock_config.allow).to eq(%w[fake-s3])
    end

    it "returns the block's return value" do
      result = WebMockHelpers.with_webmock_config_snapshot { 42 }
      expect(result).to eq(42)
    end

    it "restores correctly when calls are nested" do
      WebMock.disable_net_connect!(allow_localhost: true, allow: %w[outer])
      WebMockHelpers.with_webmock_config_snapshot do
        WebMock.disable_net_connect!(allow_localhost: false, allow: %w[middle])
        WebMockHelpers.with_webmock_config_snapshot do
          WebMock.allow_net_connect!
          webmock_config.allow = %w[inner]
        end
        expect(webmock_config.allow_net_connect).to be false
        expect(webmock_config.allow_localhost).to be false
        expect(webmock_config.allow).to eq(%w[middle])
      end
      expect(webmock_config.allow_net_connect).to be false
      expect(webmock_config.allow_localhost).to be true
      expect(webmock_config.allow).to eq(%w[outer])
    end
  end

  describe "#with_real_network" do
    it "permits net connect within the block" do
      WebMock.disable_net_connect!(allow_localhost: true)
      observed = nil
      with_real_network { observed = webmock_config.allow_net_connect }
      expect(observed).to be true
    end

    it "restores the prior strict state on normal exit" do
      WebMock.disable_net_connect!(allow_localhost: true)
      with_real_network { :noop }
      expect(webmock_config.allow_net_connect).to be false
      expect(webmock_config.allow_localhost).to be true
    end

    it "restores the prior permissive state on normal exit" do
      WebMock.allow_net_connect!
      with_real_network { :noop }
      expect(webmock_config.allow_net_connect).to be true
    end

    it "restores state even when the block raises" do
      WebMock.disable_net_connect!(allow_localhost: true)
      expect do
        with_real_network { raise "boom" }
      end.to raise_error("boom")
      expect(webmock_config.allow_net_connect).to be false
      expect(webmock_config.allow_localhost).to be true
    end

    it "restores a configured allow list on exit" do
      WebMock.disable_net_connect!(allow_localhost: true, allow: %w[fake-s3])
      with_real_network { :noop }
      expect(webmock_config.allow_net_connect).to be false
      expect(webmock_config.allow_localhost).to be true
      expect(webmock_config.allow).to eq(%w[fake-s3])
    end

    it "restores correctly when calls are nested" do
      WebMock.disable_net_connect!(allow_localhost: true)
      inner_state = nil
      with_real_network do
        with_real_network { inner_state = webmock_config.allow_net_connect }
        expect(webmock_config.allow_net_connect).to be true
      end
      expect(inner_state).to be true
      expect(webmock_config.allow_net_connect).to be false
      expect(webmock_config.allow_localhost).to be true
    end
  end
end
