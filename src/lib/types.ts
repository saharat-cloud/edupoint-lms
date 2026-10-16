// ============================================================
// EduPoint LMS — TypeScript Types
// ============================================================

export type UserRole = 'SUPER_ADMIN' | 'TEACHER' | 'STUDENT' | 'KIOSK'
export type StudentStatus = 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'TRANSFERRED'
export type AcademicYearStatus = 'ACTIVE' | 'CLOSED' | 'UPCOMING'
export type SemesterStatus = 'ACTIVE' | 'CLOSED' | 'UPCOMING'
export type EnrollmentStatus = 'ACTIVE' | 'DROPPED' | 'COMPLETED'
export type ActivityStatus = 'UPCOMING' | 'ACTIVE' | 'CLOSED'
export type AssignmentStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED'
export type AssignmentTargetStatus = 'ASSIGNED' | 'COMPLETED' | 'EXCUSED'
export type QuestionType = 'TEXT' | 'SHORT_ANSWER' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FILE_UPLOAD' | 'IMAGE_UPLOAD'
export type SubmissionStatus = 'DRAFT' | 'SUBMITTED' | 'REVIEWING' | 'RETURNED' | 'RESUBMISSION_REQUIRED' | 'GRADED'
export type ConversationStatus = 'WAITING_TEACHER' | 'WAITING_STUDENT' | 'RESOLVED' | 'CLOSED'
export type SenderRoleType = 'STUDENT' | 'TEACHER' | 'ADMIN'
export type NotificationType = 
  | 'ASSIGNMENT_NEW' | 'ASSIGNMENT_DUE' | 'SUBMISSION_RECEIVED' | 'SUBMISSION_GRADED'
  | 'RESUBMISSION_REQUIRED' | 'POINT_AWARDED' | 'GAME_REWARD' | 'NEW_MESSAGE' | 'TEACHER_REPLY'
  | 'STUDENT_QUESTION' | 'ASSIGNMENT_GRADED'
export type PointTransactionType = 'EARN' | 'BONUS' | 'DEDUCTION' | 'ADJUSTMENT' | 'CORRECTION'
export type PointSourceType = 'ACTIVITY' | 'ASSIGNMENT' | 'GAME' | 'QUIZ' | 'BONUS' | 'KIOSK' | 'TEACHER_ADJUSTMENT' | 'MANUAL' | 'PURCHASE'
export type PointFormulaType = 'LINEAR' | 'THRESHOLD' | 'CUSTOM'
export type GameStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

// ---- Entities ----

