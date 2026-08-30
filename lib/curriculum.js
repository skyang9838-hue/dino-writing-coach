// Fixed lists for the activity creation form. Deliberately not AI-generated —
// AI is used only for student coaching feedback, never for authoring activities.

export const GRADES = [
  { value: '초1-2학년군', recommendedLength: 200 },
  { value: '초3-4학년군', recommendedLength: 400 },
  { value: '초5-6학년군', recommendedLength: 600 },
]

export const INTERVIEW_REPORT_GENRE = '면담 보고서'

// The only unit carrying an achievement standard and grading criteria so far.
// The coaching pipeline (lib/coaching.js) is pinned to it.
export const INTERVIEW_REPORT_UNIT_ID = 'g6s2-unit2'

export const GENRES = [
  INTERVIEW_REPORT_GENRE,
  '일기',
  '편지',
  '주장하는 글',
  '설명하는 글',
  '이야기(창작)',
  '독서감상문',
  '감상문',
  '기록문',
  '보고서',
  '기사문',
]

export const LENGTH_OPTIONS = [100, 150, 200, 250, 300, 400, 500, 600, 700, 800]

export const GENRE_COACHING_GUIDANCE = {
  [INTERVIEW_REPORT_GENRE]: '면담 목적과 대상, 새롭게 알게 된 사실, 보고서의 앞·가운데·뒷부분 짜임이 드러나는지 함께 봐줘.',
  일기: '그날 있었던 일과 그때 느낀 감정이 잘 드러나는지도 함께 봐줘.',
  편지: '받는 사람에 대한 마음이 잘 전달되는지, 첫인사·끝인사 같은 편지 형식을 갖췄는지도 함께 봐줘.',
  '주장하는 글': '주장이 분명한지, 그 주장을 뒷받침하는 근거가 있는지도 함께 봐줘.',
  '설명하는 글': '설명하는 대상의 특징이 순서에 맞게 잘 정리되어 있는지도 함께 봐줘.',
  '이야기(창작)': '이야기의 흐름(처음-가운데-끝)이 자연스러운지, 등장인물의 감정이 잘 드러나는지도 함께 봐줘.',
  독서감상문: '책의 내용과 그에 대한 자신의 생각·느낌이 잘 구분되어 드러나는지도 함께 봐줘.',
  감상문: '보고 느낀 점과 그 이유가 잘 드러나는지, 작품 내용 소개와 자신의 생각이 잘 구분되는지도 함께 봐줘.',
  기록문: '직접 경험한 일이 순서대로 잘 정리되어 있는지, 보고 듣고 느낀 점이 잘 드러나는지도 함께 봐줘.',
  보고서: '토의·토론에서 나온 의견과 근거가 잘 정리되어 있는지, 결론이 명확한지도 함께 봐줘.',
  기사문: '사실과 의견이 구분되어 있는지, 육하원칙(누가·언제·어디서·무엇을·어떻게·왜)이 잘 드러나는지도 함께 봐줘.',
}

