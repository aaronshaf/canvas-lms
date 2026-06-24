# frozen_string_literal: true

#
# Copyright (C) 2014 - present Instructure, Inc.
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

describe AdheresToPolicy::InstanceMethods do
  let(:some_class) do
    Class.new do
      attr_accessor :user

      extend AdheresToPolicy::ClassMethods

      set_policy do
        given { |principal| user == principal.user }
        can :read
      end
    end
  end

  let(:user_class) { Class.new }

  let(:principal_class) do
    Class.new(AdheresToPolicy::UserPrincipal) do
      def cache_key
        user&.to_s
      end
    end
  end
  let(:principal) { principal_class.new(1) }
  let(:allowed_actor) { principal_class.new("allowed actor") }
  let(:another_allowed_actor) { principal_class.new("another allowed actor") }
  let(:disallowed_actor) { principal_class.new("disallowed actor") }

  it "has setup a series of methods on the instance" do
    %w[rights_status granted_rights grants_right? grants_any_right? grants_all_rights?].each do |method|
      expect(some_class.new).to respond_to(method)
    end
  end

  it "is able to check a policy" do
    some_instance = some_class.new
    some_instance.user = 1
    expect(some_instance.grants_right?(principal, :read)).to be true
  end

  it "allows multiple forms of can statements" do
    resource_class = Class.new do
      extend AdheresToPolicy::ClassMethods

      set_policy do
        given { |principal| principal.user == 1 }
        can :read and can :write

        given { |principal| principal.user == 2 }
        can :update, :delete

        given { |principal| principal.user == 3 }
        can [:manage, :set_permissions]
      end
    end

    resource = resource_class.new
    expect(resource.rights_status(principal, :read, :write)).to eq({ read: true, write: true })
    expect(resource.rights_status(principal_class.new(2), :read, :update, :delete)).to eq({ read: false, update: true, delete: true })
    expect(resource.rights_status(principal_class.new(3), :read, :manage, :set_permissions)).to eq({ read: false, manage: true, set_permissions: true })
  end

  it "checks parent conditions" do
    resource_class = Class.new do
      extend AdheresToPolicy::ClassMethods

      set_policy do
        given { |principal| principal.user[0] == true }
        use_additional_policy do
          given { |principal| principal.user[1] == true }
          can :do_stuff
        end
      end
    end

    resource = resource_class.new
    expect(resource.rights_status(principal_class.new([false, false]))).to eq(do_stuff: false)
    expect(resource.rights_status(principal_class.new([false, true]))).to eq(do_stuff: false)
    expect(resource.rights_status(principal_class.new([true, false]))).to eq(do_stuff: false)
    expect(resource.rights_status(principal_class.new([true, true]))).to eq(do_stuff: true)
  end

  it "checks deeply nested parent conditions" do
    resource_class = Class.new do
      extend AdheresToPolicy::ClassMethods

      set_policy do
        given { |principal| principal.user[0] == true }
        use_additional_policy do
          given { |principal| principal.user[1] == true }
          can :do_stuff
          use_additional_policy do
            given { |principal| principal.user[2] == true }
            can :do_things
          end
        end
      end
    end

    resource = resource_class.new
    expect(resource.rights_status(principal_class.new([false, false, false]))).to eq(do_stuff: false, do_things: false)
    expect(resource.rights_status(principal_class.new([false, false, true]))).to eq(do_stuff: false, do_things: false)
    expect(resource.rights_status(principal_class.new([false, true, false]))).to eq(do_stuff: false, do_things: false)
    expect(resource.rights_status(principal_class.new([false, true, true]))).to eq(do_stuff: false, do_things: false)
    expect(resource.rights_status(principal_class.new([true, false, false]))).to eq(do_stuff: false, do_things: false)
    expect(resource.rights_status(principal_class.new([true, false, true]))).to eq(do_stuff: false, do_things: false)
    expect(resource.rights_status(principal_class.new([true, true, false]))).to eq(do_stuff: true, do_things: false)
    expect(resource.rights_status(principal_class.new([true, true, true]))).to eq(do_stuff: true, do_things: true)
  end

  it "executes all conditions when searching for all rights" do
    resource_class = Class.new do
      attr_accessor :total

      extend AdheresToPolicy::ClassMethods

      def initialize
        @total = 0
      end

      set_policy do
        given { |_| @total += 1 }
        can :read

        given { |_| @total += 1 }
        can :write

        given { |_| @total += 1 }
        can :update
      end
    end

    resource = resource_class.new
    expect(resource.rights_status(nil)).to eq({ read: true, write: true, update: true })
    expect(resource.total).to eq 3
  end

  it "skips duplicate conditions when searching for all rights" do
    resource_class = Class.new do
      attr_accessor :total

      extend AdheresToPolicy::ClassMethods

      def initialize
        @total = 0
      end

      set_policy do
        given { |_| @total += 1 }
        can :read, :write

        given { |_| raise "don't execute me" }
        can :write

        given { |_| @total += 1 }
        can :update
      end
    end

    resource = resource_class.new
    expect(resource.rights_status(nil)).to eq({ read: true, write: true, update: true })
    expect(resource.total).to eq 2
  end

  it "only executes relevant conditions when searching for specific rights" do
    resource_class = Class.new do
      attr_accessor :total

      extend AdheresToPolicy::ClassMethods

      def initialize
        @total = 0
      end

      set_policy do
        given { |_| @total += 1 }
        can :read

        given { |_| raise "don't execute me" }
        can :write

        given { |_| raise "me either" }
        can :update
      end
    end

    resource = resource_class.new
    expect(resource.rights_status(nil, :read)).to eq({ read: true })
    expect(resource.total).to eq 1
  end

  it "skips duplicate conditions when searching for specific rights" do
    resource_class = Class.new do
      attr_accessor :total

      extend AdheresToPolicy::ClassMethods

      def initialize
        @total = 0
      end

      set_policy do
        given { |_| @total += 1 }
        can :read

        given { |_| @total += 1 }
        can :write

        given { |_| raise "me either" }
        can :read and can :write
      end
    end

    resource = resource_class.new
    expect(resource.rights_status(nil, :read, :write)).to eq({ read: true, write: true })
    expect(resource.total).to eq 2
  end

  context "clear_permissions_cache" do
    let :sample_class do
      Class.new do
        extend AdheresToPolicy::ClassMethods

        set_policy do
          given { |principal| principal.user == 1 }
          can :read

          given { |principal| principal.user == 2 }
          can :read and can :write
        end
      end
    end

    it "clear the permissions cache" do
      expect(Rails.cache).to receive(:delete).with(%r{/read$})
      expect(Rails.cache).to receive(:delete).with(%r{/write$})

      sample = sample_class.new
      expect(sample.grants_right?(principal, :read)).to be true
      sample.clear_permissions_cache(principal)
    end
  end

  context "grants_any_right?" do
    let :sample_class do
      Class.new do
        extend AdheresToPolicy::ClassMethods

        set_policy do
          given { |principal| principal.user == 1 }
          can :read

          given { |principal| principal.user == 2 }
          can :read and can :write
        end
      end
    end

    it "checks the policy" do
      sample = sample_class.new
      expect(sample.grants_any_right?(principal, :read, :write)).to be true
      expect(sample.grants_any_right?(principal, :asdf)).to be false
    end

    it "returns false if no specific ones are sought" do
      sample = sample_class.new
      expect(sample.grants_any_right?(principal)).to be false
    end

    context "with justifications" do
      let(:resource_class) do
        Class.new do
          extend AdheresToPolicy::ClassMethods

          set_policy do
            given { |principal| principal.user == "allowed actor" || AdheresToPolicy::JustifiedFailure.new(:wrong_actor) }
            can :read

            given { |principal| principal.user == "allowed actor" }
            can :read_more
          end
        end
      end

      it "returns true/false by default" do
        non_context = resource_class.new
        expect(non_context.grants_any_right?(allowed_actor, :read, :read_more)).to be true
        expect(non_context.grants_any_right?(disallowed_actor, :read, :read_more)).to be false
      end

      it "returns detailed information if requested and denied" do
        non_context = resource_class.new
        expect(non_context.grants_any_right?(allowed_actor, :read, :read_more, with_justifications: true).success?).to be true
        reasoned_failure = non_context.grants_any_right?(disallowed_actor, :read, :read_more, with_justifications: true)
        expect(reasoned_failure.success?).to be false
        expect(reasoned_failure.justifications.first.justification).to eq(:wrong_actor)
        reasonless_failure = non_context.grants_any_right?(disallowed_actor, :read_more, with_justifications: true)
        expect(reasonless_failure.success?).to be false
        expect(reasonless_failure.justifications.length).to eq(0)
      end
    end

    context "with multiple justifications" do
      let(:actor_class) do
        Class.new do
          extend AdheresToPolicy::ClassMethods

          set_policy do
            given { |principal| principal.user == "allowed actor" || AdheresToPolicy::JustifiedFailures.new([AdheresToPolicy::JustifiedFailure.new(:wrong_actor)]) }
            can :read

            given { |principal| principal.user == "allowed actor" }
            can :read_more
          end
        end
      end

      it "returns detailed information if requested and denied" do
        non_context = actor_class.new
        expect(non_context.grants_any_right?(allowed_actor, :read, :read_more, with_justifications: true).success?).to be true
        reasoned_failure = non_context.grants_any_right?(disallowed_actor, :read, :read_more, with_justifications: true)
        expect(reasoned_failure.success?).to be false
        expect(reasoned_failure.justifications.first.justification).to eq(:wrong_actor)
        reasonless_failure = non_context.grants_any_right?(disallowed_actor, :read_more, with_justifications: true)
        expect(reasonless_failure.success?).to be false
        expect(reasonless_failure.justifications.length).to eq(0)
      end
    end
  end

  context "grants_all_rights?" do
    let :sample_class do
      Class.new do
        extend AdheresToPolicy::ClassMethods

        set_policy do
          given { |principal| principal.user == 1 }
          can :read

          given { |principal| principal.user == 2 }
          can :read and can :write
        end
      end
    end

    it "checks the policy" do
      sample = sample_class.new
      expect(sample.grants_all_rights?(principal_class.new(1), :read, :write)).to be false
      expect(sample.grants_all_rights?(principal_class.new(2), :read, :write)).to be true
      expect(sample.grants_all_rights?(principal_class.new(3), :read, :asdf)).to be false
    end

    it "returns false if no specific ones are sought" do
      sample = sample_class.new
      expect(sample.grants_all_rights?(principal_class.new(1))).to be false
    end

    context "with justifications" do
      let(:resource_class) do
        Class.new do
          extend AdheresToPolicy::ClassMethods

          set_policy do
            given { |principal| principal.user == "allowed actor" || AdheresToPolicy::JustifiedFailure.new(:wrong_actor) }
            can :read and can :read_more

            given { |principal| principal.user == "another allowed actor" }
            can :read
          end
        end
      end

      it "returns true/false by default" do
        non_context = resource_class.new
        expect(non_context.grants_all_rights?(allowed_actor, :read, :read_more)).to be true
        expect(non_context.grants_all_rights?(another_allowed_actor, :read, :read_more)).to be false
        expect(non_context.grants_all_rights?(disallowed_actor, :read, :read_more)).to be false
      end

      it "returns detailed information if requested and denied" do
        non_context = resource_class.new
        expect(non_context.grants_all_rights?(allowed_actor, :read, :read_more, with_justifications: true).success?).to be true
        single_failure = non_context.grants_all_rights?(another_allowed_actor, :read, :read_more, with_justifications: true)
        expect(single_failure.success?).to be false
        expect(single_failure.justifications.first.justification).to eq(:wrong_actor)
        full_failure = non_context.grants_all_rights?(disallowed_actor, :read, :read_more, with_justifications: true)
        expect(full_failure.success?).to be false
        expect(full_failure.justifications.first.justification).to eq(:wrong_actor)
      end
    end
  end

  context "check_condition?" do
    it "runs condition based on its arity" do
      resource_class = Class.new do
        attr_accessor :total

        extend AdheresToPolicy::ClassMethods

        def initialize
          @total = 0
        end

        set_policy do
          given { |principal| @total += principal.user[0] }
          can :read

          given { |principal| @total = @total + principal.user[0] + principal.user[1][:count] }
          can :write
        end
      end

      resource = resource_class.new
      expect(resource.rights_status(principal_class.new([1, { count: 2 }]), :read, :write)).to eq({ read: true, write: true })
      expect(resource.total).to eq 4
    end
  end

  context "grants_right?" do
    let(:resource_class) do
      # need to copy the method to a local variable so that it's visible within the block
      user_class = self.user_class
      Class.new do
        extend AdheresToPolicy::ClassMethods

        set_policy do
          given { |principal| principal&.user == "allowed actor" || principal&.user.is_a?(user_class) }
          can :read

          given { |principal| principal&.user == "allowed actor" }
          can :read
        end
      end
    end

    it "checks the policy" do
      non_context = resource_class.new
      expect(non_context.grants_right?(allowed_actor, :read)).to be true
      expect(non_context.grants_right?(allowed_actor, :asdf)).to be false
    end

    it "returns false if no specific ones are sought" do
      non_context = resource_class.new
      expect(non_context.grants_right?(allowed_actor)).to be false
    end

    it "returns false if no user is provided" do
      non_context = resource_class.new
      expect(non_context.grants_right?(allowed_actor, :read)).to be true
      expect(non_context.grants_right?(nil, :read)).to be false
    end

    it "raises argument exception if anything other then one right is provided" do
      non_context = resource_class.new
      expect(non_context.grants_right?(allowed_actor, :read)).to be true
      expect do
        non_context.grants_right?(allowed_actor, :asdf, :read)
      end.to raise_exception ArgumentError
    end

    context "caching" do
      after do
        AdheresToPolicy.configuration.reset!
      end

      it "caches permissions" do
        resource = resource_class.new

        expect(AdheresToPolicy::Cache).to receive(:fetch).twice.with(/permissions/, an_instance_of(Hash)).and_return([AdheresToPolicy::Failure.instance])
        resource.rights_status(principal)
        # cache lookups for "nobody" as well
        resource.rights_status(nil)
      end

      it "does not nil the session argument when not caching" do
        resource_class = Class.new do
          attr_reader :session

          extend AdheresToPolicy::ClassMethods

          set_policy do
            given { |_, session| @session = session }
            can :read
          end
        end

        resource = resource_class.new
        resource.rights_status(principal, {})
        expect(resource.session).not_to be_nil
      end

      it "changes cache key based on session[:permissions_key]" do
        session = {
          permissions_key: "permissions_key",
          session_id: "session_id"
        }
        resource_class = Class.new do
          extend AdheresToPolicy::ClassMethods

          set_policy do
            given { |_| true }
            can :read
          end

          def call_permission_cache_key_for(*)
            permission_cache_key_for(*)
          end
        end

        resource = resource_class.new
        expect(resource.call_permission_cache_key_for(nil, session, :read)).to match(%r{>/permissions_key/read$})

        session.delete(:permissions_key)
        expect(resource.call_permission_cache_key_for(nil, session, :read)).to match(%r{>/default/read$})

        expect(resource.call_permission_cache_key_for(nil, nil, :read)).to match(%r{>/read$})
      end

      it "must not use the rails cache for permissions included in the configured blacklist" do
        klass = Class.new do
          extend AdheresToPolicy::ClassMethods

          set_policy do
            given { |_| true }
            can :read
          end
        end
        instance = klass.new
        AdheresToPolicy.configuration.blacklist = [".read"]
        expect(AdheresToPolicy::Cache).to receive(:fetch)
          .with(an_instance_of(String), a_hash_including(use_rails_cache: false))
          .and_return([AdheresToPolicy::Failure.instance])
        instance.granted_rights(principal)
      end

      it "must cache permissions calculated using the same given block in-process only" do
        klass = Class.new do
          extend AdheresToPolicy::ClassMethods

          set_policy do
            given { |_| true }
            can :read, :write
          end
        end
        instance = klass.new

        allow(AdheresToPolicy::Cache).to receive(:write)
          .with(/read/, AdheresToPolicy::Success.instance, an_instance_of(Hash))

        expect(AdheresToPolicy::Cache).to receive(:write)
          .with(/write/, AdheresToPolicy::Success.instance, a_hash_including(use_rails_cache: false))
        instance.grants_right?(principal, :read)
      end

      it "must cache permissions calculated in the course of calculating others" do
        klass = Class.new do
          extend AdheresToPolicy::ClassMethods

          set_policy do
            given { |_| true }
            can :create

            given { |u| grants_right?(u, :create) }
            can :update
          end
        end
        instance = klass.new

        allow(AdheresToPolicy::Cache).to receive(:fetch).and_yield
        expect(AdheresToPolicy::Cache).to receive(:fetch)
          .with(/create/, a_hash_including(use_rails_cache: true))
        instance.grants_right?(principal, :update)
      end

      it "must not cache permissions calculated in the course of calculating others when configured not to" do
        AdheresToPolicy.configuration.cache_intermediate_permissions = false

        klass = Class.new do
          extend AdheresToPolicy::ClassMethods

          set_policy do
            given { |_| true }
            can :create

            given { |u| grants_right?(u, :create) }
            can :update
          end
        end
        instance = klass.new

        expect(AdheresToPolicy::Cache).to receive(:fetch)
          .with(/update/, a_hash_including(use_rails_cache: true))
          .twice
          .and_yield
          .and_return([AdheresToPolicy::Failure.instance])
        expect(AdheresToPolicy::Cache).to receive(:fetch)
          .with(/create/, a_hash_including(use_rails_cache: false))
          .twice
          .and_return([AdheresToPolicy::Failure.instance])
        instance.grants_right?(principal, :update)
        instance.grants_right?(principal, :update)
      end
    end

    context "with justifications" do
      let(:resource_class) do
        Class.new do
          extend AdheresToPolicy::ClassMethods

          set_policy do
            given { |principal| principal.user == "allowed actor" || AdheresToPolicy::JustifiedFailure.new(:wrong_actor) }
            can :read
          end
        end
      end

      it "returns true/false by default" do
        non_context = resource_class.new
        expect(non_context.grants_right?(allowed_actor, :read)).to be true
        expect(non_context.grants_right?(disallowed_actor, :read)).to be false
      end

      it "returns detailed information if requested" do
        non_context = resource_class.new
        expect(non_context.grants_right?(allowed_actor, :read, with_justifications: true).success?).to be true
        full_failure = non_context.grants_right?(disallowed_actor, :read, with_justifications: true)
        expect(full_failure.success?).to be false
        expect(full_failure.justifications.first.justification).to eq(:wrong_actor)
      end
    end

    context "override_proc" do
      before do
        AdheresToPolicy.configuration.override_proc = lambda do |principal, sought_right|
          if sought_right == :read
            if principal.user.odd?
              AdheresToPolicy::JustifiedFailure.new(:odd_user)
            elsif principal.user.zero?
              AdheresToPolicy::Success.instance
            end
          end
        end
      end

      after do
        AdheresToPolicy.configuration.reset!
      end

      it "does regular permissions checks if the override proc returns nil" do
        some_instance = some_class.new
        some_instance.user = 2
        expect(some_instance.grants_right?(principal_class.new(2), :read)).to be true
        expect(some_instance.grants_right?(principal_class.new(2), :write)).to be false
        expect(some_instance.grants_right?(principal_class.new(4), :read)).to be false
      end

      it "returns a justified failure if the override proc returns a justified failure" do
        some_instance = some_class.new
        some_instance.user = 1
        expect(some_instance.grants_right?(principal_class.new(1), :read)).to be false

        full_failure = some_instance.grants_right?(principal_class.new(1), :read, with_justifications: true)
        expect(full_failure.success?).to be false
        expect(full_failure.justifications.first.justification).to eq(:odd_user)
      end

      it "returns success if the override_proc returns success" do
        some_instance = some_class.new
        some_instance.user = 1
        expect(some_instance.grants_right?(principal_class.new(0), :read)).to be true

        full_success = some_instance.grants_right?(principal_class.new(0), :read, with_justifications: true)
        expect(full_success.success?).to be true
      end
    end

    context "with a principal that further restricts permissions" do
      let(:resource_class) do
        Class.new do
          extend AdheresToPolicy::ClassMethods

          set_policy do
            given { true }
            can :read
          end
        end
      end
      let(:resource) { resource_class.new }

      let(:principal_class) do
        Class.new(AdheresToPolicy::UserPrincipal) do
          attr_writer :user

          def cache_key = "key"

          def grants_right?(*)
            user
          end
        end
      end

      it "returns the intersection of permissions" do
        expect(resource.grants_right?(principal_class.new(true), :read)).to be true
        expect(resource.grants_right?(principal_class.new(false), :read)).to be false
        expect(resource.grants_right?(principal_class.new(true), :read, with_justifications: true)).to be AdheresToPolicy::Success.instance
        expect(resource.grants_right?(principal_class.new(false), :read, with_justifications: true)).to be AdheresToPolicy::Failure.instance
        justification = AdheresToPolicy::JustifiedFailure.new(:bad)
        result = resource.grants_right?(principal_class.new(justification), :read, with_justifications: true)
        expect(result).to be_a(AdheresToPolicy::JustifiedFailures)
        expect(result.justifications.first.justification).to be :bad
      end

      it "does not cache the result of the principal's grants_right? method" do
        principal = principal_class.new(true)

        expect(AdheresToPolicy::Cache).to receive(:write)
          .with(/read/, AdheresToPolicy::Success.instance, an_instance_of(Hash))
          .and_call_original

        expect(resource.grants_right?(principal, :read)).to be true
        principal.user = false
        expect(resource.grants_right?(principal, :read)).to be false
      end
    end

    context "with a MasqueradePrincipal" do
      let(:resource_class) do
        Class.new do
          extend AdheresToPolicy::ClassMethods

          set_policy do
            given { |_| true }
            can :read
          end
        end
      end
      let(:resource) { resource_class.new }
      let(:effective) { principal_class.new("effective") }
      let(:real) { principal_class.new("real") }
      let(:masquerading) { AdheresToPolicy::MasqueradePrincipal.new(effective, real) }

      after { AdheresToPolicy.configuration.reset! }

      it "looks up the cache under a key that includes both principals at the outer level, and the real principal alone for the recursive check" do
        expect(AdheresToPolicy::Cache).to receive(:fetch)
          .with(a_string_including("masq/masqe/effective/masqr/real"), an_instance_of(Hash))
          .and_call_original
        expect(AdheresToPolicy::Cache).to receive(:fetch)
          .with(a_string_including("masqr/real/read"), an_instance_of(Hash))
          .and_call_original

        resource.grants_right?(masquerading, :read)
      end

      it "treats the recursive check as non-primary when cache_intermediate_permissions is disabled" do
        AdheresToPolicy.configuration.cache_intermediate_permissions = false

        expect(AdheresToPolicy::Cache).to receive(:fetch)
          .with(a_string_including("masq/masqe/effective/masqr/real"), a_hash_including(use_rails_cache: true))
          .and_call_original
        expect(AdheresToPolicy::Cache).to receive(:fetch)
          .with(a_string_including("masqr/real/read"), a_hash_including(use_rails_cache: false))
          .and_call_original

        resource.grants_right?(masquerading, :read)
      end

      it "exposes the primary-permission flag as false to both the outer and recursive policy evaluations" do
        captured = []
        probing_class = Class.new do
          extend AdheresToPolicy::ClassMethods

          set_policy do
            given do |_|
              captured << Thread.current[:primary_permission_under_evaluation]
              true
            end
            can :read
          end
        end

        probing_class.new.grants_right?(masquerading, :read)
        expect(captured).to eql [false, false]
      end

      it "does not poison the effective principal's cache when the recursive check fails" do
        resource_class = Class.new do
          extend AdheresToPolicy::ClassMethods

          set_policy do
            given { |principal| principal.user == "effective" }
            can :read
          end
        end
        resource = resource_class.new

        expect(resource.grants_right?(masquerading, :read)).to be false
        expect(resource.grants_right?(effective, :read)).to be true
      end

      it "does not poison a child object's cache when its given block delegates to a parent that fails for the real user" do
        parent_class = Class.new do
          extend AdheresToPolicy::ClassMethods

          set_policy do
            given { |principal| principal.user == "effective" }
            can :read
          end
        end
        parent = parent_class.new

        child_class = Class.new do
          extend AdheresToPolicy::ClassMethods
        end
        child_class.set_policy do
          given { |principal| parent.grants_right?(principal, :read) }
          can :read
        end
        child = child_class.new

        expect(child.grants_right?(masquerading, :read)).to be false
        expect(child.grants_right?(effective, :read)).to be true
      end
    end
  end
end
