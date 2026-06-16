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

# Security-contact data delivery
#
# One-off incident-response tool: hands each impacted institution's S3 data dump
# to its active SecurityContact via ShareFile, then writes a CSV audit report.
# Not part of request/response traffic; run with the Canvas Rails environment:
#
#   bundle exec rails runner script/security_contact_delivery.rb [--live]
#
# Defaults to --dry-run; pass --live to actually upload + share.
#
# CONFIG (environment variables):
#   S3_BUCKET                 bucket holding the dumps
#   S3_PREFIX                 optional root prefix under the bucket (default "")
#   AWS_REGION                e.g. us-east-1
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY   (or use an instance role)
#
#   SHAREFILE_SUBDOMAIN       e.g. "instructure" for instructure.sharefile.com
#   SHAREFILE_CLIENT_ID       OAuth2 app key  (from Danny Gunn / Ryan Norton)
#   SHAREFILE_CLIENT_SECRET   OAuth2 app secret
#   SHAREFILE_USERNAME        service account
#   SHAREFILE_PASSWORD        service account password
#   SHAREFILE_PARENT_FOLDER   ShareFile folder id to create per-institution
#                             subfolders under (e.g. the "home" folder id)
#
#   REPORT_PATH               where to write the CSV (default tmp/<ts>.csv)
#
# NOTE: the ShareFile endpoint shapes below follow api.sharefile.com/guides and
# MUST be verified against the real tenant + credentials before a live run.
# Marked with "VERIFY:" throughout.

require "net/http"
require "uri"
require "json"
require "csv"
require "securerandom"
require "optparse"

