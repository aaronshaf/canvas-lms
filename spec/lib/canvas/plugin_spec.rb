# frozen_string_literal: true

#
# Copyright (C) 2011 - present Instructure, Inc.
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

describe Canvas::Plugin do
  describe ".value_to_boolean" do
    it "accepts 0/1 as strings" do
      expect(Canvas::Plugin.value_to_boolean("0")).to be false
      expect(Canvas::Plugin.value_to_boolean("1")).to be true
    end

    it "accepts t/f" do
      expect(Canvas::Plugin.value_to_boolean("f")).to be false
      expect(Canvas::Plugin.value_to_boolean("t")).to be true
    end

    it "accepts nil" do
      expect(Canvas::Plugin.value_to_boolean(nil)).to be false
    end

    it "does not accept unrecognized arguments" do
      file = Tempfile.new("hello world")
      hash = { tempfile: file }
      value = ActionDispatch::Http::UploadedFile.new(hash)
      expect(Canvas::Plugin.value_to_boolean(value)).to be_nil
    end
  end

  describe "#validate_settings" do
    let(:plugin) do
      p = Canvas::Plugin.new("test_plugin")
      p.meta[:validator] = validator_name
      p
    end
    let(:plugin_setting) { PluginSetting.new(name: "test_plugin", settings: {}) }

    context "when the validator is defined directly under Canvas::Plugins::Validators" do
      let(:validator_name) { "FakeNamespacedValidator" }

      before do
        stub_const("Canvas::Plugins::Validators::FakeNamespacedValidator",
                   Module.new { def self.validate(settings, _unused) = settings })
      end

      it "calls the namespaced validator" do
        expect(plugin.validate_settings(plugin_setting, { foo: "bar" })).to be_truthy
        expect(plugin_setting.settings[:foo]).to eq "bar"
      end
    end

    context "when the validator name resolves only via inherited constant lookup" do
      let(:validator_name) { "Kernel" }

      it "rejects top-level constants and records an error" do
        expect(plugin.validate_settings(plugin_setting, { foo: "bar" })).to be false
        expect(plugin_setting.errors[:base].join).to include("provided validator Kernel failed to load")
      end
    end
  end
end
