/**
 * Golden questions over samples/transcripts. A hit is relevant when it comes
 * from `meeting` (title substring) and contains `evidence`, a phrase that a
 * correct answer would have to cite.
 *
 * The questions are deliberately phrased differently from the transcripts:
 * some share keywords, some only share meaning.
 */
export interface RetrievalCase {
  question: string;
  meeting: string;
  evidence: string;
}

export const RETRIEVAL_CASES: RetrievalCase[] = [
  {
    question: 'Why did the launch date move?',
    meeting: 'go/no-go',
    evidence: 'December 15th',
  },
  {
    question: 'What was the original target launch date?',
    meeting: 'kickoff',
    evidence: 'December 8th',
  },
  {
    question: 'What did users think about the push notification prompt?',
    meeting: 'usability',
    evidence: "don't allow",
  },
  {
    question: 'When does the payments SDK stop working?',
    meeting: 'engineering sync',
    evidence: 'December 1st',
  },
  {
    question: 'How long would offline editing take to build?',
    meeting: 'engineering sync',
    evidence: 'four to five weeks',
  },
  {
    question: 'Who owns the regression test plan and when is it due?',
    meeting: 'go/no-go',
    evidence: 'regression test plan',
  },
  {
    question: 'What did legal require for the notification consent?',
    meeting: 'go/no-go',
    evidence: 'explicit opt-in',
  },
  {
    question: 'Will push notifications be part of a paid plan?',
    meeting: 'go/no-go',
    evidence: 'no pricing changes',
  },
  {
    question: 'Why did field workers struggle to sign up?',
    meeting: 'usability',
    evidence: 'company code',
  },
  {
    question: 'How many extra phones does QA need for testing?',
    meeting: 'kickoff',
    evidence: 'six more',
  },
  {
    question: 'What kind of notifications will we send at launch?',
    meeting: 'kickoff',
    evidence: 'transactional',
  },
  {
    question:
      'Was anything decided about releasing to a small group of users first?',
    meeting: 'go/no-go',
    evidence: 'five percent',
  },
  {
    question: 'How much faster is the new setup flow than the old one?',
    meeting: 'usability',
    evidence: 'two minutes',
  },
  {
    question: 'Why was offline editing pushed to a later release?',
    meeting: 'go/no-go',
    evidence: 'losing data',
  },
];
