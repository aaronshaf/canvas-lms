/*
 * Copyright (C) 2026 - present Instructure, Inc.
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
import {useScope as createI18nScope} from '@canvas/i18n'
import {showFlashAlert} from '@instructure/platform-alerts'
import {platformExecuteQuery} from '@canvas/graphql'
import {queryClient} from '@instructure/platform-query'
import {PlatformUiProvider} from '@instructure/platform-provider'
import {TranslationsProvider} from '@instructure/platform-widget-dashboard'
import type {WidgetDashboardTranslations} from '@instructure/platform-widget-dashboard'
import {announceToScreenReader} from './utils/screenReaderAnnounce'
// Imported for its side effect: configures @instructure/platform-grades with
// Canvas's locale-aware formatting at startup (mirrors TranslationsProvider).
import './utils/grades'

const I18n = createI18nScope('widget_dashboard')

type TranslationThunk = (opts?: Record<string, unknown>) => string

// Filter out the WidgetDashboardTranslations index signature so missing keys
// fail at compile time instead of silently falling back to raw English.
type RemoveIndexSignature<T> = {
  [K in keyof T as string extends K ? never : K]: T[K]
}
type NamedTranslationKey = keyof RemoveIndexSignature<WidgetDashboardTranslations>

const NAMED_THUNKS: Record<NamedTranslationKey, TranslationThunk> = {
  loading: () => I18n.t('Loading'),
  error: () => I18n.t('Error'),
  retry: () => I18n.t('Retry'),
  noData: () => I18n.t('No data'),
  save: () => I18n.t('Save'),
  cancel: () => I18n.t('Cancel'),
  dragToReorder: () => I18n.t('Drag to reorder'),
  removeWidget: () => I18n.t('Remove widget'),
  loadingWidgetData: () => I18n.t('Loading widget data...'),
  noContentAvailable: () => I18n.t('No content available'),
  hubWelcomeAlert: () => I18n.t('New Feature Alert!'),
  hubWelcomeTitle: () => I18n.t('Introducing "The Hub"'),
  hubWelcomeBody: () =>
    I18n.t(
      "Do you have more than 1 Canvas account? Do you use Parchment? The Hub is Instructure's new product that consolidates all of your Instructure accounts into one convenient sign on with one unified dashboard!",
    ),
  hubWelcomeCta: () => I18n.t('Try it out now'),

  dashboard: () => I18n.t('Dashboard'),
  courses: () => I18n.t('Courses'),
  customize: () => I18n.t('Customize dashboard'),
  moveToTop: () => I18n.t('Move to top'),
  moveUp: () => I18n.t('Move up'),
  moveDown: () => I18n.t('Move down'),
  moveToBottom: () => I18n.t('Move to bottom'),
  moveLeftTop: () => I18n.t('Move left top'),
  moveLeftBottom: () => I18n.t('Move left bottom'),
  moveRightTop: () => I18n.t('Move right top'),
  moveRightBottom: () => I18n.t('Move right bottom'),
  failedToSaveWidgetLayout: () => I18n.t('Failed to save widget layout'),

  inbox: () => I18n.t('Inbox'),
  noMessages: () => I18n.t('No messages'),
  showAllMessages: () => I18n.t('View all messages in inbox'),
  unread: () => I18n.t('Unread'),
  all: () => I18n.t('All'),
  unknownSender: () => I18n.t('Unknown Sender'),
  noSubject: () => I18n.t('(No subject)'),
  inboxFilterLabel: () => I18n.t('Filter:'),
  loadingMessages: () => I18n.t('Loading messages...'),
  loadingMessagesAriaLabel: () => I18n.t('Loading messages'),

  announcements: () => I18n.t('Announcements'),
  noAnnouncements: () => I18n.t('No recent announcements'),
  readMore: () => I18n.t('Read more'),
  markAsRead: () => I18n.t('Mark as read'),
  markAsUnread: () => I18n.t('Mark as unread'),
  sentBy: (opts: Record<string, unknown> = {}) =>
    I18n.t('Sent by %{authorName}', {authorName: opts.authorName}),
  readFilter: () => I18n.t('Read filter:'),
  read: () => I18n.t('Read'),
  noUnreadAnnouncements: () => I18n.t('No unread announcements'),
  noReadAnnouncements: () => I18n.t('No read announcements'),
  noRecentAnnouncements: () => I18n.t('No recent announcements'),
  failedToLoadAnnouncements: () => I18n.t('Failed to load announcements. Please try again.'),
  loadingAnnouncements: () => I18n.t('Loading announcements...'),
  loadingAnnouncementsAriaLabel: () => I18n.t('Loading announcements'),
  announcementsPagination: () => I18n.t('Announcements pagination'),
  unknownAuthor: () => I18n.t('Unknown Author'),
  announcementMarkedAsRead: (opts: Record<string, unknown> = {}) =>
    I18n.t('"%{title}" marked as read', {title: opts.title}),
  announcementMarkedAsUnread: (opts: Record<string, unknown> = {}) =>
    I18n.t('"%{title}" marked as unread', {title: opts.title}),
  errorChangingAnnouncementReadState: () =>
    I18n.t("An error ocurred while changing the announcement's read state"),
  markAnnouncementAsRead: (opts: Record<string, unknown> = {}) =>
    I18n.t('Mark %{title} as read', {title: opts.title}),
  markAnnouncementAsUnread: (opts: Record<string, unknown> = {}) =>
    I18n.t('Mark %{title} as unread', {title: opts.title}),
  updatingReadStatus: () => I18n.t('Updating read status'),

  courseWork: () => I18n.t('Course work'),
  noCourseWork: () => I18n.t('No upcoming course work'),
  dueToday: () => I18n.t('Due today'),
  dueTomorrow: () => I18n.t('Due tomorrow'),
  overdue: () => I18n.t('Overdue'),
  failedToLoadCourseWork: () => I18n.t('Failed to load course work. Please try again.'),
  loadingCourseWork: () => I18n.t('Loading course work'),
  loadingCourseWorkData: () => I18n.t('Loading course work data...'),
  courseWorkPagination: () => I18n.t('Course work pagination'),
  noUpcomingCourseWork: () => I18n.t('No upcoming course work'),
  noUpcomingCourseWorkForSelectedCourse: () =>
    I18n.t('No upcoming course work for selected course'),
  showSummaryCounts: () => I18n.t('Show summary counts'),
  courseFilter: () => I18n.t('Course filter:'),
  due: () => I18n.t('Due'),
  missing: () => I18n.t('Missing'),
  submitted: () => I18n.t('Submitted'),
  notSubmitted: () => I18n.t('Not submitted'),
  submissionStatus: () => I18n.t('Submission status:'),
  late: () => I18n.t('Late'),
  excused: () => I18n.t('Excused'),
  pendingReview: () => I18n.t('Pending Review'),
  noDueDate: () => I18n.t('No due date'),
  today: () => I18n.t('Today'),
  tomorrow: () => I18n.t('Tomorrow'),

  courseGrades: () => I18n.t('Course grades'),
  noCourseGrades: () => I18n.t('No course grades'),
  courseGradesPagination: () => I18n.t('Course grades pagination'),
  failedToLoadCourseGrades: () => I18n.t('Failed to load course grades. Please try again.'),
  loadingCourseGrades: () => I18n.t('Loading course grades...'),
  showAllGrades: () => I18n.t('Show all grades'),
  viewGradebook: () => I18n.t('View Gradebook'),
  hideGrade: (opts: Record<string, unknown> = {}) =>
    I18n.t('Hide grade for %{courseName}', {courseName: opts.courseName}),
  showGrade: (opts: Record<string, unknown> = {}) =>
    I18n.t('Show grade for %{courseName}', {courseName: opts.courseName}),
  updatedToday: () => I18n.t('Updated today'),
  gradeUpdated1DayAgo: () => I18n.t('Grade updated 1 day ago'),

  recentGrades: () => I18n.t('Recent grades'),
  noRecentGrades: () => I18n.t('No recent grades'),
  recentGradesPagination: () => I18n.t('Recent grades pagination'),
  loadingRecentGrades: () => I18n.t('Loading recent grades...'),
  viewAllGrades: () => I18n.t('View all grades'),
  noRecentGradesAvailable: () => I18n.t('No recent grades available'),
  notYetGraded: () => I18n.t('Not yet graded'),
  gradedJustNow: () => I18n.t('Graded just now'),
  graded: () => I18n.t('Graded'),
  notGraded: () => I18n.t('Not graded'),
  expandGradeDetails: () => I18n.t('Expand grade details'),

  progressOverview: () => I18n.t('Progress overview'),
  noProgressData: () => I18n.t('No progress data'),
  goToCourse: () => I18n.t('Go to course'),
  noCoursesFound: () => I18n.t('No courses found'),
  failedToLoadProgressOverview: () => I18n.t('Failed to load progress overview. Please try again.'),
  loadingProgressOverview: () => I18n.t('Loading progress overview...'),
  progressOverviewPagination: () => I18n.t('Progress overview pagination'),
  gradedAssignments: () => I18n.t('Graded assignments'),
  remaining: () => I18n.t('Remaining'),
  courseProgressCompletion: (opts: Record<string, unknown> = {}) =>
    I18n.t('%{percent}% complete (%{total} total)', {percent: opts.percent, total: opts.total}),

  people: () => I18n.t('People'),
  noPeople: () => I18n.t('No people'),
  messageStudents: () => I18n.t('Message students'),
  allCourses: () => I18n.t('All Courses'),
  failedToLoadCourseData: () => I18n.t('Failed to load course data'),
  failedToLoadInstructorData: () => I18n.t('Failed to load instructor data. Please try again.'),
  loadingPeopleData: () => I18n.t('Loading people data...'),
  loadingInstructors: () => I18n.t('Loading instructors'),
  instructorsPagination: () => I18n.t('Instructors pagination'),
  noInstructorsFound: () => I18n.t('No instructors found'),
  teacher: () => I18n.t('Teacher'),
  teachingAssistant: () => I18n.t('Teaching Assistant'),
  allRoles: () => I18n.t('All Roles'),
  roleFilter: () => I18n.t('Role filter:'),
  nEnrollments: (opts: Record<string, unknown> = {}) =>
    I18n.t({one: '1 enrollment', other: '%{count} enrollments'}, {count: opts.count as number}),
  roleInCourse: (opts: Record<string, unknown> = {}) =>
    I18n.t('%{role} in %{course}', {role: opts.role as string, course: opts.course as string}),
  sendMessageToInstructor: (opts: Record<string, unknown> = {}) =>
    I18n.t('Send a message to %{instructor}', {instructor: opts.instructor as string}),
  sendMessageToName: (opts: Record<string, unknown> = {}) =>
    I18n.t('Send Message to %{name}', {name: opts.name as string}),

  todoItemCreatedSuccessfully: () => I18n.t('To-do item created successfully'),
  failedToCreateTodoItem: () => I18n.t('Failed to create to-do item. Please try again.'),
  filter: () => I18n.t('Filter'),
  incomplete: () => I18n.t('Incomplete'),
  complete: () => I18n.t('Complete'),
  noUpcomingItems: () => I18n.t('No upcoming items'),
  failedToLoadTodoItems: () => I18n.t('Failed to load to-do items. Please try again.'),
  loadingTodoItems: () => I18n.t('Loading to-do items...'),
  newTodo: () => I18n.t('+ New To-do'),
  todoListPagination: () => I18n.t('To-do list pagination'),
  updating: () => I18n.t('Updating...'),
  titleIsRequired: () => I18n.t('Title is required'),
  dateIsRequired: () => I18n.t('Date is required'),
  invalidDate: (opts: Record<string, unknown> = {}) =>
    I18n.t('%{date} is not a valid date.', {date: opts.date}),
  youMustProvideDateTime: () => I18n.t('You must provide a date and time.'),
  optionalAddCourse: () => I18n.t('Optional: Add Course'),
  addToDo: () => I18n.t('Add To Do'),
  close: () => I18n.t('Close'),
  title: () => I18n.t('Title'),
  dateTimeTodoIsDue: () => I18n.t('The date and time this to do is due'),
  date: () => I18n.t('Date'),
  nextMonth: () => I18n.t('Next Month'),
  previousMonth: () => I18n.t('Previous Month'),
  time: () => I18n.t('Time'),
  course: () => I18n.t('Course'),
  useArrowKeysToNavigate: () => I18n.t('Use arrow keys to navigate options.'),
  details: () => I18n.t('Details'),
  creating: () => I18n.t('Creating...'),
  failedToUpdateItem: () => I18n.t('Failed to update item. Please try again.'),
  dueSoon: () => I18n.t('Due soon'),
  assignment: () => I18n.t('Assignment'),
  quiz: () => I18n.t('Quiz'),
  discussion: () => I18n.t('Discussion'),
  announcement: () => I18n.t('Announcement'),
  page: () => I18n.t('Page'),
  event: () => I18n.t('Event'),
  toDo: () => I18n.t('To Do'),
  peerReview: () => I18n.t('Peer Review'),
  discussionCheckpoint: () => I18n.t('Discussion Checkpoint'),
  item: () => I18n.t('Item'),

  reorderWidgetName: (opts: Record<string, unknown> = {}) =>
    I18n.t('Reorder %{widgetName}', {widgetName: opts.widgetName}),
  removeWidgetName: (opts: Record<string, unknown> = {}) =>
    I18n.t('Remove %{widgetName}', {widgetName: opts.widgetName}),
  widgetMovedDirection: (opts: Record<string, unknown> = {}) =>
    I18n.t('%{widgetName}, moved %{direction}', {
      widgetName: opts.widgetName,
      direction: opts.direction,
    }),
  widgetRemoved: (opts: Record<string, unknown> = {}) =>
    I18n.t('%{widgetName} removed', {widgetName: opts.widgetName}),
  widgetAdded: (opts: Record<string, unknown> = {}) =>
    I18n.t('%{widgetName} added', {widgetName: opts.widgetName}),
  moveDirectionToTop: () => I18n.t('to top'),
  moveDirectionUp: () => I18n.t('up'),
  moveDirectionDown: () => I18n.t('down'),
  moveDirectionToBottom: () => I18n.t('to bottom'),
  moveDirectionToLeftBottom: () => I18n.t('to left bottom'),
  moveDirectionToLeftTop: () => I18n.t('to left top'),
  moveDirectionToRightBottom: () => I18n.t('to right bottom'),
  moveDirectionToRightTop: () => I18n.t('to right top'),
  widget: () => I18n.t('Widget'),

  // Educator Announcement Creation Widget
  loadingCourses: () => I18n.t('Loading courses'),
  failedToLoadCourses: () => I18n.t('Failed to load courses'),
  coursesPublished: () => I18n.t('Courses'),
  createAnnouncement: () => I18n.t('Create announcement'),
  searchByCourseNameOrCode: () => I18n.t('Search by course name or ID'),
  typeToSearchArrowKeys: () => I18n.t('Type to search, use arrow keys to navigate options.'),
  noMatchingCourses: () => I18n.t('No matching courses'),
  noResultsAvailable: () => I18n.t('No results available'),
  resultsAvailable: (opts: Record<string, unknown> = {}) =>
    I18n.t('%{count} results available', {count: opts.count}),
  moreTypeToFilter: (opts: Record<string, unknown> = {}) =>
    I18n.t('%{count} more — type to filter', {count: opts.count}),

  // Educator Announcement Creation Modal
  required: () => I18n.t('Required'),
  announcementTitle: () => I18n.t('Title'),
  announcementTitleRequired: () => I18n.t('Title must not be empty.'),
  announcementTitleMaxLength: () => I18n.t('Title must be less than 255 characters.'),
  announcementContent: () => I18n.t('Content'),
  announcementContentRequired: () => I18n.t('Content must not be empty.'),
  announcementContentTooLarge: () => I18n.t('Content exceeds the 16 MB size limit'),
  announcementCoursesRequired: () => I18n.t('At least one course is required'),
  announcementStartDate: () => I18n.t('Start date'),
  announcementStartTime: () => I18n.t('Start time'),
  announcementEndDate: () => I18n.t('End date'),
  announcementEndTime: () => I18n.t('End time'),
  announcementStartDateAndTime: () => I18n.t('Start date and time'),
  announcementEndDateAndTime: () => I18n.t('End date and time'),
  announcementSelectDate: () => I18n.t('Select date'),
  announcementSelectTime: () => I18n.t('Select time'),
  announcementInvalidDate: () => I18n.t('Invalid date'),
  announcementEndDateBeforeStart: () => I18n.t('End date must be after start date.'),
  announcementAllowComments: () => I18n.t('Allow participants to comment'),
  announcementEnablePodcast: () => I18n.t('Enable podcast feed'),
  announcementAllowLiking: () => I18n.t('Allow liking'),
  announcementOptions: () => I18n.t('Options'),
  announcementSend: () => I18n.t('Send'),
  announcementSending: () => I18n.t('Sending...'),
  removeCourse: (opts: Record<string, unknown> = {}) => I18n.t('Remove %{name}', {name: opts.name}),

  // Announcement creation notifications
  announcementCreatedOne: (opts: Record<string, unknown> = {}) =>
    I18n.t('Announcement created in %{count} course.', {count: opts.count}),
  announcementCreatedMany: (opts: Record<string, unknown> = {}) =>
    I18n.t('Announcements created in %{count} courses.', {count: opts.count}),
  announcementFailedOne: (opts: Record<string, unknown> = {}) =>
    I18n.t('%{count} announcement failed to post. Please check your permissions and try again.', {
      count: opts.count,
    }),
  announcementFailedMany: (opts: Record<string, unknown> = {}) =>
    I18n.t('%{count} announcements failed to post. Please check your permissions and try again.', {
      count: opts.count,
    }),

  // Educator ToDo Widget
  educatorTodoListSpeedGraderButton: () => I18n.t('Open in SpeedGrader'),
  educatorTodoListCompletionRate: (opts: Record<string, unknown> = {}) =>
    I18n.t('%{rate}% of assignments submitted', {
      rate: opts.rate,
    }),
  educatorTodoListViewAllButton: () => I18n.t('Show all'),
  educatorTodoListFailedToLoadItems: () => I18n.t('Failed to load ToDo items'),
  educatorTodoListNothingToGradeTitle: () => I18n.t('Nothing to grade yet'),
  educatorTodoListNothingToGradeDescription: () => I18n.t('Submissions will appear here.'),
  educatorTodoListNothingToReviewTitle: () => I18n.t('Nothing to review'),
  educatorTodoListNothingToReviewDescription: () => I18n.t('All submissions have been graded.'),
  educatorTodoListSubmissionFilterLabel: () => I18n.t('Submissions'),
  educatorTodoListSubmissionFilterAll: () => I18n.t('All'),
  educatorTodoListSubmissionFilterOnTime: () => I18n.t('On time'),
  educatorTodoListSubmissionFilterLate: () => I18n.t('Late'),
  educatorTodoListSubmissionFilterResubmissions: () => I18n.t('Resubmitted'),
  educatorTodoListSubmissionTagLate: (opts: Record<string, unknown> = {}) =>
    I18n.t('Late (%{amount})', {
      amount: opts.amount,
    }),
  educatorTodoListSubmissionTagResubmitted: (opts: Record<string, unknown> = {}) =>
    I18n.t('Resubmitted (%{amount})', {
      amount: opts.amount,
    }),
  educatorTodoListSubmissionTagOnTime: (opts: Record<string, unknown> = {}) =>
    I18n.t('On time (%{amount})', {
      amount: opts.amount,
    }),

  // Educator ToDo Modal
  educatorTodoListModalLabel: () => I18n.t('Full list of assignments to grade'),
  educatorTodoListModalHeading: () => I18n.t('To grade'),
  educatorTodoListModalPagination: () => I18n.t('Items to grade pagination'),
  educatorTodoListModalFailedToLoadItems: () => I18n.t('Failed to load ToDo items'),
  educatorTodoListModalMoreItemAlert: () =>
    I18n.t('More assignments are available. Apply filter to see more.'),

  account: () => I18n.t('Account'),
  addStudentModalDescription: () =>
    I18n.t('Add a student to observe by entering their pairing code.'),
  addStudentModalError: () => I18n.t('Could not add student. Please try again.'),
  addStudentModalInvalidCode: () => I18n.t('The pairing code is invalid or expired.'),
  addStudentModalPairButton: () => I18n.t('Pair'),
  addStudentModalPairingCodeLabel: () => I18n.t('Pairing code'),
  addStudentModalPairingCodeRequired: () => I18n.t('Pairing code is required.'),
  addStudentModalSuccess: () => I18n.t('Student added.'),
  addStudentModalTitle: () => I18n.t('Add a student'),
  allAccounts: () => I18n.t('All accounts'),
  assignmentsAndQuizzes: () => I18n.t('Assignments and quizzes'),
  assignmentsDueThisWeek: () => I18n.t('Assignments due this week'),
  assignmentsOverdue: () => I18n.t('Assignments overdue'),
  courseRemoved: () => I18n.t('Course removed'),
  courseSelected: () => I18n.t('Course selected'),
  currentGrade: () => I18n.t('Current grade'),
  educatorA11yActiveCount: () => I18n.t('Active issues count'),
  educatorA11yAllResolvedDescription: () => I18n.t('All accessibility issues have been resolved.'),
  educatorA11yAllResolvedTitle: () => I18n.t('All resolved'),
  educatorA11yLastUpdated: () => I18n.t('Last updated'),
  educatorA11yNavigateToCourse: () => I18n.t('Navigate to course'),
  educatorA11yNoIssuesDescription: () => I18n.t('No accessibility issues have been found.'),
  educatorA11yNoIssuesTitle: () => I18n.t('No issues'),
  educatorA11yPagination: () => I18n.t('Accessibility issues pagination'),
  educatorA11yPublished: () => I18n.t('Published'),
  educatorA11yUnpublished: () => I18n.t('Unpublished'),
  failedToLoadContentQuality: () => I18n.t('Failed to load content quality.'),
  gradesAndFeedback: () => I18n.t('Grades and feedback'),
  maxSelectionsReached: () => I18n.t('Maximum selections reached.'),
  messageInstructor: () => I18n.t('Message instructor'),
  messages: () => I18n.t('Messages'),
  newGrade: () => I18n.t('New grade'),
  observerPickerAddStudent: () => I18n.t('Add student'),
  observerPickerAssistiveText: () => I18n.t('Type to filter the list of observed students.'),
  observerPickerLabel: () => I18n.t('Observing:'),
  observerPickerNoResults: () => I18n.t('No matching students'),
  observerPickerObserving: () => I18n.t('Observing'),
  opensInNewTab: () => I18n.t('Opens in a new tab'),
  quizzesDueThisWeek: () => I18n.t('Quizzes due this week'),
  removeAllCourses: () => I18n.t('Remove all courses'),
  ungradedSubmissions: () => I18n.t('Ungraded submissions'),
  upToDate: () => I18n.t('Up to date'),
  view: () => I18n.t('View'),
  viewAccountDashboard: () => I18n.t('View account dashboard'),
  workDue: () => I18n.t('Work due'),
  closed: () => I18n.t('Closed'),
  done: () => I18n.t('Done'),
  editToDo: () => I18n.t('Edit To Do'),
  failedToUpdateTodoItem: () => I18n.t('Failed to update to-do item. Please try again.'),
  markAsDone: () => I18n.t('Mark as done'),
  saving: () => I18n.t('Saving...'),
  showAll: () => I18n.t('Show all'),
  showOverdue: () => I18n.t('Show overdue'),
  showUpcoming: () => I18n.t('Show upcoming'),
  todoItemUpdatedSuccessfully: () => I18n.t('To-do item updated successfully'),
  unnamedTodo: () => I18n.t('Unnamed To-Do'),
}

// Literal-keyed thunks: platform-widget-dashboard passes English source strings
// (e.g. "%{points} pts") directly to translate(). Routing them through I18n.t
// here lets i18nliner extract them so non-English locales render translated
// values instead of hardcoded English.
const LITERAL_THUNKS: Record<string, TranslationThunk> = {
  '%{points} pts': (opts = {}) => I18n.t('%{points} pts', {points: opts.points}),
  '%{date} %{time}': (opts = {}) => I18n.t('%{date} %{time}', {date: opts.date, time: opts.time}),
  '%{day} %{time}': (opts = {}) => I18n.t('%{day} %{time}', {day: opts.day, time: opts.time}),
  '%{widgetName}': (opts = {}) => I18n.t('%{widgetName}', {widgetName: opts.widgetName}),
  'Details must be %{max} characters or less': (opts = {}) =>
    I18n.t('Details must be %{max} characters or less', {max: opts.max}),
  'Due %{date}': (opts = {}) => I18n.t('Due %{date}', {date: opts.date}),
  'Due in %{count} hours': (opts = {}) =>
    I18n.t(
      'due_in_n_hours',
      {one: 'Due in 1 hour', other: 'Due in %{count} hours'},
      {count: opts.count as number},
    ),
  'Due soon': () => I18n.t('Due soon'),
  Excused: () => I18n.t('Excused'),
  'Go to %{courseName}': (opts = {}) =>
    I18n.t('Go to %{courseName}', {courseName: opts.courseName}),
  'Grade updated %{days} days ago': (opts = {}) =>
    I18n.t(
      'grade_updated_n_days_ago',
      {one: 'Grade updated 1 day ago', other: 'Grade updated %{days} days ago'},
      {count: opts.days as number, days: opts.days},
    ),
  'Graded %{count} days ago': (opts = {}) =>
    I18n.t(
      'graded_n_days_ago',
      {one: 'Graded 1 day ago', other: 'Graded %{count} days ago'},
      {count: opts.count as number},
    ),
  'Graded %{count} hours ago': (opts = {}) =>
    I18n.t(
      'graded_n_hours_ago',
      {one: 'Graded 1 hour ago', other: 'Graded %{count} hours ago'},
      {count: opts.count as number},
    ),
  'Graded %{count} minutes ago': (opts = {}) =>
    I18n.t(
      'graded_n_minutes_ago',
      {one: 'Graded 1 minute ago', other: 'Graded %{count} minutes ago'},
      {count: opts.count as number},
    ),
  'Hide grades for %{courseName}': (opts = {}) =>
    I18n.t('Hide grades for %{courseName}', {courseName: opts.courseName}),
  Late: () => I18n.t('Late'),
  'Mark %{title} as complete': (opts = {}) =>
    I18n.t('Mark %{title} as complete', {title: opts.title}),
  'Mark %{title} as incomplete': (opts = {}) =>
    I18n.t('Mark %{title} as incomplete', {title: opts.title}),
  Missing: () => I18n.t('Missing'),
  'No due date': () => I18n.t('No due date'),
  'Not Submitted': () => I18n.t('Not Submitted'),
  Overdue: () => I18n.t('Overdue'),
  'Pending Review': () => I18n.t('Pending Review'),
  'Show grades for %{courseName}': (opts = {}) =>
    I18n.t('Show grades for %{courseName}', {courseName: opts.courseName}),
  Submitted: () => I18n.t('Submitted'),
  'Title must be %{max} characters or less': (opts = {}) =>
    I18n.t('Title must be %{max} characters or less', {max: opts.max}),
  Today: () => I18n.t('Today'),
  Tomorrow: () => I18n.t('Tomorrow'),
  'Updated today': () => I18n.t('Updated today'),
  'View %{courseName} gradebook': (opts = {}) =>
    I18n.t('View %{courseName} gradebook', {courseName: opts.courseName}),
}

export const translations = new Proxy({} as WidgetDashboardTranslations, {
  get(_target, prop: string) {
    return NAMED_THUNKS[prop as NamedTranslationKey]?.() ?? prop
  },
})

export function translate(key: string, options?: Record<string, unknown>): string {
  const thunk = NAMED_THUNKS[key as NamedTranslationKey] ?? LITERAL_THUNKS[key]
  if (thunk) return thunk(options)
  if (!options) return key
  // Last-resort safety net. Bypasses I18n.t — register a LITERAL_THUNKS entry
  // for any package-side string that needs to localize.
  return key.replace(/%\{(\w+)\}/g, (_match, name) => {
    if (!Object.prototype.hasOwnProperty.call(options, name)) return ''
    const v = options[name]
    if (v == null || typeof v === 'object' || typeof v === 'function') return ''
    return String(v)
  })
}

export function PlatformBridge({children}: {children: React.ReactNode}) {
  return (
    <PlatformUiProvider
      executeQuery={platformExecuteQuery}
      currentUserId={ENV.current_user?.id ?? ''}
      locale={ENV.LOCALE}
      timezone={ENV.TIMEZONE}
      queryClient={queryClient}
      notify={({type, message}) => showFlashAlert({type, message})}
    >
      <TranslationsProvider
        translations={translations}
        translate={translate}
        announceForScreenReader={announceToScreenReader}
      >
        {children}
      </TranslationsProvider>
    </PlatformUiProvider>
  )
}
