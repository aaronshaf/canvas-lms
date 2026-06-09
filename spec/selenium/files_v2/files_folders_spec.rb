# frozen_string_literal: true

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

require_relative "../common"
require_relative "pages/files_page"

describe "files index page" do
  include_context "in-process server selenium tests"
  include FilesPage

  before(:once) do
    Account.site_admin.enable_feature! :files_a11y_rewrite
    Account.site_admin.enable_feature! :files_a11y_rewrite_toggle
  end

  context "Folders" do
    context("as a teacher") do
      let(:folder_name) { "base folder" }

      before(:once) do
        course_with_teacher(active_all: true)
      end

      before do
        user_session @teacher
        @teacher.set_preference(:files_ui_version, "v2")
        @base_folder = Folder.create!(name: folder_name, context: @course)
        get "/courses/#{@course.id}/files"
      end

      it "validates xss on folder text", priority: "1" do
        test_folder_name = '<script>alert("Hi");</script>'
        create_folder_button.click
        create_folder_input.send_keys(test_folder_name)
        create_folder_input.send_keys(:return)
        expect(content).to include_text('<script>alert("Hi");<_script>')
      end

      it "is able to create and view a new folder with uri characters" do
        test_folder_name = "this#could+be bad? maybe"
        create_folder_button.click
        create_folder_input.send_keys(test_folder_name)
        create_folder_input.send_keys(:return)
        folder = @course.folders.where(name: test_folder_name).first
        expect(folder).not_to be_nil
        file_name = "some silly file"
        @course.attachments.create!(display_name: file_name, uploaded_data: default_uploaded_data, folder:)
        folder_link = flnpt(test_folder_name, content)
        expect(folder_link).to be_present
        folder_link.click
        wait_for_ajaximations
      end

      context "Move dialog" do
        before do
          @folder_to_move_name = "move-this-folder"
          Folder.create!(name: @folder_to_move_name, context: @course)
        end

        it "moves a folder using drag and drop", priority: "1" do
          # Place the new folder into the base folder
          get "/courses/#{@course.id}/files"
          folder_to_drag = get_table_row_item(2)
          destination_folder = get_table_row_item(1)
          drag_and_drop_element(folder_to_drag, destination_folder)
          expect(alert).to include_text("#{@folder_to_move_name} successfully moved to #{folder_name}")

          get "/courses/#{@course.id}/files/folder/base%20folder"
          expect(get_item_content_files_table(1, 1)).to include(@folder_to_move_name)
        end

        it "moves a folder and a file using drag and drop", priority: "1" do
          file_name = "move-this-file.pdf"
          attachment_model(content_type: "application/pdf", context: @course, display_name: file_name)

          get "/courses/#{@course.id}/files"
          get_row_header_files_table(2).click # select a folder
          get_row_header_files_table(3).click # select a file

          destination_folder = get_table_row_item(1)
          items_to_move = get_table_row_item(2)
          drag_and_drop_element(items_to_move, destination_folder)
          expect(alert).to include_text("#{@folder_to_move_name} successfully moved to #{folder_name}")
          expect(alert).to include_text("#{file_name} successfully moved to #{folder_name}")

          get "/courses/#{@course.id}/files/folder/base%20folder"
          expect(get_item_content_files_table(1, 1)).to include(@folder_to_move_name)
          expect(get_item_content_files_table(2, 1)).to include(file_name)
        end
      end

      context "Usage Rights" do
        before :once do
          @course.usage_rights_required = true
          @course.save!
        end

        before do
          file_name = "edit-usage-rights-file.pdf"
          attachment_model(content_type: "application/pdf", context: @course, display_name: file_name, folder: @base_folder)
          get "/courses/#{@course.id}/files"
        end

        it "sets usage rights on a folder and contained file using cog menu", priority: "1" do
          action_menu_button.click
          action_menu_item_by_name("Manage Usage Rights").click
          set_usage_rights_in_modal(:creative_commons)
          # a11y: focus should go back to the element that was clicked.
          check_element_has_focus(action_menu_button)
          get "/courses/#{@course.id}/files/folder/base%20folder"
          verify_usage_rights_ui_updates(:creative_commons)
        end

        it "sets usage rights on a folder and contained file using toolbar menu", priority: "1" do
          select_item_to_edit_from_kebab_menu(1)
          toolbox_menu_button("manage-usage-rights-button").click
          set_usage_rights_in_modal(:public_domain)
          # a11y: focus should go back to the element that was clicked.
          check_element_has_focus(toolbox_menu_button("more-button"))
          get "/courses/#{@course.id}/files/folder/base%20folder"
          verify_usage_rights_ui_updates(:public_domain)
        end
      end
    end
  end
end
