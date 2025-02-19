/*
 * Copyright (C) 2024 - present Instructure, Inc.
 *
 * This file is part of Canvas.
 *
 * Canvas is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import React, {useState, useEffect} from 'react'
import {useLocation, Link} from 'react-router-dom'
import {Flex} from '@instructure/ui-flex'
import {IconFolderLockedSolid, IconFolderSolid} from '@instructure/ui-icons'
import {Img} from '@instructure/ui-img'
import {TruncateText} from '@instructure/ui-truncate-text'
import {Text} from '@instructure/ui-text'
import {View} from '@instructure/ui-view'
import FilePreviewModal from './FilePreviewModal'
import {getIconByType} from '@canvas/mime/react/mimeClassIconHelper'
import {type File, type Folder} from '../../../interfaces/File'
import {generateUrlPath} from '../../../utils/folderUtils'
import {generatePreviewUrlPath} from '../../../utils/fileUtils'

interface NameLinkProps {
  item: File | Folder
  isStacked: boolean
}

const NameLink = ({item, isStacked}: NameLinkProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const previewId = searchParams.get('preview')
    if (previewId == item.id) {
      setIsModalOpen(true)
    }
  }, [location.search, item.id])

  const handleLinkClick = (e: React.MouseEvent) => {
    if (isFile) {
      e.preventDefault()
      setIsModalOpen(true)
      const searchParams = new URLSearchParams(location.search)
      searchParams.set('preview', item.id)
      window.history.pushState({}, '', urlPath())
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
  }
  const isFile = 'display_name' in item
  const name = isFile ? item.display_name : item.name
  const iconUrl = isFile ? item.thumbnail_url : undefined
  const icon = getIcon(item, isFile, iconUrl)
  const pxSize = isStacked ? '18px' : '36px'

  const renderIconComponent = () => {
    if (iconUrl) {
      return <Img src={iconUrl} width={pxSize} height={pxSize} alt="" data-testid="name-icon" />
    }
    return isStacked ? <>{icon}</> : <span style={{fontSize: '2em'}}>{icon}</span>
  }

  const renderTextComponent = () => {
    return isStacked ? (
      <View margin="0 0 0 xx-small">
        <Text>{name}</Text>
      </View>
    ) : (
      <TruncateText>
        <Text>{name}</Text>
      </TruncateText>
    )
  }

  const renderFilePreviewModal = () => {
    if (!isFile) return null

    return <FilePreviewModal isOpen={isModalOpen} onClose={handleCloseModal} item={item as File} />
  }

  const urlPath = () => {
    if (isFile) {
      return generatePreviewUrlPath(item as File)
    } else {
      return generateUrlPath(item)
    }
  }

  return (
    <>
      <Link to={urlPath()} data-testid={name} onClick={handleLinkClick}>
        {isStacked ? (
          <>
            {renderIconComponent()}
            {renderTextComponent()}
          </>
        ) : (
          <Flex>
            <Flex.Item margin="0 0 x-small 0">{renderIconComponent()}</Flex.Item>
            <Flex.Item margin="0 0 0 small" shouldShrink={true}>
              {renderTextComponent()}
            </Flex.Item>
          </Flex>
        )}
      </Link>
      {renderFilePreviewModal()}
    </>
  )
}

const getIcon = (item: File | Folder, isFile: boolean, iconUrl?: string) => {
  if (isFile) {
    if (!iconUrl) {
      const IconComponent = getIconByType(item.mime_class)
      return React.cloneElement(IconComponent, {color: 'primary'})
    }
  } else {
    return item.for_submissions ? (
      <IconFolderLockedSolid data-testid="locked-folder-icon" color="primary" />
    ) : (
      <IconFolderSolid data-testid="folder-icon" color="primary" />
    )
  }
}

export default NameLink
