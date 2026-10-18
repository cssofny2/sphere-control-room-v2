// All of Dr. Wire's everyday conversation topics, in match order: short anchored phrases first (back-channel,
// greetings), then work and pay, then his personal life, then feelings, manners and what the operator says about
// themselves. The first matching topic wins. See docs/dr-wire-conversation.md for the published list.
import { Chatter, type Topic } from './chatter';
import { SOCIAL_TOPICS } from './chatBankSocial';
import { WORK_TOPICS } from './chatBankWork';
import { PERSONAL_TOPICS } from './chatBankPersonal';

const FIRST = new Set(['ack_cool', 'ack_really', 'ack_lol', 'ack_yes_no', 'ack_nothing', 'ack_wait', 'hello_again', 'welcome_back', 'sorry']);
export const ALL_TOPICS: Topic[] = [
  ...SOCIAL_TOPICS.filter(t => FIRST.has(t.id)), ...WORK_TOPICS, ...PERSONAL_TOPICS, ...SOCIAL_TOPICS.filter(t => !FIRST.has(t.id)),
];
export const createChatter = () => new Chatter(ALL_TOPICS);
export type { Topic };