module SecurityContactDelivery
  class Config
    attr_reader :live,
                :s3_bucket,
                :s3_prefix,
                :aws_region,
                :sf_subdomain,
                :sf_client_id,
                :sf_client_secret,
                :sf_username,
                :sf_password,
                :sf_parent_folder,
                :report_path

    def initialize(argv)
      @live = false
      OptionParser.new do |o|
        o.banner = "Usage: rails runner script/security_contact_delivery.rb [--live]"
        o.on("--live", "Actually upload + share (default is dry-run)") { @live = true }
      end.parse!(argv)

      @s3_bucket        = env!("S3_BUCKET")
      @s3_prefix        = ENV["S3_PREFIX"].to_s
      @aws_region       = ENV["AWS_REGION"] || "us-east-1"

      @sf_subdomain     = env!("SHAREFILE_SUBDOMAIN")
      @sf_client_id     = env!("SHAREFILE_CLIENT_ID")
      @sf_client_secret = env!("SHAREFILE_CLIENT_SECRET")
      @sf_username      = env!("SHAREFILE_USERNAME")
      @sf_password      = env!("SHAREFILE_PASSWORD")
      @sf_parent_folder = env!("SHAREFILE_PARENT_FOLDER")

      @report_path      = ENV["REPORT_PATH"] || Rails.root.join("tmp", "security_contact_delivery_#{Time.now.utc.strftime("%Y%m%d%H%M%S")}.csv").to_s
    end

    private

    def env!(key)
      ENV[key].presence || raise("missing required env var #{key}")
    end
  end

  # Thin S3 reader. The bucket is partitioned one prefix per institution, where
  # the prefix is the institution's root-account UUID:
  #   s3://<bucket>/<root_account_uuid>/<file>...
  class DumpSource
    Partition = Struct.new(:uuid, :keys, keyword_init: true)

    def initialize(config)
      require "aws-sdk-s3"
      @bucket = config.s3_bucket
      @prefix = config.s3_prefix
      @client = Aws::S3::Client.new(region: config.aws_region)
    end

    # Returns [Partition(uuid:, keys: [<s3 key>, ...]), ...], one per UUID
    # directory found directly under the configured prefix.
    def partitions
      grouped = Hash.new { |h, k| h[k] = [] }
      @client.list_objects_v2(bucket: @bucket, prefix: @prefix).each do |page|
        Array(page.contents).each do |obj|
          uuid = partition_uuid(obj.key)
          next unless uuid

          grouped[uuid] << obj.key
        end
      end
      grouped.map { |uuid, keys| Partition.new(uuid:, keys:) }
    end

    # Streams an object to a Tempfile and yields it; cleans up after.
    def with_downloaded_object(key)
      tmp = Tempfile.new("sc_delivery", binmode: true)
      @client.get_object(bucket: @bucket, key:, response_target: tmp.path)
      yield tmp
    ensure
      tmp&.close
      tmp&.unlink
    end

    private

    # First path segment after the configured prefix is the UUID partition.
    def partition_uuid(key)
      rest = key.delete_prefix(@prefix).delete_prefix("/")
      seg = rest.split("/").first
      seg.presence
    end
  end

  # Minimal ShareFile v3 client (OAuth2 password grant).
  # Docs: https://api.sharefile.com/guides/usecases
  class ShareFileClient
    def initialize(config)
      @config = config
      @token = nil
      @apicp = nil # API control-plane host returned by the token endpoint
    end

    def authenticate!
      uri = URI("https://#{@config.sf_subdomain}.sharefile.com/oauth/token")
      res = post_form(uri, {
                        grant_type: "password",
                        client_id: @config.sf_client_id,
                        client_secret: @config.sf_client_secret,
                        username: @config.sf_username,
                        password: @config.sf_password
                      })
      body = JSON.parse(res.body)
      @token = body.fetch("access_token")
      # VERIFY: token response returns "subdomain" + "apicp"; api base is
      # https://<subdomain>.<apicp>/sf/v3
      @apicp = "#{body["subdomain"]}.#{body["apicp"]}"
      self
    end

    # Creates (or returns) a subfolder under the configured parent, named for
    # the institution. Returns the folder id.
    # VERIFY: POST /sf/v3/Items(<parentId>)/Folder  body {Name, Overwrite:false}
    def ensure_folder(name)
      res = post_json(api_uri("Items(#{@config.sf_parent_folder})/Folder", overwrite: false),
                      { Name: name, Description: "Security data delivery #{name}" })
      JSON.parse(res.body).fetch("Id")
    end

    # Uploads a local file into a folder; returns the new item id.
    # GET Items(<folderId>)/Upload?method=standard&fileName&fileSize -> ChunkUri,
    # then POST the file as multipart to ChunkUri. A standard upload returns no
    # body, so we append fmt=json to ChunkUri to get the new item id back.
    # VERIFY: the upload-spec call is GET here (matches ShareFile's SDKs); the
    # Items.html reference lists it as POST. Confirm against the live tenant.
    def upload(folder_id, local_path, filename)
      size = File.size(local_path)
      spec_res = get(api_uri("Items(#{folder_id})/Upload",
                             method: "standard",
                             raw: false,
                             fileName: filename,
                             fileSize: size))
      chunk_uri = JSON.parse(spec_res.body).fetch("ChunkUri")
      finish_uri = URI(append_query(chunk_uri, "fmt", "json"))
      upload_res = post_multipart(finish_uri, local_path, filename)
      parse_upload_id(upload_res.body)
    end

    # Shares the given item ids with one or more recipient emails and emails them.
    # Returns the share URI. POST /sf/v3/Shares?notify=true, ShareType "Send".
    # ExpirationDate is omitted (ShareFile defaults to 30 days); set it once
    # legal confirms the retention window (format "YYYY-MM-DD", "9999-12-31"
    # disables expiry).
    def share_with(item_ids, recipient_emails, message:)
      res = post_json(api_uri("Shares", notify: true),
                      {
                        ShareType: "Send",
                        Title: "Instructure security data delivery",
                        Items: item_ids.map { |id| { Id: id } },
                        Recipients: Array(recipient_emails).map { |email| { User: { Email: email } } },
                        RequireLogin: true, # recipient must verify identity
                        RequireUserInfo: true,
                        Message: message
                      })
      body = JSON.parse(res.body)
      body["Uri"] || body["Url"]
    end

    private

    def append_query(url, key, value)
      uri = URI(url)
      sep = uri.query.to_s.empty? ? "" : "&"
      uri.query = "#{uri.query}#{sep}#{URI.encode_www_form([[key, value]])}"
      uri.to_s
    end

    def api_uri(path, query = {})
      uri = URI("https://#{@apicp}/sf/v3/#{path}")
      uri.query = URI.encode_www_form(query) unless query.empty?
      uri
    end

    def auth_header
      { "Authorization" => "Bearer #{@token}" }
    end

    def get(uri)
      req = Net::HTTP::Get.new(uri, auth_header)
      perform(uri, req)
    end

    def post_json(uri, payload)
      req = Net::HTTP::Post.new(uri, auth_header.merge("Content-Type" => "application/json"))
      req.body = payload.to_json
      perform(uri, req)
    end

    def post_form(uri, payload)
      req = Net::HTTP::Post.new(uri)
      req.set_form_data(payload)
      perform(uri, req)
    end

    def post_multipart(uri, local_path, filename)
      req = Net::HTTP::Post.new(uri, auth_header)
      File.open(local_path, "rb") do |io|
        # ShareFile expects the file under the form field "Filedata".
        req.set_form([["Filedata", io, { filename: }]], "multipart/form-data")
        return perform(uri, req)
      end
    end

    def perform(uri, req)
      res = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https") do |http|
        http.request(req)
      end
      unless res.is_a?(Net::HTTPSuccess)
        raise "ShareFile #{req.method} #{uri.path} failed: #{res.code} #{res.body}"
      end

      res
    end

    # With fmt=json the finish response is {"error":false,"value":"[{\"id\":...}]"}
    # where "value" is itself a JSON-encoded array of uploaded items.
    def parse_upload_id(body)
      data = JSON.parse(body)
      raw = data["value"] || data["Value"]
      if raw.is_a?(String)
        item = JSON.parse(raw).first
        item && (item["id"] || item["Id"])
      else
        data.dig("Items", 0, "Id")
      end
    rescue JSON::ParserError
      nil
    end
  end

  # Orchestrates the whole run and accumulates an audit report.
  class Runner
    STATUS_DELIVERED = "delivered"
    STATUS_DRY_RUN = "dry_run"
    STATUS_NO_ACCOUNT = "no_account"
    STATUS_INACTIVE = "account_inactive"
    STATUS_NO_CONTACT = "no_contact"
    STATUS_ERROR = "error"
    REPORT_COLUMNS = %i[uuid account_id account_name account_active contact_email extra_contacts file_count status share_url error].freeze

    def initialize(config)
      @config = config
      @source = DumpSource.new(config)
      @sharefile = ShareFileClient.new(config)
      @rows = []
    end

    def run
      log "Mode: #{@config.live ? "LIVE" : "DRY-RUN"}"
      @sharefile.authenticate! if @config.live

      partitions = @source.partitions
      log "Found #{partitions.size} institution partition(s) in s3://#{@config.s3_bucket}/#{@config.s3_prefix}"

      partitions.each { |partition| process(partition) }

      write_report
      summarize
    end

    private

    def process(partition)
      account = Account.find_by(uuid: partition.uuid)
      return record(partition, account, STATUS_NO_ACCOUNT) unless account
      # Ryleigh: skip institutions whose account isn't active.
      return record(partition, account, STATUS_INACTIVE) unless account.workflow_state == "active"

      # Deliver to every active security contact: the primary and, if present,
      # the secondary (which receives all the same information). The first row is
      # reported as the primary contact, the rest as additional recipients.
      emails = account.security_contacts.order(:id).map(&:email).uniq
      return record(partition, account, STATUS_NO_CONTACT) if emails.empty?

      email = emails.first
      extra = emails.drop(1)

      unless @config.live
        return record(partition, account, STATUS_DRY_RUN, email:, extra_contacts: extra, file_count: partition.keys.size)
      end

      share_url = deliver(partition, account, emails)
      record(partition, account, STATUS_DELIVERED, email:, extra_contacts: extra, file_count: partition.keys.size, share_url:)
    rescue => e
      log "  ERROR #{partition.uuid}: #{e.class}: #{e.message}"
      record(partition, account, STATUS_ERROR, error: e.message)
    end

    def deliver(partition, account, emails)
      # Recipient-facing: name the folder for the institution, NOT the UUID.
      # A bare UUID isn't recognizable and can read as a phishing attempt. The
      # uuid -> account mapping stays in the internal CSV report for traceability.
      folder_id = @sharefile.ensure_folder(account.name)
      item_ids = partition.keys.map do |key|
        @source.with_downloaded_object(key) do |tmp|
          @sharefile.upload(folder_id, tmp.path, File.basename(key))
        end
      end
      msg = "Instructure is returning files associated with your institution. " \
            "Please contact security@instructure.com with any questions."
      # One share per institution covering all of its files, to all contacts.
      @sharefile.share_with(item_ids, emails, message: msg)
    end

    def record(partition, account, status, email: nil, extra_contacts: [], file_count: 0, share_url: nil, error: nil)
      @rows << {
        uuid: partition.uuid,
        account_id: account&.id,
        account_name: account&.name,
        account_active: account ? account.workflow_state == "active" : nil,
        contact_email: email,
        extra_contacts: extra_contacts.join(";"),
        file_count:,
        status:,
        share_url:,
        error:
      }
    end

    def write_report
      CSV.open(@config.report_path, "w") do |csv|
        csv << REPORT_COLUMNS.map(&:to_s)
        @rows.each { |r| csv << r.values_at(*REPORT_COLUMNS) }
      end
      log "Report written to #{@config.report_path}"
    end

    def summarize
      by_status = @rows.group_by { |r| r[:status] }.transform_values(&:size)
      log "Summary: #{by_status.inspect}"
    end

    def log(msg)
      Rails.logger.info("[security_contact_delivery] #{msg}")
      warn "[security_contact_delivery] #{msg}"
    end
  end
end

SecurityContactDelivery::Runner.new(SecurityContactDelivery::Config.new(ARGV)).run
