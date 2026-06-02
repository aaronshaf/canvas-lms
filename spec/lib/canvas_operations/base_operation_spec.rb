# frozen_string_literal: true

#
# Copyright (C) 2025 - present Instructure, Inc.
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

RSpec.describe CanvasOperations::BaseOperation do
  specs_require_sharding

  let(:progress) { Progress.new(context: Account.default, tag: "test/progress") }
  let(:cluster) { Shard.current.database_server }

  shared_context "simple operation" do
    before do
      stub_const("MyOperation", Class.new(described_class) do
        def execute
          log_message("Executing SimpleOperation")
        end
      end)
    end
  end

  shared_context "result setting operation" do
    before do
      stub_const("MyOperation", Class.new(described_class) do
        self.progress_tracking = true

        def execute
          results[:custom_result] = "banana"
        end
      end)
    end
  end

  shared_context "callback operation" do
    before do
      stub_const("MyOperation", Class.new(described_class) do
        before_run :pre_run
        after_run :post_run
        around_run :around_run_method

        before_failure :pre_failure
        after_failure :post_failure
        around_failure :around_failure_method

        def pre_run; end

        def post_run; end

        def around_run_method
          yield
        end

        def pre_failure; end

        def post_failure; end

        def around_failure_method
          yield
        end

        def execute
          log_message("Executing CallbackOperation")
        end
      end)
    end
  end

  shared_context "setting operation" do
    before do
      stub_const("MyOperation", Class.new(described_class) do
        setting :float_feature, default: 0.3, type_cast: :to_f
        setting :integer_feature, default: 5, type_cast: :to_i
        setting :custom_feature, default: "custom_value", type_cast: ->(v) { v.upcase }

        def execute
          log_message("Executing SettingOperation")
        end
      end)
    end
  end

  shared_context "progress operation" do
    before do
      stub_const("MyOperation", Class.new(described_class) do
        self.progress_tracking = true

        def execute
          log_message("Executing MyOperation")
        end
      end)
    end
  end

  shared_context "no progress operation" do
    before do
      stub_const("NoProgressOperation", Class.new(described_class) do
        self.progress_tracking = false

        def execute
          log_message("Executing NoProgressOperation")
        end
      end)
    end
  end

  describe ".setting" do
    include_context "setting operation"

    it "creates a class-level setting mutator and accessor" do
      MyOperation.float_feature = 1.5
      expect(MyOperation.float_feature).to eq(1.5)

      MyOperation.integer_feature = 10
      expect(MyOperation.integer_feature).to eq(10)

      MyOperation.custom_feature = "another_value"
      expect(MyOperation.custom_feature).to eq("ANOTHER_VALUE")
    end

    it "creates class-level setting mutators with cluster argument" do
      MyOperation.set_float_feature_for_cluster(2.5, cluster: cluster.id)
      expect(MyOperation.float_feature).to eq(2.5)

      MyOperation.set_integer_feature_for_cluster(20, cluster: cluster.id)
      expect(MyOperation.integer_feature).to eq(20)

      MyOperation.set_custom_feature_for_cluster("cluster_value", cluster: cluster.id)
      expect(MyOperation.custom_feature).to eq("CLUSTER_VALUE")
    end

    it "creates instance-level setting accessors" do
      operation_instance = MyOperation.new

      expect(operation_instance.send(:float_feature)).to eq(0.3)
      expect(operation_instance.send(:integer_feature)).to eq(5)
      expect(operation_instance.send(:custom_feature)).to eq("CUSTOM_VALUE")
    end

    context "with multiple clusters specified" do
      let(:second_cluster) { second_shard.database_server }
      let(:second_shard) { @shard2 }

      it "keeps settings isolated by cluster" do
        MyOperation.set_float_feature_for_cluster(3.5, cluster: cluster.id)
        MyOperation.set_float_feature_for_cluster(4.5, cluster: second_cluster.id)

        expect(MyOperation.float_feature).to eq(3.5)

        second_shard.activate do
          expect(MyOperation.float_feature).to eq(4.5)
        end
      end
    end

    context "when the given type_cast is an invalid symbol" do
      it "raises an InvalidTypeCast error" do
        expect do
          stub_const("MyInvalidOperation", Class.new(described_class) do
            setting :float_feature, default: 0.3, type_cast: :to_banana

            def execute
              log_message("Executing InvalidOperation")
            end
          end)
        end.to raise_error(CanvasOperations::Errors::InvalidTypeCast, /Unsupported type_cast `to_banana`/)
      end
    end

    context "when the given type_cast is an invalid proc" do
      it "raises an InvalidTypeCast error" do
        expect do
          stub_const("MyInvalidOperation", Class.new(described_class) do
            setting :float_feature, default: 0.3, type_cast: ->(v, _extra_arg) { v }

            def execute
              log_message("Executing InvalidProcOperation")
            end
          end)
        end.to raise_error(CanvasOperations::Errors::InvalidTypeCast, /type_cast Proc must take exactly one argument/)
      end
    end
  end

  describe "callbacks" do
    include_context "callback operation"

    let(:operation_instance) { MyOperation.new }

    it "invokes `run` callbacks" do
      expect(operation_instance).to receive(:pre_run).once.ordered
      expect(operation_instance).to receive(:around_run_method).once.ordered.and_yield
      expect(operation_instance).to receive(:post_run).once.ordered

      operation_instance.run
    end

    it "defines `failure` callback class methods" do
      expect(operation_instance).to receive(:pre_failure).once.ordered
      expect(operation_instance).to receive(:around_failure_method).once.ordered.and_yield
      expect(operation_instance).to receive(:post_failure).once.ordered

      operation_instance.fail_with_error!
    end
  end

  describe "#run" do
    subject(:run_operation) { operation_instance.run }

    include_context "result setting operation"

    let(:operation_instance) { MyOperation.new }

    it "runs #execute" do
      expect(operation_instance).to receive(:execute).once

      run_operation
    end

    it "sets the current progress" do
      operation_instance.run(progress)

      expect(operation_instance.send(:progress)).to eq(progress)
    end

    it "completes the progress after execution" do
      expect(progress).to receive(:complete).once

      operation_instance.run(progress)
    end

    it "manually sets workflow_state to completed when progress.complete returns false" do
      allow(progress).to receive(:complete).and_return(false)

      operation_instance.run(progress)

      expect(progress.workflow_state).to eq("completed")
    end

    it "emits an event notifying the run is starting and completing" do
      expect(InstStatsd::Statsd).to receive(:event).with(
        "my_operation started",
        "my_operation operation for shard #{Shard.current.id} started",
        {
          tags: { cluster: Shard.current.database_server.id, shard: Shard.current.id },
          type: "my_operation",
          alert_type: :success
        }
      ).once

      expect(InstStatsd::Statsd).to receive(:event).with(
        "my_operation completed",
        "my_operation operation for shard #{Shard.current.id} completed",
        {
          tags: { cluster: Shard.current.database_server.id, shard: Shard.current.id },
          type: "my_operation",
          alert_type: :success
        }
      ).once

      operation_instance.run
    end

    it "updates the progress with results after execution" do
      expect(progress).to receive(:update!).with(results: { custom_result: "banana" }).once

      operation_instance.run(progress)
    end

    context "when the current shard is not the shard of the operation" do
      include_context "simple operation"

      it "raises a WrongShard" do
        operation = @shard1.activate { MyOperation.new }

        expect { @shard2.activate { operation.run } }.to raise_error(CanvasOperations::Errors::WrongShard, /Operation is being run on the wrong shard/)
      end
    end

    context "when #execute raises Errors::InvalidOperationTarget" do
      include_context "simple operation"

      let(:operation_instance) { MyOperation.new }

      before do
        allow(operation_instance).to receive(:execute).and_raise(
          CanvasOperations::Errors::InvalidOperationTarget,
          "Invalid target"
        )
      end

      it "invokes failure callbacks and marks the progress as failed" do
        expect(operation_instance).to receive(:fail_with_error!).once

        operation_instance.run(progress)
      end

      it "does not raise the error further" do
        expect do
          operation_instance.run(progress)
        end.not_to raise_error
      end

      it "stores the error message in results" do
        operation_instance.run(progress)

        expect(operation_instance.results[:error]).to eq("Invalid target")
      end
    end
  end

  describe "#run_later" do
    subject(:run_later) { operation_instance.run_later }

    context "when progress tracking is enabled" do
      include_context "progress operation"

      let(:operation_instance) { MyOperation.new }

      before do
        allow(operation_instance).to receive(:progress).and_return(progress)
      end

      it "relies on Progress#process_job to enqueue the operation with correct options" do
        expect(progress).to receive(:process_job).with(
          operation_instance,
          :run,
          { on_conflict: :overwrite, singleton: "operations/my_operation/shards/#{Shard.current.id}" }
        ).once

        run_later
      end
    end

    context "when progress tracking is disabled" do
      include_context "no progress operation"

      let(:operation_instance) { NoProgressOperation.new }

      # Testing production-like behavior with `delay_if_production`
      before do
        allow(Rails.env).to receive(:production?).and_return(true)
        allow(operation_instance).to receive(:log_message)
      end

      it "enqueues the operation without Progress tracking" do
        expect(operation_instance).to receive(:log_message).with("Progress tracking is disabled; running operation without Progress tracking.", level: :debug).once

        expect { run_later }.to change {
          Delayed::Job.where(
            singleton: "operations/no_progress_operation/shards/#{Shard.current.id}",
            tag: "NoProgressOperation#run"
          ).count
        }.from(0).to(1)
      end

      it "configures job to call fail_with_error! on permanent failure" do
        run_later

        job = Delayed::Job.find_by(
          singleton: "operations/no_progress_operation/shards/#{Shard.current.id}",
          tag: "NoProgressOperation#run"
        )
        expect(job.payload_object.permanent_fail_cb).to eq(:fail_with_error!)
      end

      it "does not create a Progress record" do
        expect { run_later }.not_to change(Progress, :count)
      end

      it "runs the operation without creating a Progress record" do
        run_later

        expect { run_jobs }.not_to change(Progress, :count)
      end

      it "fails without creating a Progress record" do
        allow_any_instance_of(NoProgressOperation).to receive(:execute).and_raise(
          CanvasOperations::Errors::InvalidOperationTarget,
          "Invalid target"
        )

        run_later

        expect { run_jobs }.not_to change(Progress, :count)
      end

      it "uses run_at in the job options if specified" do
        time = 1.hour.from_now
        operation_instance.run_later(run_at: time)

        job = Delayed::Job.find_by(
          singleton: "operations/no_progress_operation/shards/#{Shard.current.id}",
          tag: "NoProgressOperation#run"
        )
        expect(job.run_at).to eq(time)
      end
    end
  end

  describe "#delayed_job" do
    include_context "no progress operation"

    let(:operation_instance) { NoProgressOperation.new }

    before do
      allow(Rails.env).to receive(:production?).and_return(true)
      allow(operation_instance).to receive(:log_message)
    end

    it "returns nil when no job exists for this operation" do
      expect(operation_instance.delayed_job).to be_nil
    end

    context "after run_later" do
      before { operation_instance.run_later }

      it "returns the enqueued Delayed::Job" do
        expect(operation_instance.delayed_job).to be_a(Delayed::Job)
      end

      it "returns the job matching the operation's singleton" do
        expect(operation_instance.delayed_job.singleton).to eql(
          "operations/no_progress_operation/shards/#{Shard.current.id}"
        )
      end
    end
  end

  describe "#job_options" do
    context "when progress tracking is enabled" do
      include_context "progress operation"

      let(:operation_instance) { MyOperation.new }

      it "does not include on_permanent_failure" do
        options = operation_instance.send(:job_options)

        expect(options).to eq({
                                singleton: "shards/#{Shard.current.id}",
                                on_conflict: :overwrite
                              })
        expect(options).not_to have_key(:on_permanent_failure)
      end
    end

    context "when progress tracking is disabled" do
      include_context "no progress operation"

      let(:operation_instance) { NoProgressOperation.new }

      it "includes on_permanent_failure" do
        options = operation_instance.send(:job_options)

        expect(options).to eq({
                                singleton: "shards/#{Shard.current.id}",
                                on_conflict: :overwrite,
                                on_permanent_failure: :fail_with_error!
                              })
      end
    end
  end

  describe "#fail_with_error!" do
    subject(:fail_operation) { operation_instance.fail_with_error! }

    include_context "progress operation"

    let(:operation_instance) { MyOperation.new }

    before do
      allow(operation_instance).to receive(:progress).and_return(progress)
    end

    it "marks the progress as failed" do
      expect(progress).to receive(:fail).once

      fail_operation
    end

    it "updates the progress with results after failure" do
      expect(progress).to receive(:update!).with(results: {}).once

      fail_operation
    end
  end

  describe "#report_message" do
    subject(:report_message) { operation_instance.send(:report_message, title:, message:, alert_type:) }

    include_context "simple operation"

    let(:operation_instance) { MyOperation.new }
    let(:title) { "Test Title" }
    let(:message) { "Test message content" }
    let(:alert_type) { :success }

    it "logs the message with title" do
      expect(operation_instance).to receive(:log_message).with("#{title}: #{message}").once

      report_message
    end

    it "emits an InstStatsd event with correct parameters" do
      expect(InstStatsd::Statsd).to receive(:event).with(
        "my_operation: #{title}",
        "my_operation #{message}",
        {
          tags: { cluster: Shard.current.database_server.id, shard: Shard.current.id },
          type: "my_operation",
          alert_type:
        }
      ).once

      report_message
    end

    context "with different alert types" do
      %i[error warning info].each do |type|
        context "when alert_type is #{type}" do
          let(:alert_type) { type }

          it "uses the correct alert_type in the event" do
            expect(InstStatsd::Statsd).to receive(:event).with(
              "my_operation: #{title}",
              "my_operation #{message}",
              {
                tags: { cluster: Shard.current.database_server.id, shard: Shard.current.id },
                type: "my_operation",
                alert_type: type
              }
            ).once

            report_message
          end
        end
      end
    end

    context "with default alert_type" do
      subject(:report_message) { operation_instance.send(:report_message, title:, message:) }

      it "defaults to :success alert_type" do
        expect(InstStatsd::Statsd).to receive(:event).with(
          "my_operation: #{title}",
          "my_operation #{message}",
          {
            tags: { cluster: Shard.current.database_server.id, shard: Shard.current.id },
            type: "my_operation",
            alert_type: :success
          }
        ).once

        report_message
      end
    end
  end

  describe CanvasOperations::BaseConcerns::Schema::Argument do
    let(:base_attrs) do
      { name: :placeholder, type: :string, required: false, title: nil, description: nil, default: nil }
    end

    describe "#initialize" do
      context "when given a Symbol type" do
        subject(:arg) { described_class.new(**base_attrs, type: :boolean) }

        it "stores the type" do
          expect(arg.type).to be(:boolean)
        end
      end

      context "when given an ActiveRecord subclass type" do
        subject(:arg) { described_class.new(**base_attrs, type: User) }

        it "stores the type" do
          expect(arg.type).to be(User)
        end
      end

      context "when given a non-Symbol, non-ActiveRecord type" do
        it "raises ArgumentError" do
          expect { described_class.new(**base_attrs, type: String) }
            .to raise_error(ArgumentError, /must be a Symbol or ActiveRecord::Base subclass/)
        end
      end
    end

    describe "#active_record_type?" do
      context "when the type is an ActiveRecord subclass" do
        subject(:arg) { described_class.new(**base_attrs, type: User) }

        it "is true" do
          expect(arg.active_record_type?).to be(true)
        end
      end

      context "when the type is a Symbol" do
        subject(:arg) { described_class.new(**base_attrs, type: :boolean) }

        it "is false" do
          expect(arg.active_record_type?).to be(false)
        end
      end
    end

    describe "#property_name" do
      context "when the type is an ActiveRecord subclass" do
        subject(:arg) { described_class.new(**base_attrs, name: :root_account, type: Account) }

        it "appends _id to the argument name" do
          expect(arg.property_name).to be(:root_account_id)
        end
      end

      context "when the type is a Symbol" do
        subject(:arg) { described_class.new(**base_attrs, name: :skip_admins, type: :boolean) }

        it "uses the argument name unchanged" do
          expect(arg.property_name).to be(:skip_admins)
        end
      end
    end

    describe "#to_property" do
      context "when the type is an ActiveRecord subclass" do
        subject(:arg) do
          described_class.new(**base_attrs, name: :user, type: User, title: "User", description: "The user")
        end

        it "emits a JSON Schema string type" do
          expect(arg.to_property).to eql({ type: "string", title: "User", description: "The user" })
        end
      end

      context "when the type is a Symbol" do
        subject(:arg) { described_class.new(**base_attrs, name: :flag, type: :boolean, default: false) }

        it "emits the symbol as the JSON Schema type" do
          expect(arg.to_property).to eql({ type: "boolean", default: false })
        end
      end

      context "when optional fields are nil" do
        subject(:arg) { described_class.new(**base_attrs, name: :flag, type: :boolean) }

        it "omits the nil keys" do
          expect(arg.to_property).to eql({ type: "boolean" })
        end
      end
    end
  end

  shared_context "schema operation" do
    before do
      stub_const("Operations::SchemaSpecTestOp", Class.new(described_class) do
        description "A test operation."

        argument :root_account,
                 type: Account,
                 required: true,
                 title: "Root Account",
                 description: "The root account."
        argument :skip_admins,
                 type: :boolean,
                 required: false,
                 default: false,
                 title: "Skip Admins"

        ui_schema "DescriptionHelper:short" => "A short description."
      end)
    end
  end

  describe ".argument" do
    context "with a non-Symbol, non-ActiveRecord type" do
      let(:operation_class) { Class.new(described_class) }

      it "raises ArgumentError" do
        expect { operation_class.class_eval { argument :nope, type: String } }
          .to raise_error(ArgumentError, /must be a Symbol or ActiveRecord::Base subclass/)
      end
    end
  end

  describe ".ui_schema" do
    context "with successive declarations" do
      let(:operation_class) do
        klass = Class.new(described_class)
        stub_const("Operations::UiSchemaSpecOp", klass)
        klass.class_eval do
          ui_schema "a" => 1
          ui_schema "b" => 2
        end
        klass
      end

      it "merges the keys across declarations" do
        expect(operation_class.operation_schema[:ui_schema]).to eql("a" => 1, "b" => 2)
      end
    end
  end

  describe ".operation_schema" do
    include_context "schema operation"

    let(:schema) { Operations::SchemaSpecTestOp.operation_schema }

    it "exposes the operation id derived from the class name" do
      expect(schema[:id]).to eql("schema_spec_test_op")
    end

    it "exposes the humanized operation title" do
      expect(schema[:title]).to eql("Schema spec test op")
    end

    it "exposes the declared description" do
      expect(schema[:description]).to eql("A test operation.")
    end

    it "exposes the declared ui_schema" do
      expect(schema[:ui_schema]).to eql("DescriptionHelper:short" => "A short description.")
    end

    it "wraps arguments in a JSON Schema object" do
      expect(schema[:schema]).to include(type: "object", additionalProperties: false)
    end

    it "applies the _id suffix to ActiveRecord-backed property keys" do
      expect(schema[:schema][:properties].keys).to eql(%i[root_account_id skip_admins])
    end

    it "lists required arguments by their property name" do
      expect(schema[:schema][:required]).to eql([:root_account_id])
    end

    it "emits ActiveRecord-backed arguments as JSON Schema strings" do
      expect(schema[:schema][:properties][:root_account_id]).to eql(
        { type: "string", title: "Root Account", description: "The root account." }
      )
    end

    it "emits primitive-typed arguments with their declared default" do
      expect(schema[:schema][:properties][:skip_admins]).to eql(
        { type: "boolean", title: "Skip Admins", default: false }
      )
    end

    it "sets supports_shards to false for base operations" do
      expect(schema[:supports_shards]).to be(false)
    end
  end

  describe ".resolve_args" do
    include_context "schema operation"

    let(:account) { account_model }

    context "with an AR-backed _id key and a global ID" do
      subject(:resolved) do
        Operations::SchemaSpecTestOp.resolve_args("root_account_id" => account.global_id.to_s)
      end

      it "resolves the AR instance under the non-suffixed symbol key" do
        expect(resolved[:root_account]).to eq(account)
      end

      it "omits the _id key from the result" do
        expect(resolved).not_to have_key(:root_account_id)
      end
    end

    context "with a non-AR key" do
      subject(:resolved) { Operations::SchemaSpecTestOp.resolve_args("skip_admins" => true) }

      it "converts the key to a symbol and preserves the value" do
        expect(resolved).to eq({ skip_admins: true })
      end
    end

    context "with a mix of AR and non-AR keys" do
      subject(:resolved) do
        Operations::SchemaSpecTestOp.resolve_args(
          "root_account_id" => account.global_id.to_s,
          "skip_admins" => false
        )
      end

      it "resolves AR instances and passes scalars through" do
        expect(resolved).to eq({ root_account: account, skip_admins: false })
      end
    end

    context "when given a non-global ID for an AR argument" do
      it "raises ArgumentError" do
        expect do
          Operations::SchemaSpecTestOp.resolve_args("root_account_id" => "1")
        end.to raise_error(ArgumentError, /Non-global ID given for argument `root_account_id`/)
      end
    end

    context "when given an _id key for an unknown argument" do
      it "raises ArgumentError" do
        expect do
          Operations::SchemaSpecTestOp.resolve_args("unknown_thing_id" => account.global_id.to_s)
        end.to raise_error(ArgumentError, /Unknown ActiveRecord argument `unknown_thing_id`/)
      end
    end
  end
end
