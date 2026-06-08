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

# Recover submission urls that were truncated by the INTEROP-10688 regression.
#
# Long LTI AGS submission_data urls are stored truncated in submissions.url, with
# the full value kept in submissions.body for the Submission#url getter to rebuild.
# While the bug was in prod, a second save in the same request re-stashed the
# already-truncated url over body, destroying the full-url backup (and the version
# snapshots). The full url still survives untruncated in the matching
# Lti::Result#extensions (a jsonb column the truncation never touched), so we
# restore submissions.body from there.
#
# We iterate lti_results (small) rather than submissions (huge) -- the framework
# paginates over scope.klass's id space -- and eager_load the submission so the
# whole corruption signature is filtered in one joined query (no per-record load):
# submission_type basic_lti_launch/online_url, url and body both exactly
# INLINE_URL_LIMIT chars, body == url, last written after the bug shipped; and the
# result carries a submission_data longer than that.
#
# Note: this only reaches submissions that still have a usable Lti::Result. AGS
# submissions whose extensions were wiped by a later score-only call, and non-AGS
# url submissions (student online_url, LTI 1.1), have no recovery source here and
# are not visited -- those need request logs or a tool re-send.
#
# Note: we fix only the live submissions.body, not the (also-truncated) version
# snapshots, so Submission#url is correct but submission_history may still show the
# truncated url. Repairing versions isn't worth a full versioned save (callbacks,
# notifications, live events) over the whole batch.
class DataFixup::RestoreTruncatedLtiSubmissionUrls < CanvasOperations::DataFixup
  self.mode = :individual_record
  self.progress_tracking = false
  self.record_changes = true

  # When true, process_record logs what it would do but writes nothing. Used by
  # .preview for a console dry run; the real (job) run leaves it false.
  class_attribute :dry_run, default: false, instance_writer: false

  # The bug reached production with the 2026-06-02 15:30 UTC deploy. A submission
  # last written before that time can't have been corrupted by it, so we skip it.
  # This is an optimization/guard on top of the signature below; the signature is
  # what actually identifies corrupted rows. (INTEROP-10688)
  BUG_INTRODUCED_AT = Time.utc(2026, 6, 2, 15, 30, 0)

  scope do
    Lti::Result
      .joins(:submission)
      .preload(:submission)
      .where(submissions: { submission_type: %w[basic_lti_launch online_url], updated_at: BUG_INTRODUCED_AT.. })
      .where(
        "char_length(submissions.url) = :limit AND char_length(submissions.body) = :limit AND submissions.body = submissions.url",
        limit: Submission::INLINE_URL_LIMIT
      )
      .where(
        "char_length(lti_results.extensions #>> ARRAY[?, 'submission_data']) > ?",
        Lti::Result::AGS_EXT_SUBMISSION,
        Submission::INLINE_URL_LIMIT
      )
  end

  # Log what the fixup would do on the current shard without writing anything or
  # enqueuing jobs. Drives the framework's own range/batch iteration (the same
  # find_ids_in_ranges + process_range the real run uses), just inline rather than
  # via delayed jobs -- so it can't be a true async run and the dry_run flag is
  # honored in-process. Activate the shard first, e.g. from a rails console:
  #   Shard.find(123).activate { DataFixup::RestoreTruncatedLtiSubmissionUrls.preview }
  def self.preview(start_from: 0)
    previous = dry_run
    self.dry_run = true
    op = new(switchman_shard: Shard.current)
    op.send(:scope).klass.where("id > ?", start_from).find_ids_in_ranges(batch_size: 5_000, loose: true) do |min_id, max_id|
      op.send(:process_range, min_id, max_id) if op.send(:process_batch?, min_id, max_id)
    end
  ensure
    self.dry_run = previous
  end

  def process_record(result)
    submission = result.submission
    return unless submission # defensive; the join requires a matching submission

    truncated = submission["url"]
    full_url = recoverable_url(result, truncated)
    unless full_url
      report_unrecoverable(submission, "Lti::Result #{result.global_id} extensions did not yield a matching submission_data")
      return
    end

    if dry_run
      log_message("[dry-run] would restore full url in body for submission #{submission.global_id} (#{full_url.length} chars): #{full_url}")
      return
    end

    # Conditional update guards against a concurrent write changing body between
    # when we loaded the row and now: we only restore if body is still the exact
    # truncated value we saw (the prefix the getter rebuilds from). update_all
    # emits a single atomic UPDATE ... WHERE id = ? AND body = ?, and like
    # update_columns it skips validations/callbacks (so validate_single_submission
    # can't re-truncate) and doesn't bump updated_at. url stays truncated and the
    # Submission#url getter rebuilds the full value from body.
    rows = Submission.where(id: submission.id, body: truncated).update_all(body: full_url)
    if rows.zero?
      report_unrecoverable(submission, "submission #{submission.global_id} body changed since load; skipped to avoid clobbering a concurrent write")
      return
    end
    log_message("Restored full url in body for submission #{submission.global_id} (#{full_url.length} chars)")

    # Returned so record_changes can persist it to the recovery audit attachment.
    # One JSON object per restored row, with everything needed to identify the
    # record and the full url we wrote.
    {
      shard_id: Shard.current.id,
      lti_result_id: result.id,
      submission_id: submission.id,
      submission_attempt: submission.attempt,
      submission_updated_at: submission.updated_at,
      lti_result_updated_at: result.updated_at,
      full_url:
    }.to_json
  rescue => e
    error_report_id = Canvas::Errors.capture(
      e,
      { tags: { operation: self.class.operation_name, shard_id: Shard.current.id } },
      :error
    )[:error_report]
    log_message("Error restoring url from Lti::Result #{result.global_id}: #{e.message}", level: :error)

    # Returned so the failure lands in the record_changes audit too, alongside the
    # successful recoveries, with enough to find the captured error report.
    {
      shard_id: Shard.current.id,
      error: e.message,
      error_report_id:
    }.to_json
  end

  private

  # The full url to restore, or nil if this result's extensions can't safely recover
  # it. The prefix guard ensures the recovered value matches what's still stored (so
  # the url getter will reconstruct it, and so we know this extension corresponds to
  # this submission's url, not a later, different attempt).
  def recoverable_url(result, truncated)
    ext = result.extensions&.dig(Lti::Result::AGS_EXT_SUBMISSION)
    return unless ext.is_a?(Hash)
    # content_items force submission_type to online_upload, so submission_data never
    # fed submissions.url in that case.
    return if ext["content_items"].present?
    return unless %w[basic_lti_launch online_url].include?(ext["submission_type"])

    full_url = ext["submission_data"]
    return unless full_url.is_a?(String) && full_url.length > Submission::INLINE_URL_LIMIT
    return unless full_url[0...Submission::INLINE_URL_LIMIT] == truncated

    full_url
  end

  # Corrupted submissions we can't restore from this result's extensions; logged so
  # they can be handled via request logs (within retention) or a tool re-send.
  def report_unrecoverable(submission, reason)
    log_message("Unrecoverable corrupted submission #{submission.global_id}: #{reason}", level: :warn)
  end
end
