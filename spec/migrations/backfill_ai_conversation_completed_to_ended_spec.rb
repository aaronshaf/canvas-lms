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

require_relative "../../db/migrate/20260526000002_backfill_ai_conversation_completed_to_ended"

describe BackfillAiConversationCompletedToEnded do
  subject(:migration) { described_class.new }

  let(:connection) { ActiveRecord::Base.connection }

  def constraint_exists?(name)
    connection.check_constraint_exists?(:ai_conversations, name:)
  end

  describe "#up" do
    it "completes without error and leaves only the new narrow constraint" do
      expect { migration.up }.not_to raise_error
      expect(constraint_exists?("chk_workflow_state_enum")).to be true
      expect(constraint_exists?("chk_workflow_state_enum_old")).to be false
    end
  end

  describe "#down" do
    before { migration.up }

    it "restores the wider constraint without error" do
      expect { migration.down }.not_to raise_error
      expect(constraint_exists?("chk_workflow_state_enum")).to be true
    end
  end
end
