# frozen_string_literal: true

#
# Copyright (C) 2011 - present Instructure, Inc.
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

describe JSONToken do
  it "encodes" do
    expect(JSONToken.encode({ a: 123, b: [1, 2, "13"] })).to eq "eyJhIjoxMjMsImIiOlsxLDIsIjEzIl19"
  end

  it "decodes" do
    expect(JSONToken.decode("eyJhIjoxMjMsImIiOlsxLDIsIjEzIl19")).to eq({ "a" => 123, "b" => [1, 2, "13"] })
  end

  it "handles binary strings" do
    messy = (+"\xD1\x9B\x86").force_encoding("ASCII-8BIT")
    expect(JSONToken.decode(JSONToken.encode(messy))).to eq messy
  end

  it "does not mutate the input when encoding" do
    deep_freeze = lambda do |o|
      case o
      when Hash  then o.each_value { |v| deep_freeze.call(v) }
      when Array then o.each { |v| deep_freeze.call(v) }
      end
      o.freeze
    end
    binary = (+"\xD1\x9B\x86").force_encoding("ASCII-8BIT")
    input = deep_freeze.call({ "arr" => [binary] })
    expect { JSONToken.encode(input) }.not_to raise_error
  end
end
