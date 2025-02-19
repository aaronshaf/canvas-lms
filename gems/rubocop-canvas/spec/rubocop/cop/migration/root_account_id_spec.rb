# frozen_string_literal: true

#
# Copyright (C) 2021 - present Instructure, Inc.
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

describe RuboCop::Cop::Migration::RootAccountId do
  subject(:cop) { described_class.new }

  it "complains if no root_account_id reference is provided" do
    offenses = inspect_source(<<~RUBY)
      class TestMigration < ActiveRecord::Migration
        def up
          create_table :widgets do |t|
            t.boolean :purple, default: true, null: false
          end
        end
      end
    RUBY
    expect(offenses.size).to eq 2
    expect(offenses.first.message).to include "Ensure another migration in this commit uses `set_replica_identity`"
    expect(offenses.first.message).to include %(set_replica_identity :widgets)
    expect(offenses.first.severity.name).to eq(:info)
    expect(offenses.last.message).to include "New tables need a root_account reference"
    expect(offenses.last.severity.name).to eq(:warning)
  end

  it "suggests using t.references instead if a root_account_id column is provided" do
    offenses = inspect_source(<<~RUBY)
      class TestMigration < ActiveRecord::Migration
        def up
          create_table :quizzes do |t|
            t.boolean :purple, default: true, null: false
            t.bigint :root_account_id
          end
          set_replica_identity :quizzes
        end
      end
    RUBY
    expect(offenses.size).to eq 1
    expect(offenses.first.message).to include "Use `t.references` instead"
    expect(offenses.first.severity.name).to eq(:convention)
  end

  it "complains if `t.references` is missing the foreign key" do
    offenses = inspect_source(<<~RUBY)
      class TestMigration < ActiveRecord::Migration
        def up
          create_table :master_courses_master_templates do |t|
            t.boolean :purple, default: true, null: false
            t.references :root_account, index: false
          end
          set_replica_identity :master_courses_master_templates
        end
      end
    RUBY
    expect(offenses.size).to eq 2
    expect(offenses.last.message).to include "Add a replica identity index"
    expect(offenses.last.severity.name).to eq(:warning)
    expect(offenses.first.message).to include "Use `foreign_key: { to_table: :accounts }`"
    expect(offenses.first.severity.name).to eq(:warning)
  end

  it "complains if `t.references` is missing `null: false`" do
    offenses = inspect_source(<<~RUBY)
      class TestMigration < ActiveRecord::Migration
        def up
          create_table :widgets do |t|
            t.boolean :purple, default: true, null: false
            t.references :root_account, foreign_key: { to_table: :accounts }, index: false
          end
          set_replica_identity :widgets
        end
      end
    RUBY
    expect(offenses.size).to eq 2
    expect(offenses.last.message).to include "Add a replica identity index"
    expect(offenses.last.severity.name).to eq(:warning)
    expect(offenses.first.message).to include "Use `null: false`"
    expect(offenses.first.severity.name).to eq(:warning)
  end

  it "complains if `t.references` is missing `index: false`" do
    offenses = inspect_source(<<~RUBY)
      class TestMigration < ActiveRecord::Migration
        def up
          create_table :widgets do |t|
            t.boolean :purple, default: true, null: false
            t.references :root_account, foreign_key: { to_table: :accounts }, null: false
          end
          set_replica_identity :widgets
        end
      end
    RUBY
    expect(offenses.size).to eq 2
    expect(offenses.last.message).to include "Add a replica identity index"
    expect(offenses.last.severity.name).to eq(:warning)
    expect(offenses.first.message).to include "Use `index: false` (the replica identity index should suffice)"
    expect(offenses.first.severity.name).to eq(:convention)
  end

  it "complains if `t.references` has `index: true`" do
    offenses = inspect_source(<<~RUBY)
      class TestMigration < ActiveRecord::Migration
        def up
          create_table :ping_pong_balls do |t|
            t.boolean :purple, default: true, null: false
            t.references :root_account, foreign_key: { to_table: :accounts }, null: false, index: true
          end
        end
      end
    RUBY
    expect(offenses.size).to eq 3
    expect(offenses[0].message).to include "Use `index: false` (the replica identity index should suffice)"
    expect(offenses[0].severity.name).to eq(:convention)
    expect(offenses[1].message).to include "Add a replica identity index"
    expect(offenses[1].severity.name).to eq(:warning)
    expect(offenses[2].message).to include "Ensure another migration in this commit uses `set_replica_identity`"
    expect(offenses[2].message).to include "set_replica_identity :ping_pong_balls"
    expect(offenses[2].severity.name).to eq(:info)
  end

  it "complains if the replica identity index is missing" do
    offenses = inspect_source(<<~RUBY)
      class TestMigration < ActiveRecord::Migration
        def up
          create_table :widgets do |t|
            t.boolean :purple, default: true, null: false
            t.references :root_account, foreign_key: { to_table: :accounts }, index: false, null: false
          end
        end
      end
    RUBY
    expect(offenses.size).to eq 2
    expect(offenses.first.message).to include "Add a replica identity index"
    expect(offenses.first.severity.name).to eq(:warning)
    expect(offenses.last.message).to include "Ensure another migration in this commit uses `set_replica_identity`"
    expect(offenses.last.severity.name).to eq(:info)
  end

  it "gives no complaints if requirements are satisfied" do
    offenses = inspect_source(<<~RUBY)
      class TestMigration < ActiveRecord::Migration
        def up
          create_table :widgets do |t|
            t.boolean :purple, default: true, null: false
            t.references :root_account, foreign_key: { to_table: :accounts }, index: false, null: false

            t.replica_identity_index
          end
          set_replica_identity :widgets
        end
      end
    RUBY
    expect(offenses.size).to eq 0
  end

  it "handle old-style migrations" do
    offenses = inspect_source(<<~RUBY)
      class TestMigration < ActiveRecord::Migration
        def self.up
          create_table :widgets do |t|
            t.boolean :purple, default: true, null: false
            t.references :root_account, foreign_key: { to_table: :accounts }, index: false, null: false

            t.replica_identity_index
          end
          set_replica_identity :widgets
        end
      end
    RUBY
    expect(offenses.size).to eq 0
  end

  it "works with multiple table creations in one migration" do
    offenses = inspect_source(<<~RUBY)
      class TestMigration < ActiveRecord::Migration[6.0]
        def up
          create_table :wickets do |t|
            t.string :flavor
            t.timestamps
          end

          create_table :widgets do |t|
            t.string :color
            t.references :root_account, foreign_key: { to_table: :accounts }, null: false, index: true
            t.timestamps
          end

          set_replica_identity :wickets
        end
      end
    RUBY
    expect(offenses.size).to eq 4
    expect(offenses[0].message).to include "New tables need a root_account reference"
    expect(offenses[1].message).to include "Use `index: false`"
    expect(offenses[2].message).to include "Add a replica identity index"
    expect(offenses[3].message).to include "Ensure another migration in this commit uses `set_replica_identity`"
  end
end
