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
#

describe "adheres_to_policy monkeypatches" do
  let_once(:user) { user_model }
  let(:principal) { Canvas::AdheresToPolicy::UserPrincipal.new(user) }

  describe User do
    it "acts as Principal" do
      expect(user.user).to be user
    end

    it "compares directly with principal" do
      expect(user).to eq principal
    end
  end

  describe Canvas::AdheresToPolicy::UserPrincipal do
    describe "#initialize" do
      it "passes a nil through" do
        expect(Canvas::AdheresToPolicy::UserPrincipal.new(nil)).to be_nil
      end

      it "disallows nesting" do
        expect(Canvas::AdheresToPolicy::UserPrincipal.new(principal)).to be principal
      end
    end

    it "compares directly with user" do
      expect(principal).to eq user
    end
  end

  describe AdheresToPolicy::InstanceMethods do
    describe "#check_right?" do
      # indirection is because I need something I can reference by reference
      let(:storage) { {} }
      let(:policy) do
        # convert from method to local variable so it can be captured by the policy block
        storage = self.storage
        AdheresToPolicy::Policy.new do
          given do |principal|
            storage[:principal] = principal
            true
          end
          can :read
        end
      end
      let(:received_principal) { storage[:principal] }

      before do
        allow(User).to receive(:policy).and_return(policy)
      end

      it "wraps users in a UserPrincipal" do
        user.grants_right?(user, :read)
        expect(received_principal).to be_a(Canvas::AdheresToPolicy::UserPrincipal)
        expect(received_principal.user).to eq user
      end

      it "does not wrap principals in a UserPrincipal" do
        user.grants_right?(principal, :read)
        expect(received_principal).to be principal
      end
    end
  end
end
