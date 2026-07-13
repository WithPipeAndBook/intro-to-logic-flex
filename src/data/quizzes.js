export const quizzes = {
  'mrw-lesson-1': {
    multipleChoice: [
      {
        id: 'l1-mc-truth',
        prompt: 'Which term names reality as it is, whether or not anyone believes it?',
        choices: ['Truth', 'Self-report', 'Certainty'],
        answer: 'Truth',
      },
      {
        id: 'l1-mc-statement',
        prompt: 'Which term means a declarative sentence that can be true or false?',
        choices: ['Statement', 'Question', 'Command'],
        answer: 'Statement',
      },
      {
        id: 'l1-mc-reason',
        prompt: 'Which term names support that makes a claim more likely to be true?',
        choices: ['Reason', 'Contradiction', 'Opinion'],
        answer: 'Reason',
      },
    ],
    fillBlank: [
      {
        id: 'l1-fill-contradiction',
        prompt: 'Fill in the vocabulary term.',
        context: 'A statement and its negation, such as “p and not-p,” form a ____.',
        answer: 'contradiction',
      },
      {
        id: 'l1-fill-belief',
        prompt: 'Fill in the vocabulary term.',
        context: 'A mental act that affirms or denies a claim is a ____.',
        answer: 'belief',
      },
      {
        id: 'l1-fill-self-report',
        prompt: 'Fill in the vocabulary term.',
        context: '“I feel worried about this argument” is a statement about one’s own mental state, so it is a ____.',
        answer: 'self-report',
      },
    ],
    inUse: [
      {
        id: 'l1-use-statement',
        prompt: 'Is the term used correctly?',
        context: '“Clean your room!” is a statement because it is a sentence.',
        choices: ['Correct use', 'Incorrect use'],
        answer: 'Incorrect use',
      },
      {
        id: 'l1-use-opinion',
        prompt: 'Is the term used correctly?',
        context: 'An opinion, in this lesson’s vocabulary, is a belief that can be true or false.',
        choices: ['Correct use', 'Incorrect use'],
        answer: 'Correct use',
      },
      {
        id: 'l1-use-noncontradiction',
        prompt: 'Is the term used correctly?',
        context: 'The Law of Non-Contradiction says that “p and not-p” cannot be true in the same sense at the same time.',
        choices: ['Correct use', 'Incorrect use'],
        answer: 'Correct use',
      },
    ],
  },
  'mrw-lesson-2': {
    multipleChoice: [
      {
        id: 'l2-mc-logic',
        prompt: 'Which term names the study of methods for evaluating how well statements support a conclusion?',
        choices: ['Logic', 'Illustration', 'Sentence'],
        answer: 'Logic',
      },
      {
        id: 'l2-mc-premise',
        prompt: 'Which term names a statement meant to support a conclusion?',
        choices: ['Premise', 'Explanation', 'Ambiguous term'],
        answer: 'Premise',
      },
      {
        id: 'l2-mc-inductive',
        prompt: 'Which arguments have premises that make the conclusion probable without guaranteeing it?',
        choices: ['Inductive arguments', 'Deductive arguments', 'Illustrations'],
        answer: 'Inductive arguments',
      },
    ],
    fillBlank: [
      {
        id: 'l2-fill-distinction',
        prompt: 'Fill in the vocabulary term.',
        context: 'To explicitly differentiate multiple senses of an ambiguous term is to draw a ____.',
        answer: 'distinction',
      },
      {
        id: 'l2-fill-conclusion',
        prompt: 'Fill in the vocabulary term.',
        context: 'In an argument, the statement being supported by other statements is the ____.',
        answer: 'conclusion',
      },
      {
        id: 'l2-fill-illustration',
        prompt: 'Fill in the vocabulary term.',
        context: 'A clarifying example that helps one understand a statement is an ____.',
        answer: 'illustration',
      },
    ],
    inUse: [
      {
        id: 'l2-use-argument',
        prompt: 'Is the term used correctly?',
        context: '“It is raining; therefore, you should bring an umbrella” is an argument because one statement supports another.',
        choices: ['Correct use', 'Incorrect use'],
        answer: 'Correct use',
      },
      {
        id: 'l2-use-explanation',
        prompt: 'Is the term used correctly?',
        context: '“Wars happen because humans are selfish” is treated here as an argument because it tries to prove wars happen.',
        choices: ['Correct use', 'Incorrect use'],
        answer: 'Incorrect use',
      },
      {
        id: 'l2-use-deductive',
        prompt: 'Is the term used correctly?',
        context: 'A deductive argument is one whose premises guarantee the conclusion if those premises are true.',
        choices: ['Correct use', 'Incorrect use'],
        answer: 'Correct use',
      },
    ],
  },
};
