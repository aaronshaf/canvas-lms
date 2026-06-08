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

describe DataFixup::RestoreTruncatedLtiSubmissionUrls do
  let(:limit) { Submission::INLINE_URL_LIMIT }
  let(:full_url) { "https://tool.example.com/launch/#{"a" * 300}" }
  let(:truncated) { full_url[0...limit] }
  let(:after_bug) { described_class::BUG_INTRODUCED_AT + 1.hour }

  # Builds an Lti::Result whose submission is in the corrupted-by-default state
  # (basic_lti_launch, url + body both truncated to `limit` and equal), with the
  # full url preserved in extensions. Pass overrides to exercise other branches.
  def build_result(
    submission_type: "basic_lti_launch",
    url: truncated,
    body: truncated,
    updated_at: after_bug,
    ext_submission_type: "basic_lti_launch",
    ext_submission_data: full_url,
    content_items: nil
  )
    result = lti_result_model({})
    result.submission.update_columns(submission_type:, url:, body:, updated_at:)
    ext = { "submission_type" => ext_submission_type, "submission_data" => ext_submission_data }.compact
    ext["content_items"] = content_items if content_items
    result.update_columns(extensions: { Lti::Result::AGS_EXT_SUBMISSION => ext })
    result.reload
    result
  end

  after { described_class.dry_run = false }

  describe "scope" do
    def scope_ids
      described_class.new.send(:scope).map(&:id)
    end

    it "includes a corrupted submission that has a recoverable result" do
      result = build_result
      expect(scope_ids).to include(result.id)
    end

    it "excludes healthy submissions whose body still holds the full url" do
      result = build_result(body: full_url) # body != url, body longer than limit
      expect(scope_ids).not_to include(result.id)
    end

    it "excludes submissions last written before the bug shipped" do
      result = build_result(updated_at: described_class::BUG_INTRODUCED_AT - 1.hour)
      expect(scope_ids).not_to include(result.id)
    end

    it "excludes submission types whose url isn't fed from submission_data" do
      result = build_result(submission_type: "online_upload")
      expect(scope_ids).not_to include(result.id)
    end

    it "excludes results whose extensions no longer hold a long submission_data" do
      result = build_result(ext_submission_data: "https://short.example.com")
      expect(scope_ids).not_to include(result.id)
    end
  end

  describe "#process_record" do
    let(:op) { described_class.new }

    it "restores the full url into body without changing the truncated url column" do
      result = build_result
      op.process_record(result)

      submission = result.submission.reload
      expect(submission["body"]).to eq full_url
      expect(submission["url"]).to eq truncated
      # the getter reconstructs the full url from the restored body
      expect(submission.url).to eq full_url
    end

    it "does not bump updated_at when restoring" do
      result = build_result
      expect { op.process_record(result) }.not_to change { result.submission.reload.updated_at }
    end

    it "returns a JSON change blob so record_changes can audit the recovery" do
      result = build_result
      submission = result.submission

      change = JSON.parse(op.process_record(result))

      expect(change).to eq(
        "shard_id" => Shard.current.id,
        "lti_result_id" => result.id,
        "submission_id" => submission.id,
        "submission_attempt" => submission.attempt,
        "submission_updated_at" => submission.updated_at.as_json,
        "lti_result_updated_at" => result.updated_at.as_json,
        "full_url" => full_url
      )
    end

    it "returns nil (records no change) in dry_run mode" do
      result = build_result
      described_class.dry_run = true

      expect(op.process_record(result)).to be_nil
    end

    it "captures an error report and returns a JSON error blob when the write fails" do
      result = build_result
      submission = result.submission
      relation = Submission.where(id: submission.id, body: truncated)
      allow(Submission).to receive(:where).and_call_original
      allow(Submission).to receive(:where).with(id: submission.id, body: truncated).and_return(relation)
      allow(relation).to receive(:update_all).and_raise(StandardError, "boom")
      expect(Canvas::Errors).to receive(:capture).and_return({ error_report: 99 })

      change = JSON.parse(op.process_record(result))

      expect(change).to eq(
        "shard_id" => Shard.current.id,
        "error" => "boom",
        "error_report_id" => 99
      )
    end

    it "writes nothing in dry_run mode but logs the intended change" do
      result = build_result
      described_class.dry_run = true
      expect(Rails.logger).to receive(:info).with(/\[dry-run\] would restore/).at_least(:once)

      op.process_record(result)

      expect(result.submission.reload["body"]).to eq truncated
    end

    it "reports (and does not write) when the recovered url prefix doesn't match" do
      mismatched = "https://other.example.com/#{"b" * 300}"
      result = build_result(ext_submission_data: mismatched)
      expect(Rails.logger).to receive(:warn).with(/Unrecoverable corrupted submission/).at_least(:once)

      op.process_record(result)

      expect(result.submission.reload["body"]).to eq truncated
    end

    it "reports (and does not write) when the latest result carried content_items" do
      result = build_result(content_items: [{ "type" => "file", "url" => full_url }])
      expect(Rails.logger).to receive(:warn).with(/Unrecoverable corrupted submission/).at_least(:once)

      op.process_record(result)

      expect(result.submission.reload["body"]).to eq truncated
    end
  end

  describe ".preview" do
    it "logs what it would do, writes nothing, and resets dry_run" do
      result = build_result

      described_class.preview

      expect(result.submission.reload["body"]).to eq truncated
      expect(described_class.dry_run).to be(false)
    end
  end

  describe "end to end" do
    it "recovers a corrupted submission and ignores a healthy one" do
      corrupted = build_result
      healthy = build_result(body: full_url)

      described_class.new.send(:scope).find_each { |r| described_class.new.process_record(r) }

      expect(corrupted.submission.reload["body"]).to eq full_url
      expect(healthy.submission.reload["body"]).to eq full_url # unchanged (was already full)
    end
  end
end
