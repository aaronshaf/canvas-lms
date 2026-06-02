/*
 * Copyright (C) 2018 - present Instructure, Inc.
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

import React from 'react'
import {GraphiQL} from 'graphiql'
import {explorerPlugin} from '@graphiql/plugin-explorer'
import axios from '@canvas/axios'
import 'graphiql/style.css'
import '@graphiql/plugin-explorer/style.css'

const explorer = explorerPlugin()

function fetcher(params) {
  return axios
    .post('/api/graphql', JSON.stringify(params), {
      headers: {'Content-Type': 'application/json'},
    })
    .then(({data}) => data)
}

export default function GraphiQLApp() {
  return <GraphiQL fetcher={fetcher} plugins={[explorer]} />
}
