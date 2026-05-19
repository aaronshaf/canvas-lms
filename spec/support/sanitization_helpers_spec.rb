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

describe SanitizationHelpers do
  def fake_record(returns:, save: true, errors: [])
    double(
      :[]= => nil,
      :[] => returns,
      :save => save,
      :reload => nil,
      :errors => double(full_messages: errors)
    )
  end

  describe "#expect_sanitization_on_save" do
    it "passes when sanitization strips XSS and keeps the MARKER" do
      expect do
        expect_sanitization_on_save(fake_record(returns: "<p>MARKER</p>"), :body)
      end.not_to raise_error
    end

    describe "every XSS_PAYLOADS entry trips at least one assertion when sanitization is disabled" do
      SanitizationHelpers::XSS_PAYLOADS.each do |label, payload|
        it "trips on the \"#{label}\" payload" do
          expect do
            expect_sanitization_on_save(fake_record(returns: payload), :body, payloads: { label => payload })
          end.to raise_error(RSpec::Expectations::ExpectationNotMetError, /#{Regexp.escape(label)}/)
        end
      end
    end

    describe "individual assertion firing" do
      it "fails when a <script> tag survives" do
        payload = "<p>MARKER</p><script>x</script>"
        expect do
          expect_sanitization_on_save(fake_record(returns: payload), :body, payloads: { "bare script" => payload })
        end.to raise_error(RSpec::Expectations::ExpectationNotMetError, /<script> survived/)
      end

      it "fails when a javascript: scheme survives" do
        payload = '<p>MARKER</p><a href="javascript:x">y</a>'
        expect do
          expect_sanitization_on_save(fake_record(returns: payload), :body, payloads: { "bare js scheme" => payload })
        end.to raise_error(RSpec::Expectations::ExpectationNotMetError, /javascript: scheme survived/)
      end

      it "fails when an event-handler attribute survives" do
        payload = '<p>MARKER</p><img onerror="x">'
        expect do
          expect_sanitization_on_save(fake_record(returns: payload), :body, payloads: { "bare onerror" => payload })
        end.to raise_error(RSpec::Expectations::ExpectationNotMetError, /event handler attribute survived/)
      end

      it "fails when a srcdoc attribute survives" do
        payload = '<p>MARKER</p><iframe srcdoc="x"></iframe>'
        expect do
          expect_sanitization_on_save(fake_record(returns: payload), :body, payloads: { "bare srcdoc" => payload })
        end.to raise_error(RSpec::Expectations::ExpectationNotMetError, /srcdoc attribute survived/)
      end

      it "fails when the MARKER is stripped (over-sanitization)" do
        expect do
          expect_sanitization_on_save(fake_record(returns: ""), :body, payloads: { "anything" => "<p>MARKER</p>x" })
        end.to raise_error(RSpec::Expectations::ExpectationNotMetError, /benign marker stripped/)
      end
    end

    it "raises a descriptive RuntimeError when the record fails to save" do
      expect do
        expect_sanitization_on_save(
          fake_record(returns: "anything", save: false, errors: ["Body can't be blank"]),
          :body
        )
      end.to raise_error(
        RuntimeError,
        /expect_sanitization_on_save: .* invalid for body.*Body can't be blank/
      )
    end
  end
end
