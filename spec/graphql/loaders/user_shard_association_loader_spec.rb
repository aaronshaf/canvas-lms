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

describe Loaders::UserShardAssociationLoader do
  it "fulfills with the user itself so resolvers can chain off the promise" do
    user = user_factory(active_all: true)

    GraphQL::Batch.batch do
      described_class.for.load(user).then do |loaded|
        expect(loaded).to eq(user)
      end
    end
  end

  it "calls User.preload_shard_associations once with the full batch of users" do
    users = Array.new(3) { user_factory(active_all: true) }

    expect(User).to receive(:preload_shard_associations).with(match_array(users)).once

    GraphQL::Batch.batch do
      Promise.all(users.map { |u| described_class.for.load(u) }).sync
    end
  end

  it "fulfills every user in the batch, in order, with the same user instance" do
    users = Array.new(3) { user_factory(active_all: true) }

    GraphQL::Batch.batch do
      Promise.all(users.map { |u| described_class.for.load(u) }).then do |loaded|
        expect(loaded).to eq(users)
      end
    end
  end
end
