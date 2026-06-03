# frozen_string_literal: true

require "json"

namespace :js do
  # Shared prerequisite for the webpack bundles. This MUST run exactly once
  # before js:webpack_development and js:webpack_production. When both webpack
  # tasks ran build:packages themselves, the two parallel processes raced on
  # the shared packages/canvas-rce/es/ directory (build-canvas does
  # `rm -rf es/*` then babel src->es), intermittently leaving es/ half-written
  # and breaking the webpack bundle. Hoisting it into its own task lets the
  # graph schedule it once, ahead of the parallel webpack batch.
  desc "Generate GraphQL types and build workspace packages"
  task :build_packages do
    puts "--> Generating GraphQL types"
    system "yarn run graphql:codegen"
    raise "Error running graphql:codegen: \nABORTING" unless $?.success?

    puts "--> Building JS packages"
    system "yarn run build:packages"
    raise "Error running build:packages: \nABORTING" unless $?.success?
  end

  desc "Build development webpack js"
  task :webpack_development do
    puts "--> Building DEVELOPMENT webpack bundles"
    system "yarn run webpack-development"
    raise "Error running js:webpack_development: \nABORTING" if $?.exitstatus != 0
  end

  desc "Build production webpack js"
  task :webpack_production do
    puts "--> Building PRODUCTION webpack bundles"
    system "yarn run webpack-production"
    raise "Error running js:webpack_production: \nABORTING" if $?.exitstatus != 0
  end

  desc "Ensure up-to-date node environment"
  task :yarn_install do
    puts "node is: #{`node -v`.strip} (#{`which node`.strip})"
    puts "yarn is: #{`yarn -v`.strip} (#{`which yarn`.strip})"

    # --production=false so that it still installs devDependencies as they are
    # needed for post-installation steps (like wsrun)
    #
    #  see https://classic.yarnpkg.com/en/docs/cli/install#toc-yarn-install-production-true-false
    yarnopts = "--frozen-lockfile --production=false"

    system "yarn install #{yarnopts} || yarn install #{yarnopts} --network-concurrency 1"
    unless $?.success?
      raise "error running yarn install"
    end
  end

  desc "Revision static assets"
  task :gulp_rev do
    system "yarn run gulp rev"

    unless $?.success?
      raise "error running gulp rev"
    end
  end
end
