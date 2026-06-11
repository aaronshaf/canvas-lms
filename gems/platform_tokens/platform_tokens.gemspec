# frozen_string_literal: true

require_relative "lib/platform_tokens/version"

Gem::Specification.new do |spec|
  spec.name = "platform_tokens"
  spec.version = PlatformTokens::VERSION
  spec.authors = ["Weston Dransfield"]
  spec.email = ["wdransfield@instructure.com"]

  spec.summary = "Model and validate platform tokens"
  spec.description = "Model and validate platform refresh, id, and access tokens"
  spec.required_ruby_version = ">= 3.2.0"

  spec.files         = Dir.glob("{lib,spec}/**/*") + %w[Rakefile test.sh]
  spec.require_paths = ["lib"]

  spec.add_dependency "activemodel", "~> 8.0"
end
