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

RSpec.describe CanvasOperations do
  describe ".registered_operations" do
    subject(:registered) { described_class.registered_operations }

    it "returns an Array" do
      expect(registered).to be_an(Array)
    end

    it "lists only descendants of BaseOperation" do
      expect(registered).to all(be < CanvasOperations::BaseOperation)
    end
  end

  describe ".find" do
    let(:operation_class) do
      stub_const("Operations::FindTestOp", Class.new(CanvasOperations::BaseOperation) do
        def execute; end
      end)
    end

    before do
      allow(described_class).to receive(:registered_operations).and_return([operation_class])
    end

    context "when given a string matching a registered operation's name" do
      it "returns the operation class" do
        expect(described_class.find("find_test_op")).to eq(operation_class)
      end
    end

    context "when given a symbol matching a registered operation's name" do
      it "converts the symbol to a string and returns the operation class" do
        expect(described_class.find(:find_test_op)).to eq(operation_class)
      end
    end

    context "when no registered operation matches the given id" do
      it "returns nil" do
        expect(described_class.find("nonexistent_operation")).to be_nil
      end
    end

    context "when given a non-string, non-symbol id" do
      it "raises ArgumentError" do
        expect { described_class.find(42) }
          .to raise_error(ArgumentError, /Could not lookup operation by identifier `42`/)
      end
    end
  end
end
