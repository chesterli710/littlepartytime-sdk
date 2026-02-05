// examples/number-guess/src/config.ts
import type { GameConfig } from "@littlepartytime/sdk";

const config: GameConfig = {
  id: "number-guess",
  name: "猜数字",
  description: "轮流猜一个 1-100 之间的数字，猜中的人出局！范围会逐渐缩小，谁能坚持到最后？",
  coverImage: "/games/number-guess/cover.png",
  minPlayers: 2,
  maxPlayers: 8,
  tags: ["休闲", "策略"],
  version: "1.0.0",
  sdkVersion: "0.1.0",
};

export default config;