export const GRADE6_SEMESTER1_UNITS = [
  {
    id: INTERVIEW_REPORT_UNIT_ID,
    unitNumber: 2,
    icon: '🎤',
    title: '면담 보고서 쓰기',
    description: '면담한 내용을 목적과 짜임에 맞게 보고서로 써요.',
    genre: INTERVIEW_REPORT_GENRE,
    recommendedLength: 600,

    // One achievement standard per unit, shown once above the cards on the
    // teacher's revision board rather than repeated on every card.
    standard: {
      code: '6국01-04',
      text: '면담의 절차를 이해하고 상대와 매체를 고려하여 면담한다.',
    },

    // Grading criteria grouped into chunks. `evaluator` decides who judges a
    // criterion: 'ai' goes through the Gemini pipeline, 'teacher' is display
    // only (always shown as —) and never reaches the AI. getAiRubrics() below
    // is what enforces that separation.
    chunks: [
      {
        id: 'interview-procedure',
        label: '면담의 절차',
        description: '면담 보고서의 특징',
        criteria: [
          {
            id: 'purpose-and-target',
            evaluator: 'ai',
            label: '면담의 목적과 대상을 밝혔다.',
            shortLabel: '목적·대상이 드러난다',
            priority: 30,
            statuses: {
              met: '누구에게서 무엇을 알아보려 했는지가 둘 다 분명하다.',
              partial: '목적과 대상 중 하나만 분명하거나, “그분”처럼 누구인지 알기 어렵다.',
              unmet: '면담 목적도 대상도 식별할 수 없다.',
            },
            missionSeed: '면담한 사람이 누구인지 밝히고, 그 사람에게서 무엇을 알아보려 했는지 이어서 안내',
          },
          {
            id: 'preparation',
            evaluator: 'ai',
            label: '면담 준비 과정을 돌아보아 썼다.',
            shortLabel: '준비 과정이 드러난다',
            priority: 60,
            statuses: {
              met: '질문 만들기, 자료 조사, 약속 잡기처럼 면담 전에 한 준비 행동이 글에 직접 드러난다.',
              partial: '준비했다는 언급은 있으나 무엇을 준비했는지 알기 어렵다.',
              unmet: '면담 준비 과정을 식별할 수 없다.',
            },
            missionSeed: '면담 전에 무엇을 준비했는지 질문 만들기, 자료 조사, 약속 잡기 가운데 실제로 한 일로 밝히도록 안내',
          },
          {
            id: 'learned-facts',
            evaluator: 'ai',
            label: '새롭게 알게 된 사실을 소개했다.',
            shortLabel: '새롭게 안 사실이 드러난다',
            priority: 10,
            statuses: {
              met: '면담으로 새롭게 알게 된 사실과 함께 그 사실의 이유, 과정, 사례, 상황 중 하나 이상을 설명한다.',
              partial: '새롭게 알게 된 사실은 있으나 단순히 나열하거나 뭉뚱그려 표현한다.',
              unmet: '면담으로 새롭게 알게 된 사실을 식별할 수 없다.',
            },
            missionSeed: '면담에서 새롭게 알게 된 사실 하나를 고르고, 그 사실의 이유·과정·사례·상황 중 하나를 덧붙이도록 안내',
          },
          {
            id: 'reflection',
            evaluator: 'ai',
            label: '면담 후 느낀 점을 밝혔다.',
            shortLabel: '느낀 점이 드러난다',
            priority: 50,
            statuses: {
              met: '면담 뒤에 든 생각, 느낌, 변화를 구체적으로 밝힌다.',
              partial: '느낌이 짧거나 막연해서 무엇을 느꼈는지 알기 어렵다.',
              unmet: '면담 후 느낀 점을 찾을 수 없다.',
            },
            missionSeed: '면담 뒤에 생긴 생각, 느낌, 변화 중 하나를 학생 말로 덧붙이도록 안내',
          },
        ],
      },
      {
        id: 'audience-and-medium',
        label: '상대와 매체 고려',
        description: '상대와 매체를 고려하여 면담하기',
        // The teacher's own call — the writing alone can't show whether the
        // student considered who they were talking to or which medium they
        // used. No statuses, no missionSeed, no priority: the AI never sees
        // these, so it has nothing to judge them with.
        criteria: [
          {
            id: 'audience',
            evaluator: 'teacher',
            label: '상대를 고려하여 면담했다.',
            shortLabel: '상대를 고려했는가?',
          },
          {
            id: 'medium',
            evaluator: 'teacher',
            label: '매체를 고려하여 면담했다.',
            shortLabel: '매체를 고려했는가?',
          },
        ],
      },
    ],
  },
  {
    id: 'g6s1-unit2',
    unitNumber: 2,
    icon: '🎬',
    title: '영화 감상문을 쓰고 고쳐쓰기',
    description: '영화를 보고 느낀 점을 쓰고 고쳐가며 글을 완성해요.',
    genre: '감상문',
    recommendedLength: 600,
  },
  {
    id: 'g6s1-unit4',
    unitNumber: 4,
    icon: '🚌',
    title: '견학 기록문 쓰기',
    description: '견학을 다녀와 경험한 내용을 기록문으로 써요.',
    genre: '기록문',
    recommendedLength: 600,
  },
  {
    id: 'g6s1-unit5',
    unitNumber: 5,
    icon: '📣',
    title: '주장하는 글 쓰기',
    description: '자신의 의견을 정하고 근거를 들어 주장하는 글을 써요.',
    genre: '주장하는 글',
    recommendedLength: 600,
  },
  {
    id: 'g6s1-unit6',
    unitNumber: 6,
    icon: '💌',
    title: '편지 쓰기',
    description: '상황에 맞는 편지를 작성해요.',
    genre: '편지',
    recommendedLength: 400,
  },
  {
    id: 'g6s1-unit7',
    unitNumber: 7,
    icon: '💬',
    title: '토의·토론 보고서 쓰기',
    description: '토의·토론 내용을 정리하여 보고서를 써요.',
    genre: '보고서',
    recommendedLength: 600,
  },
  {
    id: 'g6s1-unit8',
    unitNumber: 8,
    icon: '📰',
    title: '기사문 쓰기',
    description: '사실을 바탕으로 기사문을 써요.',
    genre: '기사문',
    recommendedLength: 600,
  },
  {
    id: 'g6s1-unit9',
    unitNumber: 9,
    icon: '📔',
    title: '설명하는 글 쓰기',
    description: '대상이나 개념을 설명하는 글을 써요.',
    genre: '설명하는 글',
    recommendedLength: 600,
  },
]