export interface Profile {
  id: string
  role: UserRole
  full_name: string | null
  email: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface EducationLevel {
  id: string
  name: string
  code: string
  description: string | null
  sort_order: number
  created_at: string
}

export interface AcademicYear {
  id: string
  name: string
  start_date: string
  end_date: string
  status: AcademicYearStatus
  created_at: string
  updated_at: string
}

export interface Semester {
  id: string
  academic_year_id: string
  name: string
  start_date: string
  end_date: string
  status: SemesterStatus
  created_at: string
  updated_at: string
  academic_year?: AcademicYear
}

export interface ClassRoom {
  id: string
  education_level_id: string
  academic_year_id: string
  name: string
  room_code: string
  max_students: number
  created_at: string
  updated_at: string
  education_level?: EducationLevel
  academic_year?: AcademicYear
}

export interface Subject {
  id: string
  code: string
  name: string
  description: string | null
  credit: number
  created_at: string
  updated_at: string
}

export interface Student {
  id: string
  user_id: string | null
  card_number: string | null
  student_code: string
  first_name: string
  last_name: string
  nickname: string | null
  education_level_id: string | null
  class_room_id: string | null
  status: StudentStatus
  avatar_url: string | null
  created_at: string
  updated_at: string
  education_level?: EducationLevel
  class_room?: ClassRoom
  total_points?: number
}

export interface TeacherSubject {
  id: string
  teacher_id: string
  subject_id: string
  class_room_id: string
  semester_id: string
  created_at: string
  subject?: Subject
  class_room?: ClassRoom
  semester?: Semester
  teacher?: Profile
}

export interface Enrollment {
  id: string
  student_id: string
  subject_id: string
  class_room_id: string
  semester_id: string
  status: EnrollmentStatus
  enrolled_at: string
  subject?: Subject
  class_room?: ClassRoom
  semester?: Semester
}

export interface Activity {
  id: string
  name: string
  description: string | null
  default_points: number
  start_at: string | null
  end_at: string | null
  status: ActivityStatus
  created_by: string
  created_at: string
  updated_at: string
}

export interface ActivityPermission {
  id: string
  activity_id: string
  student_id: string
  points: number | null
  status: string
  created_at: string
  student?: Student
  activity?: Activity
}

export interface Checkin {
  id: string
  student_id: string
  activity_id: string
  card_number: string
  points_awarded: number
  kiosk_id: string | null
  created_at: string
  student?: Student
  activity?: Activity
}

export interface PointTransaction {
  id: string
  student_id: string
  points: number
  transaction_type: PointTransactionType
  source_type: PointSourceType
  source_id: string | null
  assignment_id: string | null
  game_id: string | null
  activity_id: string | null
  submission_id: string | null
  note: string | null
  created_by: string | null
  created_at: string
  assignment?: Assignment
  activity?: Activity
  game?: Game
}

export interface Assignment {
  id: string
  subject_id: string
  teacher_id: string
  semester_id: string
  title: string
  description: string | null
  instructions: string | null
  academic_full_score: number
  point_target: number
  point_formula: PointFormulaType
  point_formula_config: Record<string, unknown>
  start_at: string | null
  due_at: string | null
  allow_late: boolean
  late_penalty_type: string
  late_penalty_value: number
  max_submissions: number
  status: AssignmentStatus
  created_at: string
  updated_at: string
  subject?: Subject
  teacher?: Profile
  semester?: Semester
  questions?: AssignmentQuestion[]
  attachments?: AssignmentAttachment[]
  targets_count?: number
  submissions_count?: number
}

export interface AssignmentTarget {
  id: string
  assignment_id: string
  student_id: string
  assigned_at: string
  status: AssignmentTargetStatus
  completed_at: string | null
  student?: Student
  assignment?: Assignment
}

export interface AssignmentQuestion {
  id: string
  assignment_id: string
  question_type: QuestionType
  question_text: string
  options: unknown[]
  correct_answer: unknown | null
  points: number
  required: boolean
  sort_order: number
  created_at: string
}

export interface AssignmentAttachment {
  id: string
  assignment_id: string
  file_name: string
  storage_path: string
  file_type: string | null
  file_size: number | null
  created_at: string
  signed_url?: string
}

export interface Submission {
  id: string
  assignment_id: string
  student_id: string
  attempt_number: number
  status: SubmissionStatus
  submitted_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  academic_score: number | null
  points_earned: number | null
  teacher_feedback: string | null
  is_late: boolean
  created_at: string
  updated_at: string
  assignment?: Assignment
  student?: Student
  answers?: SubmissionAnswer[]
  files?: SubmissionFile[]
  grade?: AssignmentGrade
}

export interface SubmissionAnswer {
  id: string
  submission_id: string
  question_id: string
  answer_text: string | null
  answer_json: unknown | null
  auto_score: number | null
  teacher_score: number | null
  teacher_feedback: string | null
  created_at: string
  updated_at: string
  question?: AssignmentQuestion
}

export interface SubmissionFile {
  id: string
  submission_id: string
  question_id: string | null
  file_name: string
  storage_path: string
  file_type: string | null
  file_size: number | null
  created_at: string
  signed_url?: string
}

export interface AssignmentGrade {
  id: string
  assignment_id: string
  student_id: string
  submission_id: string | null
  academic_score: number
  full_score: number
  percentage: number | null
  point_earned: number
  graded_by: string | null
  graded_at: string | null
  created_at: string
  updated_at: string
}

export interface GradeRule {
  id: string
  name: string
  subject_id: string | null
  semester_id: string | null
  created_by: string
  is_default: boolean
  created_at: string
  items?: GradeRuleItem[]
}

export interface GradeRuleItem {
  id: string
  grade_rule_id: string
  min_score: number
  max_score: number
  grade: string
  grade_point: number
  sort_order: number
}

export interface GradeWeight {
  id: string
  subject_id: string
  semester_id: string
  class_room_id: string
  teacher_id: string
  assignment_weight: number
  quiz_weight: number
  midterm_weight: number
  final_weight: number
  created_at: string
  updated_at: string
}

export interface AssignmentConversation {
  id: string
  assignment_id: string
  student_id: string
  teacher_id: string | null
  submission_id: string | null
  status: ConversationStatus
  last_message_at: string | null
  last_message_by: string | null
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
  updated_at: string
  assignment?: Assignment
  student?: Student
  teacher?: Profile
  messages?: ConversationMessage[]
  unread_count?: number
}

export interface ConversationMessage {
  id: string
  conversation_id: string
  sender_user_id: string
  sender_role: SenderRoleType
  message: string
  reply_to_message_id: string | null
  is_read: boolean
  created_at: string
  attachments?: ConversationAttachment[]
  sender?: Profile
}

export interface ConversationAttachment {
  id: string
  message_id: string
  file_name: string
  storage_path: string
  file_type: string | null
  file_size: number | null
  created_at: string
  signed_url?: string
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string | null
  reference_type: string | null
  reference_id: string | null
  is_read: boolean
  created_at: string
}

export interface Game {
  id: string
  title: string
  description: string | null
  game_type: 'QUIZ' | 'SHOOTER' | 'RUNNER' | 'MATCHING'
  category: string | null
  thumbnail_url: string | null
  max_score: number
  pass_score: number
  point_reward: number
  max_attempts: number
  cooldown_seconds: number
  status: GameStatus
  created_by: string
  created_at: string
  updated_at: string
  questions?: GameQuestion[]
  attempts_count?: number
  best_score?: number
}

export interface GameQuestion {
  id: string
  game_id: string
  question: string
  options: string[]
  correct_answer: string
  explanation: string | null
  points: number
  sort_order: number
  created_at: string
}

export interface GameAttempt {
  id: string
  game_id: string
  student_id: string
  answers: Record<string, string>
  score: number | null
  percentage: number | null
  passed: boolean | null
  started_at: string
  finished_at: string | null
  completed_at: string | null
  reward_given: boolean
  game?: Game
}

export interface GameReward {
  id: string
  game_id: string
  student_id: string
  attempt_id: string
  points: number
  created_at: string
}

export interface PointSetting {
  id: number
  term_max_points: number
  updated_at: string
}

export interface PointLevel {
  id: string
  name: string
  min_points: number
  max_points: number | null
  color: string
  sort_order: number
  created_at: string
}

// ---- RPC Response Types ----

export interface KioskCheckInResult {
  success: boolean
  code: string
  message?: string
  student_id?: string
  student_name?: string
  nickname?: string
  points_awarded?: number
  total_points?: number
  activity_name?: string
  checkin_id?: string
}

export interface GameScoreResult {
  success: boolean
  code?: string
  message?: string
  score?: number
  max_score?: number
  percentage?: number
  passed?: boolean
  points_awarded?: number
  total_points?: number
}

export interface GradeResult {
  success: boolean
  code?: string
  message?: string
  academic_score?: number
  percentage?: number
  points_earned?: number
  status?: SubmissionStatus
}

// ---- UI Helper Types ----

export interface SelectOption {
  value: string
  label: string
}

export interface PaginationMeta {
  page: number
  perPage: number
  total: number
  totalPages: number
}

export interface TableColumn<T> {
  key: keyof T | string
  label: string
  sortable?: boolean
  render?: (row: T) => React.ReactNode
}

export interface UploadedFile {
  file: File
  preview?: string
  progress?: number
  error?: string
  uploaded?: boolean
  storagePath?: string
}

// ---- Dashboard Stats ----

export interface TeacherStats {
  totalStudents: number
  totalAssignments: number
  activeAssignments: number
  pendingSubmissions: number
  waitingConversations: number
  activeGames: number
  averageScore: number
}

export interface StudentStats {
  totalPoints: number
  assignmentCount: number
  pendingCount: number
  gradedCount: number
  resubmitCount: number
  nearDueCount: number
  unreadMessages: number
  unreadNotifications: number
}
