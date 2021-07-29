import { Actions, ChatItemRenderers, TextRuns } from './interfaces-youtube-response';

const runsToText = (runs: TextRuns[]) => {
  return runs.map(it => {
    if (it.text) {
      return it.text;
    } else {
      return ' :' + it.emoji!.image.accessibility.accessibilityData.label + ': ';
    }
  }).join('');
};
const rendererToTime = (item: ChatItemRenderers) => {
  const preformattedTime = item.liveChatTextMessageRenderer?.timestampText?.simpleText
    ?? item.liveChatPaidMessageRenderer?.timestampText?.simpleText
    ?? item.liveChatMembershipItemRenderer?.timestampText?.simpleText
    ?? null;

  if (preformattedTime !== null) {
    return preformattedTime.padStart(8, ' ');
  }

  const timestampUsec = item.liveChatTextMessageRenderer?.timestampUsec
    ?? item.liveChatPaidMessageRenderer?.timestampUsec
    ?? item.liveChatMembershipItemRenderer?.timestampUsec
    ?? null;

  if (timestampUsec == null) {
    return null;
  }

  return new Date(Number(timestampUsec) / 1000).toISOString().replace(/\.\d+Z/, '');
};
const rendererToText = (item: ChatItemRenderers) => {
  if (item.liveChatTextMessageRenderer) {
    const renderer = item.liveChatTextMessageRenderer;
    const author = renderer.authorName?.simpleText ?? '<unnamed>';
    const message = runsToText(renderer.message.runs);

    return `${author}: ${message}`;
  }

  if (item.liveChatMembershipItemRenderer) {
    const renderer = item.liveChatMembershipItemRenderer;
    const message = runsToText(renderer.headerSubtext.runs);

    return message;
  }

  if (item.liveChatPaidMessageRenderer) {
    const renderer = item.liveChatPaidMessageRenderer;
    const author = renderer.authorName?.simpleText ?? '<unnamed>';
    const amount = renderer.purchaseAmountText.simpleText;

    const message = renderer.message
      ? runsToText(renderer.message.runs)
      : '<no text>';

    return (`[${amount}] ${author}: ${message}`);
  }

  return null;
};
export const convertToLines = (o: Actions): string[] => {
  const lines = [];

  if (o.addChatItemAction) {
    const item = o.addChatItemAction.item;

    const time = rendererToTime(item);
    const message = rendererToText(item);

    if (time && message) {
      lines.push(`${time} ${message}`);
    }
  }

  if (o.replayChatItemAction) {
    for (let o1 of o.replayChatItemAction.actions) {
      if (o1.addChatItemAction) {
        const item = o1.addChatItemAction.item;

        const time = rendererToTime(item);
        const message = rendererToText(item);

        if (time && message) {
          lines.push(`${time} ${message}`);
        }
      }
    }
  }

  return lines;
};