// Icon shown on activity cards (dashboard, activity detail roster). Covers
// every entry in GENRES, not just the ones the unit picker currently offers,
// so older activities created before the unit-card redesign still get an icon.
const GENRE_ICONS = {
  [INTERVIEW_REPORT_GENRE]: '🎤',
  일기: '📔',
  편지: '💌',
  '주장하는 글': '📣',
  '설명하는 글': '📚',
  '이야기(창작)': '📝',
  독서감상문: '📖',
  감상문: '🎬',
  기록문: '🚌',
  보고서: '💬',
  기사문: '📰',
}

export function getGenreIcon(genre) {
  return GENRE_ICONS[genre] ?? '✍️'
}

export function getRecommendedLength(grade) {
  return GRADES.find((g) => g.value === grade)?.recommendedLength ?? null
}

export function getGenreGuidance(genre) {
  return GENRE_COACHING_GUIDANCE[genre] ?? null
}

export function getUnitById(unitId) {
  return GRADE6_SEMESTER1_UNITS.find((unit) => unit.id === unitId) ?? null
}

export function getUnitStandard(unitId) {
  return getUnitById(unitId)?.standard ?? null
}

// Everything the board draws, teacher-judged criteria included.
export function getUnitChunks(unitId) {
  return getUnitById(unitId)?.chunks ?? null
}

// The firewall between the board and the coaching pipeline. Teacher-judged
// criteria do not come out of here, so they cannot reach the assessment
// prompt, the schema enums, or the mission candidates — the pipeline has no
// way to learn they exist. The shape is exactly what
// buildInterviewAssessmentPrompt has always taken: [{ id, label, criteria }].
export function getAiRubrics(unitId) {
  const chunks = getUnitChunks(unitId)
  if (!chunks) return null

  return chunks
    .map((chunk) => ({
      id: chunk.id,
      label: chunk.label,
      criteria: chunk.criteria.filter((criterion) => criterion.evaluator === 'ai'),
    }))
    .filter((chunk) => chunk.criteria.length > 0)
}
