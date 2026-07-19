export type Quote = {
  text: string; // 原文(英語)
  ja: string; // 日本語訳
  author: string;
};

/** 著名なIT技術者・経営者・ビジネスパーソンの名言 */
export const QUOTES: Quote[] = [
  {
    text: "Stay hungry, stay foolish.",
    ja: "ハングリーであれ、愚か者であれ。",
    author: "Steve Jobs",
  },
  {
    text: "Innovation distinguishes between a leader and a follower.",
    ja: "イノベーションこそが、リーダーと追随者を分ける。",
    author: "Steve Jobs",
  },
  {
    text: "The best way to predict the future is to invent it.",
    ja: "未来を予測する最善の方法は、それを発明することだ。",
    author: "Alan Kay",
  },
  {
    text: "Your most unhappy customers are your greatest source of learning.",
    ja: "最も不満を持つ顧客こそ、最大の学びの源だ。",
    author: "Bill Gates",
  },
  {
    text: "Move fast and break things.",
    ja: "素早く動き、既成概念を壊せ。",
    author: "Mark Zuckerberg",
  },
  {
    text: "Ideas are easy. Implementation is hard.",
    ja: "アイデアは簡単だ。実行こそが難しい。",
    author: "Guy Kawasaki",
  },
  {
    text: "Done is better than perfect.",
    ja: "完璧を目指すより、まず終わらせろ。",
    author: "Sheryl Sandberg",
  },
  {
    text: "When something is important enough, you do it even if the odds are not in your favor.",
    ja: "本当に重要なことなら、勝算が低くてもやり遂げる。",
    author: "Elon Musk",
  },
  {
    text: "If you are not embarrassed by the first version, you launched too late.",
    ja: "最初の版に恥じらいがないなら、公開が遅すぎる。",
    author: "Reid Hoffman",
  },
  {
    text: "The people crazy enough to think they can change the world are the ones who do.",
    ja: "世界を変えられると本気で信じる者だけが、実際に変える。",
    author: "Steve Jobs",
  },
  {
    text: "Quality is more important than quantity.",
    ja: "量より質だ。",
    author: "Steve Jobs",
  },
  {
    text: "It's fine to celebrate success but it is more important to heed the lessons of failure.",
    ja: "成功を祝うのもいいが、失敗の教訓に耳を傾ける方が大切だ。",
    author: "Bill Gates",
  },
];

export function randomQuote(): Quote {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}
