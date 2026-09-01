// Fixed lists for the activity creation form. Deliberately not AI-generated —
// AI is used only for student coaching feedback, never for authoring activities.

export const GRADES = [
  { value: '초1-2학년군', recommendedLength: 200 },
  { value: '초3-4학년군', recommendedLength: 400 },
  { value: '초5-6학년군', recommendedLength: 600 },
]

export const INTERVIEW_REPORT_GENRE = '면담 보고서'

// The unit the coaching pipeline was first built against. Nothing is pinned to
// it any more — every unit carrying AI criteria runs the same pipeline — but
// lib/interviewEval.js and the eval fixtures are still written for this one.
export const INTERVIEW_REPORT_UNIT_ID = 'g6s2-unit2'

export const GENRES = [
  INTERVIEW_REPORT_GENRE,
  '줄거리 요약',
  '매체 성찰 보고서',
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
  '줄거리 요약': '이야기의 중요한 사건이 일어난 순서대로 간추려졌는지, 덜 중요한 내용이 빠졌는지도 함께 봐줘.',
  '매체 성찰 보고서': '자신의 매체 이용 경험을 돌아본 까닭과 고쳐야 할 점, 느낀 점이 드러나는지도 함께 봐줘.',
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

// Who decides whether a criterion is satisfied.
//
//   'ai'                  디노가 판정한다. 보드에 판정과 직전 대비 변화가 나온다.
//   'teacher'             선생님 몫. AI는 이 항목이 있다는 사실조차 모른다.
//   'teacher-ai-feedback' 판정은 선생님 몫이라 보드에는 —로 나오지만, 디노는
//                         이 항목을 보고 수정미션으로 조언할 수 있다.
//
// The third one exists because the curriculum notes say "교사재량 but 피드백은
// 가능하다" for several criteria: a teacher settles them, yet a student can
// still act on advice about them. So the AI judges them like any other
// criterion — that judgement is what decides which missions get written — but
// the verdict itself never reaches the board, where only the teacher's call
// belongs. getAiRubrics() and showsAiVerdict() are the two sides of that.
const AI_JUDGED_EVALUATORS = new Set(['ai', 'teacher-ai-feedback'])

export function isAiJudged(criterion) {
  return AI_JUDGED_EVALUATORS.has(criterion?.evaluator)
}

// Whether the board prints the AI's verdict for this criterion, as opposed to
// merely letting the AI see it.
export function showsAiVerdict(criterion) {
  return criterion?.evaluator === 'ai'
}

// 6학년 2학기 국어. Each unit may carry achievement standards and grading
// criteria grouped into chunks; a unit without them still works as an activity
// template, it just gets no criteria table on the teacher's board.
//
// Only the criteria are data the AI acts on. `standards`, `title` and
// `description` are for teachers reading the screen.
export const GRADE6_SEMESTER2_UNITS = [
  {
    id: 'g6s2-unit1',
    unitNumber: 1,
    icon: '📜',
    title: '줄거리 간추리기',
    description: '이야기의 중요한 사건을 골라 순서대로 간추려요.',
    genre: '줄거리 요약',
    // Shorter than the other units on purpose: a summary that runs as long as
    // the original is not a summary. Assumed, not taken from the curriculum
    // notes — the notes for this unit have not been written yet.
    recommendedLength: 400,
    // 성취기준과 채점기준은 아직 안 들어왔다. 그전까지 이 단원은 활동 틀로만
    // 쓰이고, 보드에 채점기준표가 나오지 않는다.
  },
  {
    id: INTERVIEW_REPORT_UNIT_ID,
    unitNumber: 2,
    icon: '🎤',
    title: '면담 보고서 쓰기',
    description: '면담한 내용을 목적과 짜임에 맞게 보고서로 써요.',
    genre: INTERVIEW_REPORT_GENRE,
    recommendedLength: 600,

    // Achievement standards, shown once above the cards on the teacher's
    // revision board rather than repeated on every card. Most units have one;
    // the 매체 unit has two, which is why this is a list.
    standards: [
      {
        code: '6국01-04',
        text: '면담의 절차를 이해하고 상대와 매체를 고려하여 면담한다.',
      },
    ],

    // Extra 공통 판정 원칙 lines for this unit's assessment prompt, appended
    // after the ones every unit shares.
    assessmentGuidance: [
      '질문과 답이 드러나면 “면담”이라는 낱말이 없어도 면담으로 얻은 정보로 인정해.',
    ],

    // Two named slots in the mission prompt's rule list. They sit at fixed
    // positions so one unit can say "don't invent 면담 내용" where another says
    // "don't invent 취재 내용" without the rest of the list shifting around.
    missionGuidance: {
      grounding: '학생 글에 실제로 나온 내용을 짚되 학생 글에 없는 면담 내용이나 사실을 만들어내지 마.',
      selfFill: '질문이나 단서는 줄 수 있지만 학생이 면담에서 들은 내용을 스스로 채우게 해.',
    },

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
            refinementSeed: '이미 밝힌 면담 목적과 대상이 본문의 핵심 면담 내용과 더 분명히 이어지도록 표현을 다듬게 안내',
            fallbackMissionTitle: '면담 목적과 대상 밝히기',
            assessmentNotes: [
              'purpose-and-target은 무엇을 알아보려 했는지와 면담 대상이 누구인지가 둘 다 드러나야 met이야. 둘 중 하나만 드러나면 partial이고, 둘 다 찾을 수 없을 때만 unmet이야.',
              '면담 대상은 이름, 관계, 직업, 역할 중 하나라도 있으면 밝힌 것으로 인정해. “그분”, “어떤 사람”처럼 누구인지 알기 어려우면 인정하지 마.',
              '뒤에 나온 면담 내용을 보고 목적을 거꾸로 추측하지 마. 무엇을 알아보려 했는지가 글에 직접 드러나야 해.',
              "'왜 시작했는지 물었다'처럼 무엇을 또는 왜 또는 어떻게 물었는지가 직접 드러나면 목적을 밝힌 것으로 인정해. 반드시 '알아보기 위해'라는 표현이 있어야 하는 것은 아니야.",
            ],
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
            refinementSeed: '이미 쓴 준비 과정이 면담에서 실제로 물은 내용과 자연스럽게 이어지도록 다듬게 안내',
            fallbackMissionTitle: '면담 준비 과정 밝히기',
            assessmentNotes: [
              'preparation은 질문 만들기, 자료 조사, 약속 잡기처럼 면담 전에 한 준비 행동이 글에 직접 있어야 met이야.',
              '면담 목적을 쓰거나 질문했다는 사실만으로 준비 과정을 추측하지 마. 준비했다는 말은 있지만 무엇을 했는지 알 수 없으면 partial이고, 준비 행동을 전혀 찾을 수 없을 때만 unmet이야.',
            ],
            missionNotes: [
              'preparation이 수정 대상이면 면담 전에 실제로 한 준비 행동을 떠올릴 질문을 만들어. 준비했을 법한 내용을 대신 지어내지 마.',
            ],
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
            refinementSeed: '이미 설명한 새 사실에 면담에서 실제로 들은 이유·과정·상황의 연결을 더 선명하게 만들도록 안내',
            fallbackMissionTitle: '새 사실에 설명 덧붙이기',
            assessmentNotes: [
              'learned-facts는 새롭게 알게 된 사실과 그 사실의 이유, 과정, 사례, 상황 중 하나가 함께 있어야 met이야.',
              '새롭게 알게 된 사실은 있지만 단순히 나열만 했으면 learned-facts는 partial이야. 새롭게 알게 된 사실 자체가 없을 때만 unmet이야.',
              '짧은 한 문장 안에 이유나 과정이 분명하면 learned-facts는 met이야. 문장이 짧다는 이유만으로 partial로 낮추지 마.',
            ],
            missionNotes: [
              "learned-facts가 수정 대상이면 면담에서 들은 이유·과정·상황을 확인할 질문을 만들고, 그 답을 어느 사실 뒤에 덧붙일지 안내해. '더 자세히 쓰기'라고 하지 마.",
            ],
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
            refinementSeed: '이미 쓴 느낀 점이 본문의 구체적인 면담 사실과 직접 이어지도록 마무리를 다듬게 안내',
            fallbackMissionTitle: '느낀 점에 까닭 덧붙이기',
            assessmentNotes: [
              'reflection은 면담 뒤에 든 생각, 느낌, 변화가 구체적으로 드러나면 met이야.',
              "'좋았다', '재미있었다', '중요하다'처럼 까닭이나 변화가 없는 말만 있으면 reflection은 partial이야.",
              '구체적인 깨달음이나 생각이 한 문장이라도 있으면 reflection은 met이야. 문장 수가 적거나 별도의 까닭 문장이 없다는 이유만으로 partial로 낮추지 마.',
              "'해 보고 싶었다'처럼 구체적인 변화나 다짐이 드러나면 reflection을 met으로 인정해.",
              '면담 활동이나 준비에 관한 느낌만 있으면 reflection은 partial이야. 느낌이 전혀 없을 때만 unmet이야.',
            ],
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
    id: 'g6s2-unit5',
    unitNumber: 5,
    icon: '📰',
    title: '독자와 매체를 고려하여 기사문 작성하기',
    description: '읽을 사람과 매체를 생각하며 사실을 전하는 기사문을 써요.',
    genre: '기사문',
    recommendedLength: 600,

    standards: [
      {
        code: '6국03-04',
        text: '독자와 매체를 고려하여 내용을 생성하고 표현하며 글을 쓴다.',
      },
    ],

    assessmentGuidance: [
      '기사문에서 전문은 제목 다음, 본문 앞에 오는 요약 문단을 말해. 신문 기사의 첫머리라고 생각해.',
    ],

    missionGuidance: {
      grounding: '학생 글에 실제로 나온 내용을 짚되 학생 글에 없는 사실이나 취재 내용을 만들어내지 마.',
      selfFill: '질문이나 단서는 줄 수 있지만 학생이 취재해서 알게 된 내용을 스스로 채우게 해.',
    },

    chunks: [
      {
        id: 'reader-content',
        label: '독자 고려하여 내용 생성하기',
        criteria: [
          {
            id: 'newsworthy-topic',
            evaluator: 'teacher-ai-feedback',
            label: '관심을 끌 만한 기삿거리를 골랐다.',
            shortLabel: '기삿거리가 관심을 끈다',
            priority: 40,
            statuses: {
              met: '왜 지금 알릴 만한 일인지가 드러나고, 읽는 사람이 궁금해할 내용이 담겨 있다.',
              partial: '알릴 만한 일이기는 하나 무엇이 새롭거나 중요한지가 드러나지 않는다.',
              unmet: '무엇을 알리려는 기사인지 식별할 수 없다.',
            },
            missionSeed: '이 기사가 왜 지금 알릴 만한 일인지 드러나도록, 새롭거나 중요한 점 하나를 밝히게 안내',
            refinementSeed: '이미 드러난 기삿거리의 새롭거나 중요한 점이 제목·전문과 더 분명히 이어지도록 다듬게 안내',
            fallbackMissionTitle: '알릴 만한 점 밝히기',
          },
          {
            id: 'headline',
            evaluator: 'teacher-ai-feedback',
            label: '흥미를 끄는 제목을 붙였다.',
            shortLabel: '제목이 흥미를 끈다',
            priority: 50,
            statuses: {
              met: '제목이 기사의 핵심 내용을 담으면서 읽고 싶게 만든다.',
              partial: '제목은 있으나 내용을 짐작하기 어렵거나 “○○에 대하여”처럼 밋밋하다.',
              unmet: '제목을 찾을 수 없다.',
            },
            missionSeed: '본문의 핵심 사실 하나를 제목에 넣어 무엇에 관한 기사인지 한눈에 드러나게 고치도록 안내',
            refinementSeed: '이미 붙인 제목이 본문의 가장 중요한 사실을 더 또렷하게 가리키도록 다듬게 안내',
            fallbackMissionTitle: '제목에 핵심 사실 넣기',
          },
          {
            id: 'plain-expression',
            evaluator: 'teacher',
            label: '이해하기 쉬운 표현으로 썼다.',
            shortLabel: '표현이 이해하기 쉽다',
          },
        ],
      },
      {
        id: 'medium-form',
        label: '매체 고려하여 표현하며 글쓰기',
        criteria: [
          {
            id: 'article-structure',
            evaluator: 'ai',
            label: '제목, 전문, 본문을 갖추었다.',
            shortLabel: '제목·전문·본문이 있다',
            priority: 10,
            statuses: {
              met: '제목, 전문, 본문 세 부분이 모두 구분되어 있다.',
              partial: '세 부분 가운데 하나 또는 둘만 있다.',
              unmet: '제목도 전문도 없이 본문만 이어져 있다.',
            },
            missionSeed: '제목·전문·본문 가운데 빠진 부분을 찾아 채워 넣도록 안내',
            refinementSeed: '이미 갖춘 제목·전문·본문의 경계가 더 분명히 드러나도록 다듬게 안내',
            fallbackMissionTitle: '빠진 부분 채워 넣기',
            assessmentNotes: [
              'article-structure는 제목 바로 아래 한두 문장으로 사건 전체를 요약했으면 전문이 있는 것으로 인정해.',
              '소제목이나 빈 줄이 없어도 요약이 앞에 오고 자세한 설명이 뒤따르면 전문과 본문이 나뉜 것으로 인정해.',
            ],
          },
          {
            id: 'five-w-one-h',
            evaluator: 'ai',
            label: '전문에서 육하원칙을 지켰다.',
            shortLabel: '전문이 육하원칙을 지킨다',
            priority: 20,
            statuses: {
              met: '전문에 누가·언제·어디서·무엇을·어떻게·왜 가운데 다섯 가지 이상이 드러난다.',
              partial: '전문에 육하원칙 요소가 셋에서 넷만 드러난다.',
              unmet: '전문이 없거나 육하원칙 요소가 둘 이하다.',
            },
            missionSeed: '전문에서 빠진 육하원칙 요소를 짚고, 본문에 이미 있는 내용으로 전문을 채우도록 안내',
            refinementSeed: '이미 육하원칙을 갖춘 전문이 한 문장으로 더 깔끔히 읽히도록 다듬게 안내',
            fallbackMissionTitle: '전문에 빠진 요소 넣기',
            // 스모크에서 이 규칙이 안 먹혔다. 전문에 요소가 둘뿐이고 나머지는
            // 전부 본문에 있는 글을 세 번 다 met으로 판정했다. "전문만 보고
            // 판정해"만으로는 어디까지가 전문인지 모델이 정하지 못한다.
            assessmentNotes: [
              '전문은 제목 바로 다음에 오는 한 덩어리야. 빈 줄로 나뉘어 있으면 제목 다음 첫 덩어리가 전문이고, 그 뒤는 전부 본문이야.',
              'five-w-one-h는 그 전문 안에 있는 요소만 세. 본문에 아무리 많이 나와도 전문에 없으면 없는 것으로 쳐.',
              '전문이 한 문장뿐이면 그 한 문장 안에서만 세. 요소가 둘 이하면 unmet, 셋이나 넷이면 partial, 다섯 이상이면 met이야.',
              '전문이 아예 없으면 five-w-one-h는 unmet이야.',
            ],
          },
          {
            id: 'fact-delivery',
            evaluator: 'teacher-ai-feedback',
            label: '사실이나 사건을 전달했다.',
            shortLabel: '사실·사건을 전달한다',
            priority: 30,
            statuses: {
              met: '실제로 있었던 일이나 확인할 수 있는 사실을 중심으로 쓰였다.',
              partial: '사실은 있으나 글쓴이의 생각이나 느낌과 뒤섞여 구분되지 않는다.',
              unmet: '전달하는 사실이나 사건을 찾을 수 없다.',
            },
            missionSeed: '글쓴이의 생각이 섞인 문장을 찾아, 확인할 수 있는 사실만 남기도록 고치게 안내',
            refinementSeed: '이미 전달한 사실과 글쓴이의 의견이 더 분명히 나뉘도록 문장을 다듬게 안내',
            fallbackMissionTitle: '사실과 의견 나누기',
          },
        ],
      },
    ],
  },
  {
    id: 'g6s2-media',
    // 번호가 없는 단원이다. 교육과정에서 그냥 '매체 단원'이라 부른다 —
    // 활동 생성 카드의 번호 자리에는 unitLabel이 대신 들어간다.
    unitLabel: '매체 단원',
    icon: '📱',
    title: '매체 성찰 보고서 쓰기',
    description: '자신의 매체 이용 경험을 돌아보고 보고서로 써요.',
    genre: '매체 성찰 보고서',
    recommendedLength: 600,

    // The only unit with two standards. 6국06-04 covers the first chunk,
    // 6국03-06 the other two.
    standards: [
      {
        code: '6국06-04',
        text: '자신의 매체 이용 양상에 대해 성찰한다.',
      },
      {
        code: '6국03-06',
        text: '쓰기에 적극적으로 참여하며 자신의 글을 독자와 공유하는 태도를 지닌다.',
      },
    ],

    assessmentGuidance: [
      '여기서 매체는 유튜브, 게임, 누리소통망, 텔레비전, 책처럼 학생이 이용하는 모든 매체를 말해.',
    ],

    missionGuidance: {
      grounding: '학생 글에 실제로 나온 내용을 짚되 학생 글에 없는 이용 경험이나 사실을 만들어내지 마.',
      selfFill: '질문이나 단서는 줄 수 있지만 학생이 자기 매체 이용 경험을 스스로 떠올려 채우게 해.',
    },

    chunks: [
      {
        id: 'media-reflection',
        label: '자신의 매체 이용 양상 성찰하기',
        criteria: [
          {
            id: 'reflection-purpose',
            evaluator: 'ai',
            label: '매체 이용 경험을 돌아본 까닭과 목적을 밝혔다.',
            shortLabel: '돌아본 까닭·목적이 드러난다',
            priority: 10,
            statuses: {
              met: '무엇 때문에 자신의 매체 이용을 돌아보게 됐는지와 무엇을 알아보려 했는지가 둘 다 드러난다.',
              partial: '까닭과 목적 중 하나만 드러난다.',
              unmet: '돌아본 까닭도 목적도 식별할 수 없다.',
            },
            missionSeed: '자신의 매체 이용을 돌아보게 된 계기와 무엇을 알아보려 했는지 가운데 빠진 쪽을 밝히도록 안내',
            refinementSeed: '이미 밝힌 까닭과 목적이 뒤에 나오는 성찰 내용과 더 분명히 이어지도록 다듬게 안내',
            fallbackMissionTitle: '돌아본 까닭 밝히기',
          },
          {
            id: 'usage-pattern',
            evaluator: 'ai',
            label: '매체 이용 경험에서 고쳐야 할 특징이 드러난다.',
            shortLabel: '고칠 점이 드러난다',
            priority: 20,
            statuses: {
              met: '자신의 매체 이용에서 고쳐야 할 점이 구체적인 행동이나 습관으로 드러난다.',
              partial: '고칠 점을 말하기는 하나 “많이 본다”처럼 막연하다.',
              unmet: '고쳐야 할 점을 찾을 수 없다.',
            },
            missionSeed: '“많이 본다”처럼 뭉뚱그린 표현 대신 언제, 얼마나, 무엇을 하는지 드러나는 행동으로 바꿔 쓰도록 안내',
            refinementSeed: '이미 짚은 고칠 점에 그렇게 판단한 까닭이 되는 자기 경험이 더 분명히 붙도록 다듬게 안내',
            fallbackMissionTitle: '고칠 점 또렷하게 쓰기',
            // 원래 "하나라도 드러나면 met"이라고 적어 뒀는데, 그건 바로 위
            // partial 문구("'많이 본다'처럼 막연하다")와 어긋나는 말이었다.
            // 스모크에서 "게임을 많이 한다"가 met으로 나온 게 이 탓이다.
            assessmentNotes: [
              "'많이 한다', '자주 본다', '오래 한다'처럼 양을 뭉뚱그린 말만 있으면 usage-pattern은 partial이야.",
              '언제, 얼마나, 어떤 상황에서 하는지 가운데 하나가 구체적인 장면으로 그려져야 met이야. 숫자가 꼭 있어야 하는 건 아니지만 상황이 떠올라야 해.',
              '고쳐야 할 점을 아예 찾을 수 없으면 unmet이야. 무엇을 이용하는지 사실만 늘어놓은 글이 여기에 해당해.',
            ],
          },
          {
            id: 'felt-point',
            evaluator: 'ai',
            label: '매체 이용 경험을 돌아보며 느낀 점을 밝혔다.',
            shortLabel: '느낀 점이 드러난다',
            priority: 30,
            statuses: {
              met: '돌아본 뒤에 든 생각, 느낌, 앞으로의 다짐이 구체적으로 드러난다.',
              partial: '“반성했다”, “좋았다”처럼 까닭이나 변화가 없는 말만 있다.',
              unmet: '느낀 점을 찾을 수 없다.',
            },
            missionSeed: '돌아본 뒤에 생긴 생각이나 앞으로 바꾸고 싶은 점 하나를 학생 말로 덧붙이도록 안내',
            refinementSeed: '이미 쓴 느낀 점이 앞서 짚은 고칠 점과 직접 이어지도록 마무리를 다듬게 안내',
            fallbackMissionTitle: '느낀 점에 까닭 덧붙이기',
            assessmentNotes: [
              "'앞으로 줄이겠다'처럼 구체적인 다짐이 드러나면 felt-point를 met으로 인정해.",
            ],
          },
        ],
      },
      {
        id: 'active-participation',
        label: '쓰기에 적극적으로 참여한다',
        criteria: [
          {
            id: 'participation',
            evaluator: 'teacher',
            label: '쓰기에 적극적으로 참여했다.',
            shortLabel: '적극적으로 참여했는가?',
          },
        ],
      },
      {
        id: 'sharing-attitude',
        label: '자신의 글을 독자와 공유하는 태도',
        criteria: [
          {
            id: 'share-audience',
            evaluator: 'teacher',
            label: '공유할 대상과 목적을 고려했다.',
            shortLabel: '대상과 목적을 고려했는가?',
          },
        ],
      },
    ],
  },
  {
    id: 'g6s2-unit6',
    unitNumber: 6,
    icon: '📝',
    title: '경험을 떠올리며 이야기 바꾸어 쓰기',
    description: '자신의 경험을 떠올려 이야기의 인물이나 사건을 바꾸어 써요.',
    genre: '이야기(창작)',
    recommendedLength: 600,

    // The prompt reads "너는 … {이것}을 확인하는 판정자야". Without this it
    // falls back to the genre, which reads badly here ('이야기(창작)를').
    coachingSubject: '바꾸어 쓴 이야기',

    standards: [
      {
        code: '6국05-05',
        text: '자신의 경험을 시, 소설, 극, 수필 등 적절한 갈래로 표현한다.',
      },
    ],

    assessmentGuidance: [
      '원래 이야기를 읽지 않았다고 보고, 학생 글만으로 확인할 수 있는 것만 판정해. 교과서 이야기와 얼마나 달라졌는지는 판단하지 마.',
    ],

    missionGuidance: {
      grounding: '학생 글에 실제로 나온 내용을 짚되 학생 글에 없는 사건이나 인물을 만들어내지 마.',
      selfFill: '질문이나 단서는 줄 수 있지만 학생이 이야기를 어떻게 바꿀지 스스로 정하게 해.',
    },

    // 자료에 "청크 따로 없음"이라고 적혀 있다. label이 null이면 보드가 청크
    // 제목 없이 항목만 그린다.
    chunks: [
      {
        id: 'story-rewrite',
        label: null,
        criteria: [
          {
            id: 'own-experience',
            evaluator: 'ai',
            label: '자신의 경험이 이야기에 들어 있다.',
            shortLabel: '자신의 경험이 들어 있다',
            priority: 10,
            statuses: {
              met: '글쓴이가 실제로 겪은 일로 볼 수 있는 장면이나 그때의 마음이 이야기 속에 들어 있다.',
              partial: '경험처럼 보이는 대목이 있으나 무엇을 겪었는지 알기 어렵다.',
              unmet: '글쓴이 자신의 경험을 찾을 수 없다.',
            },
            missionSeed: '바꾼 이야기의 한 장면에 자신이 실제로 겪은 일이나 그때의 마음을 넣도록 안내',
            refinementSeed: '이미 넣은 자신의 경험이 이야기의 흐름과 더 자연스럽게 맞물리도록 다듬게 안내',
            fallbackMissionTitle: '겪은 일 넣기',
          },
          {
            id: 'character-setting-change',
            evaluator: 'teacher',
            label: '인물이나 배경이 바뀔 때 이야기가 알맞게 달라졌다.',
            shortLabel: '인물·배경 변화가 알맞다',
          },
          {
            // 자료에 "AI : 생각해봐야함"으로 적힌 두 항목 가운데 하나. 일단 AI
            // 판정으로 넣었다 — 돌려보고 판정이 흔들리면 teacher로 내리면
            // 된다. 내리는 데 필요한 건 evaluator 한 줄 수정뿐이다.
            id: 'cause-and-effect',
            evaluator: 'ai',
            label: '사건 사이의 원인과 결과가 타당하다.',
            shortLabel: '원인과 결과가 이어진다',
            priority: 20,
            statuses: {
              met: '앞 사건이 뒤 사건의 원인이 되는 연결이 이야기 안에서 드러난다.',
              partial: '사건은 이어지나 왜 그렇게 됐는지 알기 어려운 대목이 있다.',
              unmet: '사건들이 서로 이어지지 않고 따로 놓여 있다.',
            },
            missionSeed: '앞뒤가 갑자기 이어지는 대목 하나를 찾아, 그 일이 왜 일어났는지 한 문장으로 잇도록 안내',
            refinementSeed: '이미 이어진 원인과 결과가 더 또렷하게 읽히도록 연결 문장을 다듬게 안내',
            fallbackMissionTitle: '원인 이어 쓰기',
          },
          {
            // 위와 같은 "생각해봐야함" 항목.
            id: 'story-flow',
            evaluator: 'ai',
            label: '처음, 가운데, 끝이 자연스럽게 이어진다.',
            shortLabel: '처음·가운데·끝이 이어진다',
            priority: 30,
            statuses: {
              met: '이야기가 시작되고 사건이 벌어지고 마무리되는 흐름이 끊기지 않는다.',
              partial: '세 부분 가운데 하나가 너무 짧거나 이야기가 갑자기 끝난다.',
              unmet: '이야기의 흐름을 따라가기 어렵다.',
            },
            missionSeed: '이야기가 갑자기 끊기거나 급히 끝나는 자리를 짚어, 그 사이에 무슨 일이 있었는지 이어 쓰도록 안내',
            refinementSeed: '이미 이어진 처음·가운데·끝의 이음매가 더 매끄럽게 읽히도록 다듬게 안내',
            fallbackMissionTitle: '끊긴 자리 이어 쓰기',
          },
          {
            // own-experience와 겹쳐 보이지만 자료에 둘 다 있다. 이쪽은 경험을
            // 넣었는지가 아니라 그 경험에 담긴 생각까지 반영했는지를 묻는
            // 항목이라 교사 재량으로 남겼다.
            id: 'experience-and-thought',
            evaluator: 'teacher',
            label: '자신의 경험과 생각을 반영했다.',
            shortLabel: '경험과 생각이 반영됐다',
          },
          {
            id: 'creative-change',
            evaluator: 'teacher',
            label: '창의적인 아이디어로 이야기를 바꾸었다.',
            shortLabel: '창의적으로 바꾸었다',
          },
        ],
      },
    ],
  },
]

// Icon shown on activity cards (dashboard, activity detail roster). Covers
// every entry in GENRES, not just the ones the unit picker currently offers,
// so older activities created before the unit-card redesign still get an icon.
const GENRE_ICONS = {
  [INTERVIEW_REPORT_GENRE]: '🎤',
  '줄거리 요약': '📜',
  '매체 성찰 보고서': '📱',
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
  return GRADE6_SEMESTER2_UNITS.find((unit) => unit.id === unitId) ?? null
}

// A list because the 매체 unit has two standards. Units without any get null,
// not an empty array, so the board can tell "no standards" from "none yet".
export function getUnitStandards(unitId) {
  return getUnitById(unitId)?.standards ?? null
}

// Everything the board draws, teacher-judged criteria included.
export function getUnitChunks(unitId) {
  return getUnitById(unitId)?.chunks ?? null
}

// The firewall between the board and the coaching pipeline. `evaluator:
// 'teacher'` criteria do not come out of here, so they cannot reach the
// assessment prompt, the schema enums, or the mission candidates — the
// pipeline has no way to learn they exist. `teacher-ai-feedback` criteria do
// come out: the AI judges them so it can advise on them, and it is the board
// (showsAiVerdict) that keeps the verdict off the screen.
//
// The shape is exactly what buildAssessmentPrompt takes: [{ id, label,
// criteria }].
export function getAiRubrics(unitId) {
  const chunks = getUnitChunks(unitId)
  if (!chunks) return null

  const rubrics = chunks
    .map((chunk) => ({
      id: chunk.id,
      label: chunk.label,
      criteria: chunk.criteria.filter(isAiJudged),
    }))
    .filter((chunk) => chunk.criteria.length > 0)

  return rubrics.length > 0 ? rubrics : null
}
