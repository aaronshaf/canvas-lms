/*
 * Copyright (C) 2020 - present Instructure, Inc.
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
import PropTypes from 'prop-types'
import classNames from 'classnames'
import {DropTarget} from 'react-dnd'

import Assignment from './assignment-card'
import ConditionToggle from './condition-toggle'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'

const {object, func, string, bool} = PropTypes

// implements the drop target contract
const assignmentTarget = {
  // @ts-expect-error -- legacy untyped React DnD contract
  drop(props, monitor, component) {
    const item = monitor.getItem()
    const assg = component.getAssignmentDropTarget()
    const path = assg !== undefined ? props.path.push(assg) : props.path

    // @ts-expect-error -- legacy untyped React DnD contract
    const found = props.setAssignments.find(a => {
      return a.get('assignment_id') === item.id
    })

    const isInternal = item.path.pop().equals(props.path)

    // if (assignment isn't already in set OR is moved within the set) AND isn't dropped on itself..
    if ((!found || isInternal) && !item.path.equals(path)) {
      props.moveAssignment(item.path, path, item.id)
    }

    component.resetAssignmentDropTarget()
  },
}

class AssignmentSet extends React.Component {
  static get propTypes() {
    return {
      path: object.isRequired,
      setAssignments: object.isRequired,
      allAssignments: object.isRequired,
      removeAssignment: func.isRequired,
      moveAssignment: func.isRequired,
      toggleSetCondition: func.isRequired,
      showOrToggle: bool,
      disableSplit: bool,
      label: string.isRequired,
      readOnly: bool,

      // injected by React DnD
      connectDropTarget: func.isRequired,
      isOver: bool.isRequired,
      canDrop: bool.isRequired,
    }
  }

  constructor() {
    // @ts-expect-error -- legacy untyped React component
    super()

    this.state = {
      dropTarget: undefined,
    }

    this.setAssignmentDropTarget = this.setAssignmentDropTarget.bind(this)
    this.resetAssignmentDropTarget = this.resetAssignmentDropTarget.bind(this)
  }

  // @ts-expect-error -- legacy untyped React component
  setAssignmentDropTarget(idx) {
    this.setState({dropTarget: idx})
  }

  resetAssignmentDropTarget() {
    this.setState({dropTarget: undefined})
  }

  getAssignmentDropTarget() {
    // @ts-expect-error -- legacy untyped React component
    return this.state.dropTarget
  }

  // @ts-expect-error -- legacy untyped React component
  renderToggle(path) {
    // @ts-expect-error -- legacy untyped React component
    const {setAssignments, showOrToggle, disableSplit, toggleSetCondition, readOnly} = this.props
    const isLastAssignment = path.assignment + 1 === setAssignments.size

    // @ts-expect-error -- legacy untyped React component
    if (path.assignment === this.state.dropTarget) {
      return this.renderDragToggle(isLastAssignment)
    } else if (isLastAssignment && !showOrToggle) {
      return null
    } else {
      const isAnd = !isLastAssignment
      return (
        <ConditionToggle
          isAnd={isAnd}
          isDisabled={isAnd && disableSplit}
          path={path}
          handleToggle={toggleSetCondition}
          readOnly={readOnly}
        />
      )
    }
  }

  // @ts-expect-error -- legacy untyped React component
  renderDragToggle(isLast) {
    return <ConditionToggle isAnd={true} isFake={isLast} />
  }

  renderAssignments() {
    // @ts-expect-error -- legacy untyped React component
    const {setAssignments, allAssignments, path, removeAssignment, readOnly} = this.props

    // @ts-expect-error -- legacy untyped React component
    const items = setAssignments.map((asg, idx) => {
      const assignment = allAssignments.get(asg.get('assignment_id'))

      const setInnerClasses = classNames({
        'cr-assignment-set__inner': true,
        // @ts-expect-error -- legacy untyped React component
        'cr-assignment-set__inner__draggedOver': idx === this.state.dropTarget,
      })

      const assignmentPath = path.push(idx)

      return (
        <div key={asg.get('assignment_id')} className={setInnerClasses}>
          <Assignment
            path={assignmentPath}
            assignment={assignment}
            removeAssignment={removeAssignment}
            onDragOver={this.setAssignmentDropTarget}
            onDragLeave={this.resetAssignmentDropTarget}
            readOnly={readOnly}
          />
          {this.renderToggle(assignmentPath)}
        </div>
      )
    })

    return items.toArray()
  }

  render() {
    // @ts-expect-error -- legacy untyped React component
    const {canDrop, isOver, connectDropTarget, setAssignments, readOnly, label} = this.props

    const setClasses = classNames({
      'cr-assignment-set': true,
      'cr-assignment-set__empty': setAssignments.size === 0,
      'cr-assignment-set__drag-over': isOver && !readOnly,
      'cr-assignment-set__can-drop': canDrop && !readOnly,
      'cr-assignment-set__read-only': readOnly,
    })

    const content = (
      <div
        className={setClasses}
        onDragLeave={readOnly ? undefined : this.resetAssignmentDropTarget}
      >
        <ScreenReaderContent>
          <h3>{label}</h3>
        </ScreenReaderContent>
        {this.renderAssignments()}
      </div>
    )

    // Don't apply drop target wrapper when readOnly
    if (readOnly) {
      return content
    }

    return connectDropTarget(content)
  }
}

export default DropTarget('AssignmentCard', assignmentTarget, (connect, monitor) => ({
  connectDropTarget: connect.dropTarget(),
  isOver: monitor.isOver(),
  canDrop: monitor.canDrop(),
}))(AssignmentSet)
